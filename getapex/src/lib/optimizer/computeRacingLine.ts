import type { CarSetup, RacingLineResult, Track, VelocityPoint } from '@/types'
import { closedCurvature } from '@/lib/geometry/curvature'
import { closedNormals } from '@/lib/geometry/offsetPath'
import { dist } from '@/lib/geometry/vec2'
import { usableHalfWidth } from '@/lib/track/buildTrack'
import { computeVelocityProfile } from '@/lib/physics/velocityProfile'
import { minimizeCurvature } from './minCurvature'
import { detectCorners } from './corners'

/**
 * Full pipeline: track + car → optimal line, velocity profile, corners,
 * lap time. Pure and synchronous — the worker is just a thin wrapper.
 */
export function computeRacingLine(track: Track, car: CarSetup): RacingLineResult {
  const normals = closedNormals(track.centerline)
  const halfWidth = usableHalfWidth(track, car.width)

  const { alpha, line } = minimizeCurvature({
    centerline: track.centerline,
    normals,
    halfWidth,
  })

  const n = line.length
  const segLengths = line.map((p, i) => dist(p, line[(i + 1) % n]))
  const kappa = closedCurvature(line)
  const profile = computeVelocityProfile(kappa, segLengths, car)
  const corners = detectCorners({ kappa, v: profile.v, limiter: profile.limiter, segLengths })

  const velocity: VelocityPoint[] = profile.v.map((v, i) => ({
    s: profile.s[i],
    t: profile.t[i],
    v,
    kappa: Math.abs(kappa[i]),
    aLong: profile.aLong[i],
    limiter: profile.limiter[i],
    phase: profile.phase[i],
  }))

  return {
    line,
    alpha,
    velocity,
    corners,
    lapTime: profile.lapTime,
    lineLength: segLengths.reduce((a, b) => a + b, 0),
    trackLength: track.length,
  }
}
