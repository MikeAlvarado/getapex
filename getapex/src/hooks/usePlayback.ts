import { useEffect, useRef } from 'react'
import { useStore } from '@/state/store'
import { useAnimationFrame } from './useAnimationFrame'
import { useLapTimeline } from '@/features/simulation/useLapTimeline'

/** How often the precise clock is flushed into the store for the HUD/scrubber. */
const HUD_COMMIT_INTERVAL_MS = 1000 / 24
/** Guards a runaway `dt` after the tab was backgrounded or the frame stalled. */
const MAX_FRAME_DT_S = 0.25

/** Shared, high-precision lap clock. Written only by `usePlayback`, read
 * directly by the canvas render loop while playing (bypassing React). */
export const playbackClock = { time: 0 }

/**
 * Owns lap playback: advances `playbackClock` every animation frame (not
 * through React state) and throttle-commits it into the store for the HUD.
 * Mount once (in the app shell), alongside the racing-line worker hook.
 */
export function usePlayback(): void {
  const timeline = useLapTimeline()
  const lastFrameRef = useRef<number | null>(null)
  const lastKnownElapsedRef = useRef(0)
  const wasPlayingRef = useRef(false)
  const lastHudCommitRef = useRef(0)

  useEffect(() => {
    const handleVisibility = (): void => {
      if (document.hidden) useStore.getState().pause()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useAnimationFrame((now) => {
    const state = useStore.getState()

    // Adopt external changes to elapsedTime (restart, scrub, a fresh result).
    if (state.elapsedTime !== lastKnownElapsedRef.current) {
      playbackClock.time = state.elapsedTime
      lastKnownElapsedRef.current = state.elapsedTime
    }

    if (state.simStatus !== 'playing' || !timeline) {
      if (wasPlayingRef.current) {
        state.setElapsedTime(playbackClock.time)
        lastKnownElapsedRef.current = playbackClock.time
      }
      wasPlayingRef.current = false
      lastFrameRef.current = null
      return
    }
    wasPlayingRef.current = true

    const last = lastFrameRef.current ?? now
    lastFrameRef.current = now
    const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME_DT_S)

    let next = playbackClock.time + dt * state.playbackSpeed
    if (next >= timeline.totalLapTime) {
      if (state.loop) {
        next = timeline.totalLapTime > 0 ? next % timeline.totalLapTime : 0
        state.incrementLap()
      } else {
        next = timeline.totalLapTime
        state.pause()
      }
    }
    playbackClock.time = next

    if (now - lastHudCommitRef.current >= HUD_COMMIT_INTERVAL_MS) {
      lastHudCommitRef.current = now
      state.setElapsedTime(next)
      lastKnownElapsedRef.current = next
    }
  })
}
