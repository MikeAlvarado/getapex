import type { CarPresetId, CarSetup, Track, Units, Vec2 } from '@/types'
import { clampTrackWidth } from '@/lib/track/buildTrack'
import { useStore } from './store'

const STORAGE_KEY = 'getapex:v1'
export const EXPORT_VERSION = 1

export interface PersistedState {
  version: number
  track: Track | null
  trackWidth: number
  margin: number
  car: CarSetup
  presetId: CarPresetId | 'custom'
  units: Units
}

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

const isVec2 = (x: unknown): x is Vec2 =>
  typeof x === 'object' && x !== null && isNumber((x as Vec2).x) && isNumber((x as Vec2).y)

export function isTrack(x: unknown): x is Track {
  if (typeof x !== 'object' || x === null) return false
  const t = x as Track
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    Array.isArray(t.centerline) &&
    t.centerline.length >= 32 &&
    t.centerline.every(isVec2) &&
    isNumber(t.ds) &&
    isNumber(t.width) &&
    t.width > 0 &&
    isNumber(t.margin) &&
    isNumber(t.length)
  )
}

export function isCarSetup(x: unknown): x is CarSetup {
  if (typeof x !== 'object' || x === null) return false
  const c = x as CarSetup
  return (
    typeof c.name === 'string' &&
    isNumber(c.mass) &&
    c.mass > 0 &&
    isNumber(c.powerMax) &&
    isNumber(c.cdA) &&
    isNumber(c.clA) &&
    isNumber(c.muTire) &&
    c.muTire > 0 &&
    isNumber(c.brakeForceMax) &&
    isNumber(c.tractionForceMax) &&
    isNumber(c.width) &&
    c.width > 0
  )
}

export function loadPersisted(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return {}
    const d = data as Record<string, unknown>
    const out: Partial<PersistedState> = {}
    if (isTrack(d.track)) {
      out.track = clampTrackWidth(d.track)
      out.trackWidth = out.track.width
    } else if (isNumber(d.trackWidth)) {
      out.trackWidth = d.trackWidth
    }
    if (isNumber(d.margin)) out.margin = d.margin
    if (isCarSetup(d.car)) out.car = d.car
    if (d.presetId === 'custom' || typeof d.presetId === 'string') {
      out.presetId = d.presetId as CarPresetId | 'custom'
    }
    if (d.units === 'metric' || d.units === 'imperial') out.units = d.units
    return out
  } catch {
    return {}
  }
}

/** Hydrate the store from localStorage and save (debounced) on every change. */
export function initPersistence(): void {
  const persisted = loadPersisted()
  if (Object.keys(persisted).length > 0) {
    useStore.setState(persisted)
  }

  let timer = 0
  useStore.subscribe((state) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const snapshot: PersistedState = {
        version: EXPORT_VERSION,
        track: state.track,
        trackWidth: state.trackWidth,
        margin: state.margin,
        car: state.car,
        presetId: state.presetId,
        units: state.units,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      } catch {
        // storage full or unavailable — persistence is best-effort
      }
    }, 500)
  })
}
