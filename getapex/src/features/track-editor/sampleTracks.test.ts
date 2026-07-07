import { describe, expect, it } from 'vitest'
import { closedCurvature } from '@/lib/geometry/curvature'
import { computeRacingLine } from '@/lib/optimizer/computeRacingLine'
import { CAR_PRESETS } from '@/features/car-config/presets'
import { SAMPLE_TRACKS } from './sampleTracks'

describe('SAMPLE_TRACKS', () => {
  it('has unique ids and names', () => {
    const ids = SAMPLE_TRACKS.map((t) => t.id)
    const names = SAMPLE_TRACKS.map((t) => t.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  for (const track of SAMPLE_TRACKS) {
    it(`${track.name}: centerline curvature stays inside the track corridor`, () => {
      const kappa = closedCurvature(track.centerline)
      const maxAbsKappa = Math.max(...kappa.map(Math.abs))
      const minRadius = 1 / maxAbsKappa
      // The tightest turn must clear the half-width with margin, or the
      // offset boundaries would cross themselves (a physically impossible,
      // self-intersecting track edge).
      expect(minRadius).toBeGreaterThan(track.width / 2 + 2)
    })

    for (const [presetId, car] of Object.entries(CAR_PRESETS)) {
      it(`${track.name} + ${presetId}: computes a finite, sane racing line`, () => {
        const result = computeRacingLine(track, car)
        expect(result.velocity.every((p) => Number.isFinite(p.v) && p.v > 0)).toBe(true)
        expect(Number.isFinite(result.lapTime)).toBe(true)
        expect(result.lapTime).toBeGreaterThan(0)
        expect(result.corners.length).toBeGreaterThan(0)
      })
    }
  }
})
