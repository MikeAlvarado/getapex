import { describe, expect, it } from 'vitest'
import type { CarSetup } from '@/types'
import { GRAVITY, AIR_DENSITY } from './constants'
import { dragForce, downforce } from './aero'
import { gripAccel, remainingLongAccel } from './frictionCircle'
import {
  cornerSpeedLimit,
  computeVelocityProfile,
  driveForce,
  terminalVelocity,
} from './velocityProfile'

const gt3: CarSetup = {
  name: 'GT3',
  mass: 1300,
  powerMax: 400_000,
  cdA: 1.1,
  clA: 3.0,
  muTire: 1.4,
  brakeForceMax: 22_000,
  tractionForceMax: 13_000,
  width: 2.0,
}

/** Two straights + two semicircular ends, points spaced ~ds apart. */
function stadium(radius: number, straight: number, ds: number) {
  const pts = []
  const straightSteps = Math.round(straight / ds)
  const arcSteps = Math.round((Math.PI * radius) / ds)
  for (let i = 0; i < straightSteps; i++) pts.push({ x: -straight / 2 + i * ds, y: -radius })
  for (let i = 0; i < arcSteps; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / arcSteps
    pts.push({ x: straight / 2 + radius * Math.cos(t), y: radius * Math.sin(t) })
  }
  for (let i = 0; i < straightSteps; i++) pts.push({ x: straight / 2 - i * ds, y: radius })
  for (let i = 0; i < arcSteps; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / arcSteps
    pts.push({ x: -straight / 2 + radius * Math.cos(t), y: radius * Math.sin(t) })
  }
  return pts
}

describe('aero', () => {
  it('drag and downforce scale with v²', () => {
    expect(dragForce(1.0, 50)).toBeCloseTo(0.5 * AIR_DENSITY * 2500)
    expect(downforce(2.0, 10)).toBeCloseTo(0.5 * AIR_DENSITY * 2 * 100)
  })
})

describe('friction circle', () => {
  it('full lateral usage leaves zero longitudinal capacity', () => {
    const aGrip = gripAccel(gt3, 40)
    expect(remainingLongAccel(gt3, 40, aGrip)).toBe(0)
    expect(remainingLongAccel(gt3, 40, aGrip * 1.1)).toBe(0)
  })

  it('zero lateral usage leaves full grip', () => {
    expect(remainingLongAccel(gt3, 40, 0)).toBeCloseTo(gripAccel(gt3, 40))
  })

  it('downforce increases grip with speed', () => {
    expect(gripAccel(gt3, 60)).toBeGreaterThan(gripAccel(gt3, 10))
  })
})

describe('cornerSpeedLimit', () => {
  it('matches √(μgR) without downforce', () => {
    const noAero = { ...gt3, clA: 0 }
    const R = 100
    expect(cornerSpeedLimit(1 / R, noAero, 500)).toBeCloseTo(
      Math.sqrt(noAero.muTire * GRAVITY * R),
      6,
    )
  })

  it('downforce raises corner speed', () => {
    expect(cornerSpeedLimit(1 / 100, gt3, 500)).toBeGreaterThan(
      cornerSpeedLimit(1 / 100, { ...gt3, clA: 0 }, 500),
    )
  })

  it('caps at vCap when downforce makes grip unbounded', () => {
    // huge ClA → denominator ≤ 0 in a fast corner
    const wing = { ...gt3, clA: 50 }
    expect(cornerSpeedLimit(1 / 500, wing, 90)).toBe(90)
  })

  it('near-zero curvature returns the cap', () => {
    expect(cornerSpeedLimit(0, gt3, 85)).toBe(85)
  })
})

describe('terminalVelocity', () => {
  it('balances drive force against drag + rolling resistance', () => {
    const vT = terminalVelocity(gt3)
    expect(vT).toBeGreaterThan(60)
    expect(vT).toBeLessThan(120)
    const resist = dragForce(gt3.cdA, vT) + 0.012 * gt3.mass * GRAVITY
    expect(driveForce(gt3, vT)).toBeCloseTo(resist, 0)
  })

  it('more drag lowers top speed', () => {
    expect(terminalVelocity({ ...gt3, cdA: 2.0 })).toBeLessThan(terminalVelocity(gt3))
  })

  it('more power raises top speed', () => {
    expect(terminalVelocity({ ...gt3, powerMax: 600_000 })).toBeGreaterThan(terminalVelocity(gt3))
  })
})

describe('computeVelocityProfile', () => {
  it('holds near the grip limit on a constant-radius circle', () => {
    const R = 100
    const n = 360
    const kappa = new Array<number>(n).fill(1 / R)
    const seg = new Array<number>(n).fill((2 * Math.PI * R) / n)
    const { v, lapTime } = computeVelocityProfile(kappa, seg, gt3)
    const limit = cornerSpeedLimit(1 / R, gt3, terminalVelocity(gt3))
    for (const vi of v) {
      expect(vi).toBeLessThanOrEqual(limit + 1e-6)
      expect(vi).toBeGreaterThan(limit * 0.95) // drag steals a little capacity
    }
    const meanV = v.reduce((a, b) => a + b, 0) / n
    expect(lapTime).toBeCloseTo((2 * Math.PI * R) / meanV, 1)
  })

  it('brakes before hairpins and accelerates out of them', () => {
    const ds = 5
    const pts = stadium(60, 400, ds)
    const n = pts.length
    const kappa = pts.map((_, i) => {
      // curvature from geometry: on arcs 1/60, straights 0
      const a = pts[(i - 1 + n) % n]
      const b = pts[i]
      const c = pts[(i + 1) % n]
      const crossZ = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
      const d =
        Math.hypot(b.x - a.x, b.y - a.y) *
        Math.hypot(c.x - b.x, c.y - b.y) *
        Math.hypot(c.x - a.x, c.y - a.y)
      return d > 0 ? (2 * crossZ) / d : 0
    })
    const seg = pts.map((p, i) => Math.hypot(pts[(i + 1) % n].x - p.x, pts[(i + 1) % n].y - p.y))
    const { v, limiter } = computeVelocityProfile(kappa, seg, gt3)

    expect(limiter).toContain('brake')
    expect(limiter).toContain('accel')
    expect(limiter).toContain('corner')

    const vMax = Math.max(...v)
    const vMin = Math.min(...v)
    const cornerLimit = cornerSpeedLimit(1 / 60, gt3, terminalVelocity(gt3))
    expect(vMin).toBeLessThanOrEqual(cornerLimit + 1e-6)
    expect(vMax).toBeGreaterThan(cornerLimit * 1.3) // gets going on the straight

    // every brake-limited point must eventually lead into a corner-limited one
    const firstBrake = limiter.indexOf('brake')
    let idx = firstBrake
    while (limiter[idx] === 'brake') idx = (idx + 1) % n
    expect(limiter[idx]).toBe('corner')
  })

  it('a grippier car carries more speed everywhere on a circle', () => {
    const n = 200
    const kappa = new Array<number>(n).fill(1 / 80)
    const seg = new Array<number>(n).fill(2.5)
    const soft = computeVelocityProfile(kappa, seg, gt3)
    const hard = computeVelocityProfile(kappa, seg, { ...gt3, muTire: 1.1 })
    expect(Math.min(...soft.v)).toBeGreaterThan(Math.min(...hard.v))
    expect(soft.lapTime).toBeLessThan(hard.lapTime)
  })
})
