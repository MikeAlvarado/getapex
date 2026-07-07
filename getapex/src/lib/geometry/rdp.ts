import type { Vec2 } from '@/types'
import { cross, dist, sub } from './vec2'

/** Perpendicular distance from `p` to the segment a–b. */
const segmentDistance = (p: Vec2, a: Vec2, b: Vec2): number => {
  const ab = sub(b, a)
  const l = Math.hypot(ab.x, ab.y)
  if (l === 0) return dist(p, a)
  return Math.abs(cross(ab, sub(p, a))) / l
}

/**
 * Ramer–Douglas–Peucker polyline simplification (iterative, stack-based).
 * Keeps endpoints; removes points closer than `epsilon` to the local chord.
 */
export function rdp(points: readonly Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 2) return [...points]
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true

  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number]
    let maxDist = 0
    let maxIdx = -1
    const a = points[first]
    const b = points[last]
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i], a, b)
      if (d > maxDist) {
        maxDist = d
        maxIdx = i
      }
    }
    if (maxDist > epsilon && maxIdx > 0) {
      keep[maxIdx] = true
      stack.push([first, maxIdx], [maxIdx, last])
    }
  }
  return points.filter((_, i) => keep[i])
}
