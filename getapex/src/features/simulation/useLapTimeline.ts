import { useMemo } from 'react'
import { useStore } from '@/state/store'
import { buildLapTimeline, type LapTimeline } from '@/lib/simulation/lapTimeline'

/** Memoized sampler over the current racing line; rebuilt only when the result changes. */
export function useLapTimeline(): LapTimeline | null {
  const result = useStore((s) => s.result)
  return useMemo(
    () => (result ? buildLapTimeline(result.line, result.velocity, result.lineLength, result.lapTime) : null),
    [result],
  )
}
