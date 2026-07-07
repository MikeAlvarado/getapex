import { computeRacingLine } from '@/lib/optimizer/computeRacingLine'
import type { WorkerRequest, WorkerResponse } from './protocol'

const post = (message: WorkerResponse): void => self.postMessage(message)

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  if (msg.type !== 'compute') return
  try {
    const result = computeRacingLine(msg.track, msg.car)
    post({ type: 'result', requestId: msg.requestId, result })
  } catch (error) {
    post({
      type: 'error',
      requestId: msg.requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
