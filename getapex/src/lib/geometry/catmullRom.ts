import type { Vec2 } from '@/types'
import { dist } from './vec2'

/**
 * Evaluate one centripetal Catmull-Rom segment between p1 and p2 at t ∈ [0, 1],
 * using the standard recursive (Barry–Goldman) formulation with knot
 * parametrization t_{i+1} = t_i + |p_{i+1} − p_i|^0.5.
 */
function evalSegment(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const alpha = 0.5
  const knot = (a: Vec2, b: Vec2, prev: number): number => {
    const d = dist(a, b)
    // Guard duplicate points: a zero knot interval degenerates the basis.
    return prev + Math.max(d ** alpha, 1e-6)
  }
  const t0 = 0
  const t1 = knot(p0, p1, t0)
  const t2 = knot(p1, p2, t1)
  const t3 = knot(p2, p3, t2)
  const u = t1 + (t2 - t1) * t

  const mix = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => {
    const w = (u - ta) / (tb - ta)
    return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w }
  }
  const a1 = mix(p0, p1, t0, t1)
  const a2 = mix(p1, p2, t1, t2)
  const a3 = mix(p2, p3, t2, t3)
  const b1 = mix(a1, a2, t0, t2)
  const b2 = mix(a2, a3, t1, t3)
  return mix(b1, b2, t1, t2)
}

/**
 * Sample a closed centripetal Catmull-Rom spline through `controlPoints`.
 * Returns `samplesPerSegment` points per control-point segment (the control
 * points themselves are interpolated). Result is a closed polyline without a
 * duplicated end point.
 */
export function sampleClosedCatmullRom(
  controlPoints: readonly Vec2[],
  samplesPerSegment: number,
): Vec2[] {
  const n = controlPoints.length
  if (n < 3) return [...controlPoints]
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n]
    const p1 = controlPoints[i]
    const p2 = controlPoints[(i + 1) % n]
    const p3 = controlPoints[(i + 2) % n]
    for (let j = 0; j < samplesPerSegment; j++) {
      out.push(evalSegment(p0, p1, p2, p3, j / samplesPerSegment))
    }
  }
  return out
}
