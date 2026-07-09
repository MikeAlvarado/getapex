import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '@/state/store'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { WorkerRequest, WorkerResponse } from '@/workers/protocol'

/**
 * Orchestrates the racing-line worker: debounced recompute on track/car
 * changes, stale-response guarding, status transitions. Mount once in the
 * app shell.
 */
export function useRacingLineWorker(): void {
  const track = useStore((s) => s.track)
  const car = useStore((s) => s.car)
  const input = useMemo(() => ({ track, car }), [track, car])
  const debounced = useDebouncedValue(input, 250)

  const workerRef = useRef<Worker | null>(null)
  const latestRequestId = useRef(0)

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/racingLine.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.requestId !== latestRequestId.current) return
      if (msg.type === 'result') {
        useStore.getState().setResult(msg.result)
      } else {
        useStore.getState().setStatus({ state: 'error', message: msg.message })
      }
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    const { setStatus } = useStore.getState()
    if (!debounced.track) {
      latestRequestId.current++
      setStatus({ state: 'idle' })
      useStore.setState({
        result: null,
        simStatus: 'idle',
        isPlaying: false,
        elapsedTime: 0,
        lapCount: 0,
      })
      return
    }
    const requestId = ++latestRequestId.current
    setStatus({ state: 'computing' })
    const request: WorkerRequest = {
      type: 'compute',
      requestId,
      track: debounced.track,
      car: debounced.car,
    }
    workerRef.current?.postMessage(request)
  }, [debounced])
}
