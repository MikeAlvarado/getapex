import { useStore } from '@/state/store'
import { Panel } from '@/components/ui/Panel'
import { formatSpeed } from '@/lib/units'
import { t } from '@/i18n/strings'
import type { CSSProperties } from 'react'

export function CornerCards() {
  const result = useStore((s) => s.result)
  const units = useStore((s) => s.units)
  const selectedCorner = useStore((s) => s.selectedCorner)
  const setSelectedCorner = useStore((s) => s.setSelectedCorner)

  if (!result || result.corners.length === 0) return null

  return (
    <Panel title={`${t('results.corners')} · ${result.corners.length}`}>
      <div className="corner-list">
        {result.corners.map((corner, i) => (
          <button
            key={corner.number}
            type="button"
            className={`corner-card${selectedCorner === corner.number ? ' is-selected' : ''}`}
            style={{ '--i': i } as CSSProperties}
            onClick={() =>
              setSelectedCorner(selectedCorner === corner.number ? null : corner.number)
            }
          >
            <div className="corner-head">
              <span className="corner-num">T{corner.number}</span>
              <span className="corner-meta">
                {corner.direction === 'left' ? '↰' : '↱'}{' '}
                {Number.isFinite(corner.minRadius) ? `R ${Math.round(corner.minRadius)} m` : 'R ∞'}
              </span>
              <span className={`corner-brake${corner.brakingIdx === null ? ' is-flat' : ''}`}>
                {corner.brakingIdx === null
                  ? t('corner.noBraking')
                  : `${t('corner.brake')} ${Math.round(corner.brakingDistance)} m`}
              </span>
            </div>
            <dl className="corner-speeds">
              <div className="corner-speed">
                <dt>{t('corner.entry')}</dt>
                <dd>{formatSpeed(corner.entrySpeed, units)}</dd>
              </div>
              <div className="corner-speed is-apex">
                <dt>{t('corner.apex')}</dt>
                <dd>{formatSpeed(corner.apexSpeed, units)}</dd>
              </div>
              <div className="corner-speed">
                <dt>{t('corner.exit')}</dt>
                <dd>{formatSpeed(corner.exitSpeed, units)}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>
    </Panel>
  )
}
