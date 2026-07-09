import { describe, expect, it } from 'vitest'
import type { Vec2, VelocityPoint } from '@/types'
import { buildLapTimeline } from './lapTimeline'

/** n points evenly spaced on a circle of radius R, uniform speed v. */
function uniformCircle(n: number, radius: number, v: number) {
  const line: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n
    line.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) })
  }
  const segLength = (2 * Math.PI * radius) / n
  const dt = segLength / v
  const velocity: VelocityPoint[] = line.map((_, i) => ({
    s: i * segLength,
    t: i * dt,
    v,
    kappa: 1 / radius,
    aLong: 0,
    limiter: 'corner',
    phase: 'coast',
  }))
  const lineLength = n * segLength
  const lapTime = n * dt
  return { line, velocity, lineLength, lapTime, dt, segLength }
}

describe('buildLapTimeline', () => {
  it('wraps: sample(0) and sample(totalLapTime) coincide', () => {
    const { line, velocity, lineLength, lapTime } = uniformCircle(64, 100, 30)
    const timeline = buildLapTimeline(line, velocity, lineLength, lapTime)
    const a = timeline.sample(0)
    const b = timeline.sample(timeline.totalLapTime)
    expect(b.distance).toBeCloseTo(a.distance, 6)
    expect(b.position.x).toBeCloseTo(a.position.x, 6)
    expect(b.position.y).toBeCloseTo(a.position.y, 6)
  })

  it('total distance covered over a lap matches lap length', () => {
    const { line, velocity, lineLength, lapTime } = uniformCircle(64, 100, 30)
    const timeline = buildLapTimeline(line, velocity, lineLength, lapTime)
    let maxDistance = 0
    const steps = 500
    for (let i = 0; i < steps; i++) {
      const t = (lapTime * i) / steps
      maxDistance = Math.max(maxDistance, timeline.sample(t).distance)
    }
    expect(maxDistance).toBeGreaterThan(lineLength * 0.98)
    expect(maxDistance).toBeLessThanOrEqual(lineLength)
  })

  it('constant speed gives position linear in time', () => {
    const { line, velocity, lineLength, lapTime, v } = { ...uniformCircle(64, 100, 30), v: 30 }
    const timeline = buildLapTimeline(line, velocity, lineLength, lapTime)
    const t1 = lapTime * 0.2
    const t2 = lapTime * 0.5
    const d1 = timeline.sample(t1).distance
    const d2 = timeline.sample(t2).distance
    expect(d2 - d1).toBeCloseTo(v * (t2 - t1), 1)
  })

  it('reports the interpolated speed and phase from the surrounding points', () => {
    const { line, lineLength, lapTime } = uniformCircle(8, 100, 30)
    const velocity: VelocityPoint[] = line.map((_, i) => ({
      s: i * (lineLength / 8),
      t: i * (lapTime / 8),
      v: 20 + i,
      kappa: 0,
      aLong: 1,
      limiter: 'accel',
      phase: 'throttle',
    }))
    const timeline = buildLapTimeline(line, velocity, lineLength, lapTime)
    const midT = (velocity[0].t + velocity[1].t) / 2
    const sample = timeline.sample(midT)
    expect(sample.speedMs).toBeCloseTo((velocity[0].v + velocity[1].v) / 2, 3)
    expect(sample.phase).toBe('throttle')
  })

  it('returns a degenerate zero sample when there is no line', () => {
    const timeline = buildLapTimeline([], [], 0, 0)
    expect(timeline.totalLapTime).toBe(0)
    expect(timeline.sample(5)).toEqual({
      position: { x: 0, y: 0 },
      heading: 0,
      speedMs: 0,
      phase: 'coast',
      distance: 0,
    })
  })
})
