import type { Units } from '@/types'

export const msToKmh = (v: number): number => v * 3.6
export const msToMph = (v: number): number => v * 2.23694

/** Speed (m/s) → display number in the active units. */
export const speedValue = (v: number, units: Units): number =>
  units === 'metric' ? msToKmh(v) : msToMph(v)

export const speedUnit = (units: Units): string => (units === 'metric' ? 'km/h' : 'mph')

export const formatSpeed = (v: number, units: Units): string =>
  `${Math.round(speedValue(v, units))} ${speedUnit(units)}`

/** Distance (m) → compact display string in the active units. */
export function formatDistance(meters: number, units: Units): string {
  if (units === 'metric') {
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
  }
  const feet = meters * 3.28084
  return feet >= 2640 ? `${(meters / 1609.344).toFixed(2)} mi` : `${Math.round(feet)} ft`
}

/** Lap time (s) → m:ss.mmm */
export function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`
}
