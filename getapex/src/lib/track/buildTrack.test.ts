import { describe, expect, it } from 'vitest'
import type { Track, Vec2 } from '@/types'
import {
  buildTrackFromStroke,
  clampTrackWidth,
  isClosable,
  maxSafeWidth,
  trackBoundaries,
  usableHalfWidth,
  TrackBuildError,
} from './buildTrack'
import { dist, len } from '@/lib/geometry/vec2'

const noisyCircleStroke = (radius: number, gapDeg = 10): Vec2[] => {
  const pts: Vec2[] = []
  const endDeg = 360 - gapDeg
  for (let deg = 0; deg <= endDeg; deg += 1) {
    const theta = (deg * Math.PI) / 180
    // deterministic jitter to mimic hand shake
    const wobble = 1.5 * Math.sin(deg * 1.7)
    pts.push({
      x: (radius + wobble) * Math.cos(theta),
      y: (radius + wobble) * Math.sin(theta),
    })
  }
  return pts
}

const circleCenterline = (radius: number, count: number): Vec2[] =>
  Array.from({ length: count }, (_, i) => {
    const theta = (2 * Math.PI * i) / count
    return { x: radius * Math.cos(theta), y: radius * Math.sin(theta) }
  })

describe('buildTrackFromStroke', () => {
  it('closes a nearly-closed noisy loop and resamples uniformly', () => {
    const track = buildTrackFromStroke(noisyCircleStroke(300), {
      id: 't',
      name: 'Test',
      width: 12,
      margin: 0.5,
    })
    expect(track.centerline.length).toBeGreaterThan(100)
    expect(track.length).toBeGreaterThan(1600)
    // uniform spacing
    const n = track.centerline.length
    for (let i = 0; i < n; i++) {
      const d = dist(track.centerline[i], track.centerline[(i + 1) % n])
      expect(d).toBeCloseTo(track.ds, 0)
    }
    // smoothing keeps it near the drawn radius
    for (const p of track.centerline) {
      expect(len(p)).toBeGreaterThan(285)
      expect(len(p)).toBeLessThan(315)
    }
  })

  it('rejects an open stroke', () => {
    const open = noisyCircleStroke(300, 120)
    expect(isClosable(open)).toBe(false)
    expect(() => buildTrackFromStroke(open, { id: 't', name: 'T', width: 12, margin: 0 })).toThrow(
      TrackBuildError,
    )
  })

  it('rejects tiny strokes', () => {
    expect(() =>
      buildTrackFromStroke(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        { id: 't', name: 'T', width: 12, margin: 0 },
      ),
    ).toThrow(TrackBuildError)
  })
})

describe('trackBoundaries / usableHalfWidth', () => {
  it('offsets boundaries by half width each side', () => {
    const track = buildTrackFromStroke(noisyCircleStroke(300), {
      id: 't',
      name: 'T',
      width: 12,
      margin: 0.5,
    })
    const { left, right } = trackBoundaries(track)
    for (let i = 0; i < track.centerline.length; i += 25) {
      expect(dist(left[i], right[i])).toBeCloseTo(12, 1)
    }
  })

  it('usable half width subtracts car and margin, floored above zero', () => {
    const track = buildTrackFromStroke(noisyCircleStroke(300), {
      id: 't',
      name: 'T',
      width: 12,
      margin: 0.5,
    })
    expect(usableHalfWidth(track, 2)).toBeCloseTo(12 / 2 - 1 - 0.5)
    expect(usableHalfWidth({ ...track, width: 2 }, 4)).toBe(0.2)
  })
})

describe('maxSafeWidth / clampTrackWidth', () => {
  it('is Infinity for a dead-straight centerline', () => {
    const line: Vec2[] = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 }))
    expect(maxSafeWidth(line)).toBe(Infinity)
  })

  it('shrinks toward zero as a corner tightens', () => {
    const gentle = circleCenterline(200, 64)
    const tight = circleCenterline(20, 64)
    expect(maxSafeWidth(tight)).toBeLessThan(maxSafeWidth(gentle))
  })

  it('a track built around a tight corner never self-intersects at its own width', () => {
    // A stroke that loops out to a hairpin: the RDP+Catmull-Rom pipeline can
    // sharpen corners beyond what the requested width supports.
    const stroke = noisyCircleStroke(60)
    const track = buildTrackFromStroke(stroke, { id: 't', name: 'T', width: 25, margin: 0.5 })
    const kappaBound = maxSafeWidth(track.centerline)
    expect(track.width).toBeLessThanOrEqual(kappaBound + 1e-9)
  })

  it('rejects a corridor too pinched for any reasonable width', () => {
    // A tight figure-eight-ish stroke folds back on itself hard enough that
    // no positive width keeps the boundary from crossing.
    const pts: Vec2[] = []
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI * 2
      pts.push({ x: 12 * Math.cos(t), y: 4 * Math.sin(2 * t) })
    }
    expect(() =>
      buildTrackFromStroke(pts, { id: 't', name: 'T', width: 12, margin: 0.5 }),
    ).toThrow(TrackBuildError)
  })

  it('clampTrackWidth caps an imported track to its own safe width', () => {
    const track: Track = {
      id: 't',
      name: 'T',
      centerline: circleCenterline(20, 64),
      ds: 2,
      width: 100,
      margin: 0.5,
      length: 2 * Math.PI * 20,
    }
    const clamped = clampTrackWidth(track)
    expect(clamped.width).toBeLessThan(track.width)
    expect(clamped.width).toBeCloseTo(maxSafeWidth(track.centerline))
  })

  it('clampTrackWidth is a no-op when already safe', () => {
    const track: Track = {
      id: 't',
      name: 'T',
      centerline: circleCenterline(200, 64),
      ds: 2,
      width: 12,
      margin: 0.5,
      length: 2 * Math.PI * 200,
    }
    expect(clampTrackWidth(track)).toBe(track)
  })
})
