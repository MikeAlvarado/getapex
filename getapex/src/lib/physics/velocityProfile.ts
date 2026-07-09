import type { CarSetup, Phase, SpeedLimiter } from '@/types'
import { AIR_DENSITY, GRAVITY, ROLLING_RESISTANCE, V_CEILING } from './constants'
import { dragForce } from './aero'
import { remainingLongAccel } from './frictionCircle'

/** Floor on the speed used for segment-time division (guards divide-by-zero). */
const V_TIME_GUARD = 0.1
/** Fraction of a car's peak accel/brake capability that reads as coasting. */
const COAST_FRACTION = 0.03

/**
 * Coast-band half-width (m/s²) for a given car. Scaled to the car's own peak
 * accel/brake capability rather than a fixed absolute number: an F1 car's
 * apex-region aLong swings tens of m/s², so a fixed ~0.25 m/s² band (tuned
 * for a go-kart) is crossed in a single sample and coast never registers.
 */
function coastEpsilon(car: CarSetup): number {
  return (COAST_FRACTION * Math.max(car.tractionForceMax, car.brakeForceMax)) / car.mass
}

/** Throttle/brake/coast from the sign of longitudinal acceleration. */
export function phaseFromALong(aLong: number, epsilon: number): Phase {
  if (aLong > epsilon) return 'throttle'
  if (aLong < -epsilon) return 'brake'
  return 'coast'
}

const rollForce = (car: CarSetup): number => ROLLING_RESISTANCE * car.mass * GRAVITY

/** Engine/drivetrain drive force at speed v (N): traction cap vs power curve. */
export const driveForce = (car: CarSetup, v: number): number =>
  Math.min(car.tractionForceMax, car.powerMax / Math.max(v, 1))

/** Top speed where drive force equals drag + rolling resistance (bisection). */
export function terminalVelocity(car: CarSetup): number {
  const surplus = (v: number): number => driveForce(car, v) - dragForce(car.cdA, v) - rollForce(car)
  if (surplus(V_CEILING) >= 0) return V_CEILING
  let lo = 1
  let hi = V_CEILING
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (surplus(mid) > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Grip-limited cornering speed at curvature κ, downforce included:
 * m·v²·κ ≤ μ·(m·g + ½·ρ·ClA·v²)  ⇒  v² = μ·m·g / (m·κ − ½·μ·ρ·ClA).
 * When the denominator ≤ 0, downforce grows grip faster than the lateral
 * demand — speed is unbounded by grip and `vCap` applies.
 */
export function cornerSpeedLimit(kappa: number, car: CarSetup, vCap: number): number {
  const k = Math.abs(kappa)
  if (k < 1e-9) return vCap
  const denom = car.mass * k - 0.5 * car.muTire * AIR_DENSITY * car.clA
  if (denom <= 0) return vCap
  return Math.min(vCap, Math.sqrt((car.muTire * car.mass * GRAVITY) / denom))
}

export interface VelocityProfile {
  /** Speed per point (m/s) */
  v: number[]
  /** Longitudinal acceleration over the segment leaving each point (m/s²) */
  aLong: number[]
  limiter: SpeedLimiter[]
  phase: Phase[]
  /** Cumulative lap distance at each point (m) */
  s: number[]
  /** Cumulative lap time at each point (s) */
  t: number[]
  lapTime: number
}

/**
 * Quasi-steady-state velocity profile over a closed line.
 *
 * `kappa[i]` is the (signed or unsigned) curvature at point i;
 * `segLengths[i]` is the distance from point i to point i+1 (wrapping).
 *
 * Three constraints per point, combined as v = min(corner, forward, backward):
 * 1. grip-limited corner speed (downforce-aware),
 * 2. forward pass — drive force minus drag/rolling, friction-circle bounded,
 * 3. backward pass — braking force friction-circle bounded, drag assists.
 * Passes start at the global corner-speed minimum and sweep two laps so the
 * closed loop converges across the wrap.
 */
export function computeVelocityProfile(
  kappa: readonly number[],
  segLengths: readonly number[],
  car: CarSetup,
): VelocityProfile {
  const n = kappa.length
  const vCap = terminalVelocity(car)
  const v = new Array<number>(n)
  const limiter = new Array<SpeedLimiter>(n).fill('corner')
  for (let i = 0; i < n; i++) v[i] = cornerSpeedLimit(kappa[i], car, vCap)

  let startIdx = 0
  for (let i = 1; i < n; i++) if (v[i] < v[startIdx]) startIdx = i

  // Forward pass: acceleration-limited.
  for (let step = 0; step < 2 * n; step++) {
    const i = (startIdx + step) % n
    const next = (i + 1) % n
    const vi = v[i]
    const aLat = vi * vi * Math.abs(kappa[i])
    const aTraction = Math.min(driveForce(car, vi) / car.mass, remainingLongAccel(car, vi, aLat))
    const aNet = aTraction - (dragForce(car.cdA, vi) + rollForce(car)) / car.mass
    const vNext = Math.sqrt(Math.max(0.01, vi * vi + 2 * aNet * segLengths[i]))
    if (vNext < v[next] - 1e-9) {
      v[next] = vNext
      limiter[next] = 'accel'
    }
  }

  // Backward pass: braking-limited.
  for (let step = 0; step < 2 * n; step++) {
    const i = (startIdx - step + 2 * n * n) % n
    const prev = (i - 1 + n) % n
    const vi = v[i]
    const aLat = vi * vi * Math.abs(kappa[i])
    const aBrakeGrip = Math.min(car.brakeForceMax / car.mass, remainingLongAccel(car, vi, aLat))
    const aTotal = aBrakeGrip + (dragForce(car.cdA, vi) + rollForce(car)) / car.mass
    const vPrev = Math.sqrt(vi * vi + 2 * aTotal * segLengths[prev])
    if (vPrev < v[prev] - 1e-9) {
      v[prev] = vPrev
      limiter[prev] = 'brake'
    }
  }

  const s = new Array<number>(n)
  const t = new Array<number>(n)
  const aLong = new Array<number>(n)
  const phase = new Array<Phase>(n)
  const epsilon = coastEpsilon(car)
  let lapTime = 0
  let acc = 0
  for (let i = 0; i < n; i++) {
    s[i] = acc
    t[i] = lapTime
    acc += segLengths[i]
    const next = (i + 1) % n
    aLong[i] = (v[next] * v[next] - v[i] * v[i]) / (2 * segLengths[i])
    phase[i] = phaseFromALong(aLong[i], epsilon)
    lapTime += segLengths[i] / Math.max((v[i] + v[next]) / 2, V_TIME_GUARD)
  }
  return { v, aLong, limiter, phase, s, t, lapTime }
}
