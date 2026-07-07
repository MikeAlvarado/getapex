import { useEffect, useRef } from 'react'

/** Runs `callback` every animation frame; the latest closure is always used. */
export function useAnimationFrame(callback: (timeMs: number) => void): void {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })
  useEffect(() => {
    let rafId = 0
    const tick = (time: number): void => {
      callbackRef.current(time)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])
}
