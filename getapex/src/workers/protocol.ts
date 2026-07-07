import type { CarSetup, RacingLineResult, Track } from '@/types'

export interface ComputeRequest {
  type: 'compute'
  requestId: number
  track: Track
  car: CarSetup
}

export type WorkerRequest = ComputeRequest

export type WorkerResponse =
  | { type: 'result'; requestId: number; result: RacingLineResult }
  | { type: 'error'; requestId: number; message: string }
