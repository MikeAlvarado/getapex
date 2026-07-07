import type { Track, Vec2 } from '@/types'
import { rdp } from '@/lib/geometry/rdp'
import { sampleClosedBezierPath, type BezierAnchor } from '@/lib/geometry/bezier'
import { sampleClosedCatmullRom } from '@/lib/geometry/catmullRom'
import { closedLength, resampleClosedByArcLength } from '@/lib/geometry/resample'
import { closedNormals, offsetClosedPath } from '@/lib/geometry/offsetPath'
import { dist } from '@/lib/geometry/vec2'

export interface BuildTrackOptions {
  id: string
  name: string
  /** Total track width (m) */
  width: number
  /** Safety margin off each boundary (m) */
  margin: number
  /** RDP simplification tolerance (m) */
  rdpEpsilon?: number
}

export class TrackBuildError extends Error {}

/**
 * Max gap between stroke end and start for the loop to auto-close,
 * proportional to stroke size so small doodles still close.
 */
export function closureThreshold(stroke: readonly Vec2[]): number {
  const length = closedLength(stroke)
  return Math.max(20, length * 0.08)
}

export function isClosable(stroke: readonly Vec2[]): boolean {
  if (stroke.length < 8) return false
  return dist(stroke[0], stroke[stroke.length - 1]) <= closureThreshold(stroke)
}

/** Uniform spacing target: finer for short tracks, capped for long ones. */
export function pickDs(length: number): number {
  return Math.min(8, Math.max(2, length / 500))
}

/**
 * Raw drawn stroke → closed circuit:
 * RDP-simplify → snap closure → closed centripetal Catmull-Rom fit →
 * uniform arc-length resampling.
 */
export function buildTrackFromStroke(stroke: readonly Vec2[], opts: BuildTrackOptions): Track {
  if (stroke.length < 8) {
    throw new TrackBuildError('Stroke too short to form a circuit')
  }
  if (!isClosable(stroke)) {
    throw new TrackBuildError('Stroke does not close. Finish near your starting point')
  }
  // Snap closure: drop trailing points that crowd the start, then simplify.
  const threshold = closureThreshold(stroke)
  let end = stroke.length - 1
  while (end > 2 && dist(stroke[end], stroke[0]) < threshold * 0.5) end--
  const controls = rdp(stroke.slice(0, end + 1), opts.rdpEpsilon ?? 4)
  if (controls.length < 4) {
    throw new TrackBuildError('Not enough shape to form a circuit')
  }
  return buildTrackFromControls(controls, opts)
}

/** Closed control polygon → circuit (also used for sample tracks). */
export function buildTrackFromControls(controls: readonly Vec2[], opts: BuildTrackOptions): Track {
  return densePathToTrack(sampleClosedCatmullRom(controls, 16), opts)
}

/** Closed pen-tool Bézier path → circuit. The anchors already define the curve. */
export function buildTrackFromBezier(
  anchors: readonly BezierAnchor[],
  opts: BuildTrackOptions,
): Track {
  if (anchors.length < 3) {
    throw new TrackBuildError('Place at least 3 anchor points to form a circuit')
  }
  return densePathToTrack(sampleClosedBezierPath(anchors, 32), opts)
}

/** Dense closed polyline → uniformly resampled circuit. */
function densePathToTrack(dense: readonly Vec2[], opts: BuildTrackOptions): Track {
  const roughLength = closedLength(dense)
  const { points, ds, length } = resampleClosedByArcLength(dense, pickDs(roughLength))
  if (points.length < 32) {
    throw new TrackBuildError('Circuit too small. Draw a larger loop')
  }
  return {
    id: opts.id,
    name: opts.name,
    centerline: points,
    ds,
    width: opts.width,
    margin: opts.margin,
    length,
  }
}

export interface TrackBoundaries {
  left: Vec2[]
  right: Vec2[]
  normals: Vec2[]
}

/** Boundaries = centerline offset ±w/2 along the left normal. */
export function trackBoundaries(track: Track): TrackBoundaries {
  const normals = closedNormals(track.centerline)
  return {
    normals,
    left: offsetClosedPath(track.centerline, normals, track.width / 2),
    right: offsetClosedPath(track.centerline, normals, -track.width / 2),
  }
}

/** Usable half-width for the racing line once car width and margin are taken out. */
export function usableHalfWidth(track: Track, carWidth: number): number {
  return Math.max(0.2, track.width / 2 - carWidth / 2 - track.margin)
}
