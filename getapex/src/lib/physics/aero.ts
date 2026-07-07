import { AIR_DENSITY } from './constants'

/** Aerodynamic drag force at speed v (N). */
export const dragForce = (cdA: number, v: number): number => 0.5 * AIR_DENSITY * cdA * v * v

/** Aerodynamic downforce at speed v (N). */
export const downforce = (clA: number, v: number): number => 0.5 * AIR_DENSITY * clA * v * v
