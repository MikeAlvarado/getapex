import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/state/store'
import { useRacingLineWorker } from '@/features/racing-line/useRacingLineWorker'
import { TrackCanvas } from '@/components/canvas/TrackCanvas'
import { SpeedTrace } from '@/features/telemetry/SpeedTrace'
import { CornerCards } from '@/features/telemetry/CornerCards'
import { CarConfigPanel } from '@/features/car-config/CarConfigPanel'
import { TrackControls } from '@/features/track-editor/TrackControls'
import { Segmented } from '@/components/ui/Segmented'
import { formatDistance, formatLapTime, formatSpeed } from '@/lib/units'
import { t } from '@/i18n/strings'
import type { Units } from '@/types'

const UNIT_OPTIONS: ReadonlyArray<{ value: Units; label: string }> = [
  { value: 'metric', label: t('units.metric') },
  { value: 'imperial', label: t('units.imperial') },
]

/** Re-mounts its text on change so the settle-in animation replays. */
function StatValue({ value, large, stale }: { value: string; large?: boolean; stale?: boolean }) {
  const [animKey, setAnimKey] = useState(0)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setAnimKey((k) => k + 1)
    }
  }, [value])
  return (
    <span
      key={animKey}
      className={`stat-value did-change${large ? ' is-large' : ''}${stale ? ' is-stale' : ''}`}
    >
      {value}
    </span>
  )
}

export function App() {
  useRacingLineWorker()

  const result = useStore((s) => s.result)
  const status = useStore((s) => s.status)
  const units = useStore((s) => s.units)
  const setUnits = useStore((s) => s.setUnits)

  const computing = status.state === 'computing'
  const topSpeed = result ? Math.max(...result.velocity.map((p) => p.v)) : null

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-name">APEX</span>
          <span className="brand-tag">{t('app.tagline')}</span>
        </div>
        <div
          className={`compute-dot${computing ? ' is-computing' : ''}`}
          role="status"
          aria-label={computing ? t('results.computing') : status.state}
          title={status.state === 'error' ? status.message : undefined}
        />
        {status.state === 'error' && <span className="error-text">{t('results.error')}</span>}
        <div className="header-stats">
          {result && (
            <>
              <div className="stat">
                <span className="stat-label">{t('results.trackLength')}</span>
                <StatValue value={formatDistance(result.trackLength, units)} stale={computing} />
              </div>
              {topSpeed !== null && (
                <div className="stat">
                  <span className="stat-label">{t('results.topSpeed')}</span>
                  <StatValue value={formatSpeed(topSpeed, units)} stale={computing} />
                </div>
              )}
              <div className="stat">
                <span className="stat-label">{t('results.lapTime')}</span>
                <StatValue value={formatLapTime(result.lapTime)} large stale={computing} />
              </div>
            </>
          )}
          <Segmented options={UNIT_OPTIONS} value={units} onChange={setUnits} ariaLabel="Units" />
        </div>
      </header>
      <div className="app-main">
        <div className="stage">
          <TrackCanvas />
          <SpeedTrace />
        </div>
        <aside className="sidebar">
          <TrackControls />
          <CarConfigPanel />
          <CornerCards />
        </aside>
      </div>
    </div>
  )
}
