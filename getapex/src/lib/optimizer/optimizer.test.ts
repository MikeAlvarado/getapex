import { describe, expect, it } from 'vitest'
import type { CarSetup, Track, Vec2 } from '@/types'
import { closedNormals } from '@/lib/geometry/offsetPath'
import { closedCurvature } from '@/lib/geometry/curvature'
import { closedLength } from '@/lib/geometry/resample'
import { len } from '@/lib/geometry/vec2'
import { minimizeCurvature } from './minCurvature'
import { detectCorners } from './corners'
import { computeRacingLine } from './computeRacingLine'

const circle = (radius: number, count: number): Vec2[] =>
  Array.from({ length: count }, (_, i) => {
    const theta = (2 * Math.PI * i) / count
    return { x: radius * Math.cos(theta), y: radius * Math.sin(theta) }
  })

/** Rounded square: four straights + four 90° arcs, ~ds spacing, CCW. */
function roundedSquare(half: number, r: number, ds: number): Vec2[] {
  const pts: Vec2[] = []
  const straightLen = 2 * (half - r)
  const straightSteps = Math.round(straightLen / ds)
  const arcSteps = Math.round(((Math.PI / 2) * r) / ds)
  const corners = [
    { cx: half - r, cy: half - r, a0: 0 },
    { cx: -(half - r), cy: half - r, a0: Math.PI / 2 },
    { cx: -(half - r), cy: -(half - r), a0: Math.PI },
    { cx: half - r, cy: -(half - r), a0: (3 * Math.PI) / 2 },
  ]
  for (let side = 0; side < 4; side++) {
    const { cx, cy, a0 } = corners[side]
    for (let i = 0; i < straightSteps; i++) {
      const t = -(half - r) + (i * straightLen) / straightSteps
      if (side === 0) pts.push({ x: half, y: t })
      if (side === 1) pts.push({ x: -t, y: half })
      if (side === 2) pts.push({ x: -half, y: -t })
      if (side === 3) pts.push({ x: t, y: -half })
    }
    for (let i = 0; i < arcSteps; i++) {
      const a = a0 + ((Math.PI / 2) * i) / arcSteps
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    }
  }
  return pts
}

/** Stadium loop as a Track (two straights + two semicircle ends). */
function stadiumTrack(radius: number, straight: number, ds: number): Track {
  const pts: Vec2[] = []
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
  return {
    id: 'stadium',
    name: 'Stadium',
    centerline: pts,
    ds,
    width: 12,
    margin: 0.5,
    length: closedLength(pts),
  }
}

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

describe('minimizeCurvature', () => {
  it('drives out-in-out through a 90° corner', () => {
    const centerline = roundedSquare(150, 40, 4)
    const normals = closedNormals(centerline) // CCW → normals point inward
    const result = minimizeCurvature({ centerline, normals, halfWidth: 4.5 })

    expect(result.finalEnergy).toBeLessThan(result.initialEnergy)
    for (const a of result.alpha) {
      expect(a).toBeGreaterThanOrEqual(-1)
      expect(a).toBeLessThanOrEqual(1)
    }

    const straightSteps = Math.round(220 / 4)
    const arcSteps = Math.round(((Math.PI / 2) * 40) / 4)
    const apexIdx = straightSteps + Math.round(arcSteps / 2)
    // apex hugs the inside edge…
    expect(result.alpha[apexIdx]).toBeGreaterThan(0.9)
    // …while entry and exit run toward the outside
    expect(result.alpha[straightSteps - 5]).toBeLessThan(-0.1)
    expect(result.alpha[straightSteps + arcSteps + 5]).toBeLessThan(-0.1)

    // peak curvature is reduced vs the centerline
    const before = closedCurvature(centerline).map(Math.abs)
    const after = closedCurvature(result.line).map(Math.abs)
    expect(Math.max(...after)).toBeLessThan(Math.max(...before) * 0.95)
  })

  it('keeps the line inside the corridor on a circle (flat objective)', () => {
    const R = 200
    const h = 5
    const centerline = circle(R, 300)
    const result = minimizeCurvature({
      centerline,
      normals: closedNormals(centerline),
      halfWidth: h,
    })
    expect(result.finalEnergy).toBeLessThanOrEqual(result.initialEnergy + 1e-12)
    for (const p of result.line) {
      expect(len(p)).toBeGreaterThanOrEqual(R - h - 1e-6)
      expect(len(p)).toBeLessThanOrEqual(R + h + 1e-6)
    }
  })
})

describe('detectCorners', () => {
  it('finds the two stadium hairpins with braking points', () => {
    const track = stadiumTrack(60, 400, 5)
    const result = computeRacingLine(track, gt3)
    expect(result.corners).toHaveLength(2)
    for (const corner of result.corners) {
      expect(corner.minRadius).toBeGreaterThan(30)
      expect(corner.minRadius).toBeLessThan(120)
      expect(corner.brakingIdx).not.toBeNull()
      expect(corner.brakingDistance).toBeGreaterThan(10)
      expect(corner.apexSpeed).toBeLessThan(corner.entrySpeed + 1e-6)
      expect(corner.apexSpeed).toBeLessThanOrEqual(corner.exitSpeed + 1e-6)
    }
    expect(result.corners[0].number).toBe(1)
    expect(result.corners[1].number).toBe(2)
  })

  it('reports no corners on a giant near-straight loop', () => {
    const kappa = new Array<number>(200).fill(1 / 5000)
    const corners = detectCorners({
      kappa,
      v: new Array(200).fill(80),
      limiter: new Array(200).fill('accel'),
      segLengths: new Array(200).fill(10),
    })
    expect(corners).toHaveLength(0)
  })
})

describe('computeRacingLine — definition-of-done physics checks', () => {
  const track = stadiumTrack(60, 400, 5)

  it('produces a sane lap', () => {
    const r = computeRacingLine(track, gt3)
    expect(r.lapTime).toBeGreaterThan(10)
    expect(r.lapTime).toBeLessThan(120)
    expect(r.line).toHaveLength(track.centerline.length)
    expect(r.velocity).toHaveLength(track.centerline.length)
    expect(r.lineLength).toBeGreaterThan(0)
  })

  it('a grippier car carries more apex speed and laps faster', () => {
    const grippy = computeRacingLine(track, gt3)
    const slick = computeRacingLine(track, { ...gt3, muTire: 1.0 })
    expect(grippy.corners[0].apexSpeed).toBeGreaterThan(slick.corners[0].apexSpeed)
    expect(grippy.lapTime).toBeLessThan(slick.lapTime)
  })

  it('more downforce raises corner speed', () => {
    const wing = computeRacingLine(track, { ...gt3, clA: 5.0 })
    const flat = computeRacingLine(track, { ...gt3, clA: 0.5 })
    expect(wing.corners[0].apexSpeed).toBeGreaterThan(flat.corners[0].apexSpeed)
  })

  it('more drag lowers top speed on the straight', () => {
    const slippery = computeRacingLine(track, gt3)
    const brick = computeRacingLine(track, { ...gt3, cdA: 2.2 })
    const vMax = (r: typeof slippery) => Math.max(...r.velocity.map((p) => p.v))
    expect(vMax(brick)).toBeLessThan(vMax(slippery))
  })
})
