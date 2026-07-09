import type { Phase, Vec2, VelocityPoint } from '@/types'
import { lerp } from '@/lib/geometry/vec2'

export interface LapSample {
  position: Vec2
  /** Direction of travel (radians) */
  heading: number
  speedMs: number
  phase: Phase
  /** Cumulative lap distance (m), wrapped into [0, lineLength) */
  distance: number
}

export interface LapTimeline {
  totalLapTime: number
  lineLength: number
  sample(t: number): LapSample
}

const EMPTY_SAMPLE: LapSample = {
  position: { x: 0, y: 0 },
  heading: 0,
  speedMs: 0,
  phase: 'coast',
  distance: 0,
}

/** Shortest-path angle interpolation (avoids the ±π wraparound seam). */
function lerpAngle(a: number, b: number, f: number): number {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + diff * f
}

/** Tangent-estimate heading per point of a closed polyline (neighbor-to-neighbor). */
function closedHeadings(line: readonly Vec2[]): number[] {
  const n = line.length
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const a = line[(i - 1 + n) % n]
    const c = line[(i + 1) % n]
    out[i] = Math.atan2(c.y - a.y, c.x - a.x)
  }
  return out
}

/**
 * Builds a time-parametrized sampler over a closed racing line. Pure
 * interpolation only — `velocity[].s/t/phase` and `lapTime` are reused as-is
 * from the velocity profile, never recomputed.
 */
export function buildLapTimeline(
  line: readonly Vec2[],
  velocity: readonly VelocityPoint[],
  lineLength: number,
  lapTime: number,
): LapTimeline {
  const n = line.length
  if (n === 0 || velocity.length !== n || lapTime <= 0) {
    return { totalLapTime: 0, lineLength, sample: () => EMPTY_SAMPLE }
  }

  const headings = closedHeadings(line)

  function sample(tRaw: number): LapSample {
    const t = ((tRaw % lapTime) + lapTime) % lapTime

    // largest i such that velocity[i].t <= t
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (velocity[mid].t <= t) lo = mid
      else hi = mid - 1
    }
    const i = lo
    const next = (i + 1) % n

    const segT0 = velocity[i].t
    const segT1 = next === 0 ? lapTime : velocity[next].t
    const segDt = segT1 - segT0
    const f = segDt > 1e-9 ? (t - segT0) / segDt : 0

    const segS0 = velocity[i].s
    const segS1 = next === 0 ? lineLength : velocity[next].s

    return {
      position: lerp(line[i], line[next], f),
      heading: lerpAngle(headings[i], headings[next], f),
      speedMs: velocity[i].v + (velocity[next].v - velocity[i].v) * f,
      phase: velocity[i].phase,
      distance: (segS0 + (segS1 - segS0) * f + lineLength) % lineLength,
    }
  }

  return { totalLapTime: lapTime, lineLength, sample }
}
