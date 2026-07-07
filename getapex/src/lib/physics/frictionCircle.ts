import type { CarSetup } from '@/types'
import { GRAVITY } from './constants'
import { downforce } from './aero'

/** Normal load including downforce at speed v (N). */
export const normalLoad = (car: CarSetup, v: number): number =>
  car.mass * GRAVITY + downforce(car.clA, v)

/** Total grip-limited acceleration μ·g_eff at speed v (m/s²). */
export const gripAccel = (car: CarSetup, v: number): number =>
  (car.muTire * normalLoad(car, v)) / car.mass

/**
 * Friction circle: longitudinal acceleration capacity left after spending
 * `aLat` laterally, at speed v. √(a_grip² − a_lat²), floored at 0.
 */
export function remainingLongAccel(car: CarSetup, v: number, aLat: number): number {
  const aGrip = gripAccel(car, v)
  const rest = aGrip * aGrip - aLat * aLat
  return rest > 0 ? Math.sqrt(rest) : 0
}
