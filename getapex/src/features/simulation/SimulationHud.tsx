import { useStore } from '@/state/store'
import { useLapTimeline } from './useLapTimeline'
import { formatLapTime, speedUnit, speedValue } from '@/lib/units'
import { t } from '@/i18n/strings'
import type { Corner, VelocityPoint } from '@/types'

/** The corner containing `distance`, if any — handles the wrap past the start/finish line. */
function cornerAt(
  distance: number,
  corners: readonly Corner[],
  velocity: readonly VelocityPoint[],
): Corner | null {
  for (const c of corners) {
    const startS = velocity[c.startIdx].s
    const endS = velocity[c.endIdx].s
    if (startS <= endS) {
      if (distance >= startS && distance <= endS) return c
    } else if (distance >= startS || distance <= endS) {
      return c
    }
  }
  return null
}

export function SimulationHud() {
  const result = useStore((s) => s.result)
  const simStatus = useStore((s) => s.simStatus)
  const elapsedTime = useStore((s) => s.elapsedTime)
  const lapCount = useStore((s) => s.lapCount)
  const units = useStore((s) => s.units)
  const timeline = useLapTimeline()

  if (!result || !timeline || simStatus === 'idle') return null

  const sample = timeline.sample(elapsedTime)
  const corner = cornerAt(sample.distance, result.corners, result.velocity)

  return (
    <div className="sim-hud" role="status" aria-live="off">
      <div className="sim-hud-speed">
        <span className="sim-hud-speed-value">{Math.round(speedValue(sample.speedMs, units))}</span>
        <span className="sim-hud-speed-unit">{speedUnit(units)}</span>
      </div>

      <div className="sim-hud-bars" aria-hidden="true">
        <div className="sim-hud-bar is-throttle">
          <div
            className="sim-hud-bar-fill"
            style={{ width: sample.phase === 'throttle' ? '100%' : '0%' }}
          />
        </div>
        <div className="sim-hud-bar is-brake">
          <div
            className="sim-hud-bar-fill"
            style={{ width: sample.phase === 'brake' ? '100%' : '0%' }}
          />
        </div>
      </div>

      <div className="sim-hud-row">
        <span className={`sim-hud-phase is-${sample.phase}`}>
          {sample.phase === 'throttle'
            ? t('sim.throttle')
            : sample.phase === 'brake'
              ? t('sim.brake')
              : '—'}
        </span>
        <span className="sim-hud-lap">
          {t('sim.lap')} {lapCount + 1}
        </span>
      </div>

      <div className="sim-hud-row">
        <span className="sim-hud-time">{formatLapTime(elapsedTime)}</span>
        {corner && <span className="sim-hud-corner">{t('sim.corner')} T{corner.number}</span>}
      </div>
    </div>
  )
}
