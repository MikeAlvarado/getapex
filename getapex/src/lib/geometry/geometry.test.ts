import { describe, expect, it } from 'vitest'
import type { Vec2 } from '@/types'
import { rdp } from './rdp'
import { sampleClosedBezierPath, type BezierAnchor } from './bezier'
import { sampleClosedCatmullRom } from './catmullRom'
import { closedLength, resampleClosedByArcLength } from './resample'
import { closedCurvature, menger } from './curvature'
import { closedNormals, offsetClosedPath } from './offsetPath'
import { dist, len } from './vec2'

const circle = (radius: number, count: number, ccw = true): Vec2[] =>
  Array.from({ length: count }, (_, i) => {
    const theta = ((ccw ? 1 : -1) * 2 * Math.PI * i) / count
    return { x: radius * Math.cos(theta), y: radius * Math.sin(theta) }
  })

describe('rdp', () => {
  it('removes collinear points', () => {
    const pts: Vec2[] = Array.from({ length: 11 }, (_, i) => ({ x: i, y: 0 }))
    expect(rdp(pts, 0.01)).toEqual([pts[0], pts[10]])
  })

  it('keeps a significant corner', () => {
    const pts: Vec2[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0.001 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    const out = rdp(pts, 0.1)
    expect(out).toEqual([pts[0], pts[2], pts[3]])
  })
})

describe('sampleClosedCatmullRom', () => {
  it('interpolates the control points', () => {
    const controls = circle(100, 12)
    const samples = sampleClosedCatmullRom(controls, 8)
    expect(samples).toHaveLength(96)
    for (let i = 0; i < controls.length; i++) {
      expect(dist(samples[i * 8], controls[i])).toBeLessThan(1e-9)
    }
  })

  it('stays close to the circle it was sampled from', () => {
    const samples = sampleClosedCatmullRom(circle(100, 24), 10)
    for (const p of samples) {
      expect(len(p)).toBeGreaterThan(98)
      expect(len(p)).toBeLessThan(102)
    }
  })
})

describe('resampleClosedByArcLength', () => {
  it('produces uniform spacing that sums to the loop length', () => {
    const square: Vec2[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const { points, ds, length } = resampleClosedByArcLength(square, 7)
    expect(length).toBeCloseTo(400)
    expect(ds * points.length).toBeCloseTo(400)
    for (let i = 0; i < points.length; i++) {
      const d = dist(points[i], points[(i + 1) % points.length])
      // corners cut the chord slightly short; never longer than ds
      expect(d).toBeLessThanOrEqual(ds + 1e-9)
      expect(d).toBeGreaterThan(0)
    }
  })

  it('closedLength of a circle approaches 2πR', () => {
    expect(closedLength(circle(50, 720))).toBeCloseTo(2 * Math.PI * 50, 0)
  })
})

describe('curvature', () => {
  it('menger curvature of circle points is 1/R signed by winding', () => {
    const ccw = circle(50, 360)
    const cw = circle(50, 360, false)
    expect(menger(ccw[0], ccw[1], ccw[2])).toBeCloseTo(1 / 50, 5)
    expect(menger(cw[0], cw[1], cw[2])).toBeCloseTo(-1 / 50, 5)
  })

  it('closedCurvature is uniform on a circle', () => {
    const kappa = closedCurvature(circle(200, 500))
    for (const k of kappa) expect(k).toBeCloseTo(1 / 200, 6)
  })

  it('is zero on straights', () => {
    expect(menger({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(0)
  })
})

describe('normals + offset', () => {
  it('offsets a CCW circle inward with positive distance (left normal)', () => {
    const pts = circle(100, 360)
    const normals = closedNormals(pts)
    const inner = offsetClosedPath(pts, normals, 10)
    for (const p of inner) expect(len(p)).toBeCloseTo(90, 1)
    const outer = offsetClosedPath(pts, normals, -10)
    for (const p of outer) expect(len(p)).toBeCloseTo(110, 1)
  })

  it('normals are unit length', () => {
    for (const nrm of closedNormals(circle(100, 100))) {
      expect(len(nrm)).toBeCloseTo(1, 9)
    }
  })
})

describe('sampleClosedBezierPath', () => {
  const corner = (x: number, y: number): BezierAnchor => ({
    point: { x, y },
    handleIn: null,
    handleOut: null,
  })

  it('degenerates to straight segments when anchors have no handles', () => {
    const square = [corner(0, 0), corner(100, 0), corner(100, 100), corner(0, 100)]
    const samples = sampleClosedBezierPath(square, 10)
    expect(samples).toHaveLength(40)
    expect(closedLength(samples)).toBeCloseTo(400, 6)
    // every sample lies on the square's perimeter (within float tolerance)
    const near = (v: number, target: number): boolean => Math.abs(v - target) < 1e-9
    const inside = (v: number): boolean => v > -1e-9 && v < 100 + 1e-9
    for (const p of samples) {
      const onEdge =
        ((near(p.x, 0) || near(p.x, 100)) && inside(p.y)) ||
        ((near(p.y, 0) || near(p.y, 100)) && inside(p.x))
      expect(onEdge).toBe(true)
    }
  })

  it('starts each segment at its anchor without duplicating joins', () => {
    const tri = [corner(0, 0), corner(50, 0), corner(25, 40)]
    const samples = sampleClosedBezierPath(tri, 8)
    for (let i = 0; i < tri.length; i++) {
      expect(dist(samples[i * 8], tri[i].point)).toBeLessThan(1e-12)
      expect(dist(samples[i * 8 + 7], tri[(i + 1) % 3].point)).toBeGreaterThan(1e-6)
    }
  })

  it('approximates a circle with four smooth anchors', () => {
    // classic 4-arc cubic circle: handle length = r * 0.5523
    const r = 100
    const h = r * 0.5523
    const anchors: BezierAnchor[] = [
      { point: { x: r, y: 0 }, handleIn: { x: r, y: -h }, handleOut: { x: r, y: h } },
      { point: { x: 0, y: r }, handleIn: { x: h, y: r }, handleOut: { x: -h, y: r } },
      { point: { x: -r, y: 0 }, handleIn: { x: -r, y: h }, handleOut: { x: -r, y: -h } },
      { point: { x: 0, y: -r }, handleIn: { x: -h, y: -r }, handleOut: { x: h, y: -r } },
    ]
    for (const p of sampleClosedBezierPath(anchors, 24)) {
      expect(len(p)).toBeGreaterThan(r * 0.999)
      expect(len(p)).toBeLessThan(r * 1.001)
    }
  })
})
