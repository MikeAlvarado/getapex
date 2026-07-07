import type { Vec2 } from '@/types'
import { dist, lerp } from './vec2'

/** Total length of a closed polyline (including the closing segment). */
export function closedLength(points: readonly Vec2[]): number {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    total += dist(points[i], points[(i + 1) % points.length])
  }
  return total
}

/**
 * Resample a closed polyline at uniform arc-length spacing.
 * The requested `targetDs` is adjusted so an integer number of samples fits
 * the loop exactly. Returns the samples and the actual spacing used.
 */
export function resampleClosedByArcLength(
  points: readonly Vec2[],
  targetDs: number,
): { points: Vec2[]; ds: number; length: number } {
  const total = closedLength(points)
  const count = Math.max(8, Math.round(total / targetDs))
  const ds = total / count

  const out: Vec2[] = []
  let segIdx = 0
  let segStartDist = 0
  let segLen = dist(points[0], points[1 % points.length])
  for (let k = 0; k < count; k++) {
    const target = k * ds
    while (segStartDist + segLen < target && segIdx < points.length - 1) {
      segStartDist += segLen
      segIdx++
      segLen = dist(points[segIdx], points[(segIdx + 1) % points.length])
    }
    const t = segLen > 0 ? (target - segStartDist) / segLen : 0
    out.push(lerp(points[segIdx], points[(segIdx + 1) % points.length], Math.min(t, 1)))
  }
  return { points: out, ds, length: total }
}
