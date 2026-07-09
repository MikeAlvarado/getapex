import { create } from 'zustand'
import type { CarPresetId, CarSetup, ComputeStatus, RacingLineResult, Track, Units } from '@/types'
import { CAR_PRESETS } from '@/features/car-config/presets'
import { maxSafeWidth } from '@/lib/track/buildTrack'

export interface TrackSlice {
  track: Track | null
  /** Width/margin settings applied to new and existing tracks (m). */
  trackWidth: number
  margin: number
  setTrack: (track: Track | null) => void
  setTrackWidth: (width: number) => void
  setMargin: (margin: number) => void
}

export interface CarSlice {
  car: CarSetup
  presetId: CarPresetId | 'custom'
  applyPreset: (id: CarPresetId) => void
  setCarParam: (key: keyof Omit<CarSetup, 'name'>, value: number) => void
}

export interface ResultsSlice {
  status: ComputeStatus
  result: RacingLineResult | null
  setStatus: (status: ComputeStatus) => void
  setResult: (result: RacingLineResult) => void
}

/** Freehand sketching vs. Illustrator-style pen (anchors + Bézier handles). */
export type DrawMode = 'freehand' | 'pen'

export interface UiSlice {
  units: Units
  /** Active drawing tool for the canvas. */
  drawMode: DrawMode
  /** Straight-segment drawing mode via UI toggle (Shift always works). */
  straightMode: boolean
  /** Index on the racing line highlighted from the speed trace, if any. */
  hoverIndex: number | null
  selectedCorner: number | null
  isDrawing: boolean
  setUnits: (units: Units) => void
  setDrawMode: (mode: DrawMode) => void
  setStraightMode: (on: boolean) => void
  setHoverIndex: (index: number | null) => void
  setSelectedCorner: (corner: number | null) => void
  setIsDrawing: (drawing: boolean) => void
}

/** Playback state machine for the lap simulation. */
export type SimStatus = 'idle' | 'ready' | 'playing' | 'paused'

export interface SimulationSlice {
  simStatus: SimStatus
  isPlaying: boolean
  playbackSpeed: number
  loop: boolean
  /** Throttled (~24fps) lap time snapshot for the HUD/scrubber; the canvas
   * uses a higher-precision clock (see `hooks/usePlayback`) while playing. */
  elapsedTime: number
  lapCount: number
  play: () => void
  pause: () => void
  togglePlay: () => void
  restart: () => void
  setPlaybackSpeed: (speed: number) => void
  setLoop: (loop: boolean) => void
  setElapsedTime: (t: number) => void
  incrementLap: () => void
}

export type AppState = TrackSlice & CarSlice & ResultsSlice & UiSlice & SimulationSlice

export const useStore = create<AppState>((set) => ({
  // track
  track: null,
  trackWidth: 12,
  margin: 0.5,
  setTrack: (track) => set({ track, selectedCorner: null, hoverIndex: null }),
  setTrackWidth: (trackWidth) =>
    set((s) => {
      const width = s.track ? Math.min(trackWidth, maxSafeWidth(s.track.centerline)) : trackWidth
      return { trackWidth: width, track: s.track ? { ...s.track, width } : null }
    }),
  setMargin: (margin) =>
    set((s) => ({
      margin,
      track: s.track ? { ...s.track, margin } : null,
    })),

  // car
  car: CAR_PRESETS.gt3,
  presetId: 'gt3',
  applyPreset: (id) => set({ presetId: id, car: CAR_PRESETS[id] }),
  setCarParam: (key, value) =>
    set((s) => ({
      presetId: 'custom',
      car: { ...s.car, name: 'Custom', [key]: value },
    })),

  // results
  status: { state: 'idle' },
  result: null,
  setStatus: (status) => set({ status }),
  setResult: (result) =>
    set({
      result,
      status: { state: 'ready' },
      simStatus: 'ready',
      isPlaying: false,
      elapsedTime: 0,
      lapCount: 0,
    }),

  // simulation
  simStatus: 'idle',
  isPlaying: false,
  playbackSpeed: 1,
  loop: true,
  elapsedTime: 0,
  lapCount: 0,
  play: () => set((s) => (s.simStatus === 'idle' ? s : { simStatus: 'playing', isPlaying: true })),
  pause: () =>
    set((s) => (s.simStatus === 'playing' ? { simStatus: 'paused', isPlaying: false } : s)),
  togglePlay: () =>
    set((s) => {
      if (s.simStatus === 'playing') return { simStatus: 'paused', isPlaying: false }
      if (s.simStatus === 'paused' || s.simStatus === 'ready') {
        return { simStatus: 'playing', isPlaying: true }
      }
      return s
    }),
  restart: () =>
    set((s) =>
      s.simStatus === 'idle'
        ? s
        : {
            elapsedTime: 0,
            lapCount: 0,
            simStatus: s.simStatus === 'playing' ? 'playing' : 'paused',
            isPlaying: s.simStatus === 'playing',
          },
    ),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setLoop: (loop) => set({ loop }),
  setElapsedTime: (elapsedTime) => set({ elapsedTime }),
  incrementLap: () => set((s) => ({ lapCount: s.lapCount + 1 })),

  // ui
  units: 'metric',
  drawMode: 'freehand',
  straightMode: false,
  hoverIndex: null,
  selectedCorner: null,
  isDrawing: false,
  setUnits: (units) => set({ units }),
  setDrawMode: (drawMode) => set({ drawMode }),
  setStraightMode: (straightMode) => set({ straightMode }),
  setHoverIndex: (hoverIndex) => set({ hoverIndex }),
  setSelectedCorner: (selectedCorner) => set({ selectedCorner }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),
}))
