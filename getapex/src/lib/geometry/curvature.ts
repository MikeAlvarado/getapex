import type { Vec2 } from '@/types'
import { cross, dist, sub } from './vec2'

/**
 * Signed curvature at point b of the circle through a, b, c
 * (Menger curvature). Positive = turning left (CCW).
 */
export function menger(a: Vec2, b: Vec2, c: Vec2): number {
  const area2 = cross(sub(b, a), sub(c, b))
  const d = dist(a, b) * dist(b, c) * dist(a, c)
  return d > 0 ? (2 * area2) / d : 0
}

/** Signed curvature per point of a closed polyline. */
export function closedCurvature(points: readonly Vec2[]): number[] {
  const n = points.length
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    out[i] = menger(points[(i - 1 + n) % n], points[i], points[(i + 1) % n])
  }
  return out
}
