import { describe, expect, it } from 'vitest'
import type { Vec2 } from '@/types'
import {
  buildTrackFromStroke,
  isClosable,
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
