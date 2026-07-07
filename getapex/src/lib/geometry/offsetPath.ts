import type { Vec2 } from '@/types'
import { add, normalize, perp, scale, sub } from './vec2'

/**
 * Unit left normals per point of a closed polyline, from the central
 * difference tangent. "Left" is relative to the direction of travel, so for a
 * counter-clockwise loop these point toward the loop's center.
 */
export function closedNormals(points: readonly Vec2[]): Vec2[] {
  const n = points.length
  const out = new Array<Vec2>(n)
  for (let i = 0; i < n; i++) {
    const tangent = sub(points[(i + 1) % n], points[(i - 1 + n) % n])
    out[i] = perp(normalize(tangent))
  }
  return out
}

/** Offset a closed polyline along its per-point normals by `distance`. */
export function offsetClosedPath(
  points: readonly Vec2[],
  normals: readonly Vec2[],
  distance: number,
): Vec2[] {
  return points.map((p, i) => add(p, scale(normals[i], distance)))
}
