import type { CarSetup, Track } from '@/types'
import { EXPORT_VERSION, isCarSetup, isTrack } from '@/state/persistence'

interface ExportFile {
  app: 'getapex'
  version: number
  track: Track | null
  car: CarSetup
}

export function exportSetup(track: Track | null, car: CarSetup): void {
  const payload: ExportFile = { app: 'getapex', version: EXPORT_VERSION, track, car }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `apex-${track ? track.name.toLowerCase().replace(/\s+/g, '-') : 'setup'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export class ImportError extends Error {}

export function parseSetupFile(text: string): { track: Track | null; car: CarSetup | null } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('not JSON')
  }
  if (typeof data !== 'object' || data === null) throw new ImportError('unexpected shape')
  const d = data as Record<string, unknown>
  const track = isTrack(d.track) ? d.track : null
  const car = isCarSetup(d.car) ? d.car : null
  if (!track && !car) throw new ImportError('no track or car found')
  return { track, car }
}
