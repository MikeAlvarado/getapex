import type { Vec2 } from '@/types'

/**
 * Pen-tool anchor: a point on the path plus optional cubic control handles
 * (absolute positions). A null handle degenerates that side to the anchor
 * itself, so click-placed corner points and drag-placed smooth points share
 * one representation.
 */
export interface BezierAnchor {
  point: Vec2
  handleIn: Vec2 | null
  handleOut: Vec2 | null
}

/** Point on a cubic Bézier at parameter t ∈ [0, 1]. */
export function cubicPoint(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

/** The four cubic control points for the segment leaving `from` toward `to`. */
export function segmentControls(from: BezierAnchor, to: BezierAnchor): [Vec2, Vec2, Vec2, Vec2] {
  return [from.point, from.handleOut ?? from.point, to.handleIn ?? to.point, to.point]
}

/**
 * Sample a closed cubic Bézier path (anchor i → anchor i+1, wrapping) into a
 * dense polyline. Each segment contributes `samplesPerSegment` points starting
 * at its anchor; t = 1 is excluded so points are not duplicated at joins.
 */
export function sampleClosedBezierPath(
  anchors: readonly BezierAnchor[],
  samplesPerSegment = 32,
): Vec2[] {
  const n = anchors.length
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = segmentControls(anchors[i], anchors[(i + 1) % n])
    for (let k = 0; k < samplesPerSegment; k++) {
      out.push(cubicPoint(p0, p1, p2, p3, k / samplesPerSegment))
    }
  }
  return out
}
