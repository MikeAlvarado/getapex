import { useMemo } from 'react'
import { useStore } from '@/state/store'
import { useResizeObserver } from '@/hooks/useResizeObserver'
import { formatSpeed, speedValue, speedUnit } from '@/lib/units'
import { t } from '@/i18n/strings'
import type { Phase } from '@/types'

const MARGIN = { top: 8, right: 10, bottom: 16, left: 40 }
const HEIGHT = 128

const PHASE_COLOR: Record<Phase, string> = {
  throttle: 'var(--throttle)',
  brake: 'var(--brake)',
  coast: 'var(--coast)',
}

/** Nice tick pitch on a 1-2-5 ladder near `target`. */
function tickPitch(target: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(target, 1))))
  return [1, 2, 5, 10].map((m) => m * pow).find((p) => p >= target) ?? pow
}

export function SpeedTrace() {
  const { ref: wrapRef, width } = useResizeObserver()
  const result = useStore((s) => s.result)
  const units = useStore((s) => s.units)
  const hoverIndex = useStore((s) => s.hoverIndex)
  const setHoverIndex = useStore((s) => s.setHoverIndex)
  const selectedCorner = useStore((s) => s.selectedCorner)

  const geometry = useMemo(() => {
    if (!result || width < 80) return null
    const { velocity, lineLength } = result
    const plotW = width - MARGIN.left - MARGIN.right
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
    const vMax = Math.max(...velocity.map((p) => p.v)) * 1.06
    const x = (s: number): number => MARGIN.left + (s / lineLength) * plotW
    const y = (v: number): number => MARGIN.top + plotH * (1 - v / vMax)

    // closed-lap polyline: append the wrap-around point
    const pts = [...velocity, { ...velocity[0], s: lineLength }]

    // contiguous phase runs → one path each
    const segments: Array<{ phase: Phase; d: string }> = []
    let runPhase = pts[0].phase
    let d = `M${x(pts[0].s).toFixed(1)},${y(pts[0].v).toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      d += `L${x(pts[i].s).toFixed(1)},${y(pts[i].v).toFixed(1)}`
      const phase = i < pts.length - 1 ? pts[i].phase : runPhase
      if (phase !== runPhase) {
        segments.push({ phase: runPhase, d })
        runPhase = phase
        d = `M${x(pts[i].s).toFixed(1)},${y(pts[i].v).toFixed(1)}`
      }
    }
    segments.push({ phase: runPhase, d })

    const xPitch = tickPitch(lineLength / 6)
    const xTicks: number[] = []
    for (let s = xPitch; s < lineLength; s += xPitch) xTicks.push(s)
    const vPitchDisplay = tickPitch(speedValue(vMax, units) / 3)
    const yTicks: number[] = []
    for (let vDisp = vPitchDisplay; vDisp < speedValue(vMax, units); vDisp += vPitchDisplay) {
      yTicks.push(vDisp)
    }
    const yFromDisplay = (vDisp: number): number => y(vDisp / (units === 'metric' ? 3.6 : 2.23694))

    return { x, y, vMax, segments, xTicks, yTicks, yFromDisplay, plotH }
  }, [result, width, units])

  if (!result) return null

  const { velocity, corners, lineLength } = result

  const indexFromClientX = (clientX: number, rect: DOMRect): number | null => {
    const s =
      ((clientX - rect.left - MARGIN.left) / (width - MARGIN.left - MARGIN.right)) * lineLength
    if (s < 0 || s > lineLength) return null
    let lo = 0
    let hi = velocity.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (velocity[mid].s < s) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const hovered = hoverIndex !== null ? velocity[hoverIndex] : null
  const selected = selectedCorner !== null ? corners.find((c) => c.number === selectedCorner) : null

  return (
    <div className="trace" ref={wrapRef}>
      <div className="trace-head">
        <span className="trace-title">{t('results.speedTrace')}</span>
        <span className="trace-readout">
          {hovered ? `${Math.round(hovered.s)} m · ${formatSpeed(hovered.v, units)}` : ''}
        </span>
      </div>
      {geometry && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t('results.speedTrace')}
          onPointerMove={(e) => {
            const idx = indexFromClientX(e.clientX, e.currentTarget.getBoundingClientRect())
            setHoverIndex(idx)
          }}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {/* selected corner band */}
          {selected && (
            <rect
              x={geometry.x(velocity[selected.brakingIdx ?? selected.startIdx].s)}
              y={MARGIN.top}
              width={Math.max(
                2,
                geometry.x(velocity[selected.endIdx].s) -
                  geometry.x(velocity[selected.brakingIdx ?? selected.startIdx].s),
              )}
              height={HEIGHT - MARGIN.top - MARGIN.bottom}
              fill="rgba(232, 234, 237, 0.07)"
            />
          )}

          {/* grid + axes */}
          {geometry.yTicks.map((vDisp) => (
            <g key={`y${vDisp}`}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={geometry.yFromDisplay(vDisp)}
                y2={geometry.yFromDisplay(vDisp)}
                stroke="rgba(140, 155, 175, 0.12)"
              />
              <text
                x={MARGIN.left - 6}
                y={geometry.yFromDisplay(vDisp) + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--text-faint)"
                fontFamily="var(--font-mono)"
              >
                {vDisp}
              </text>
            </g>
          ))}
          <text
            x={MARGIN.left - 6}
            y={MARGIN.top + 4}
            textAnchor="end"
            fontSize={9}
            fill="var(--text-faint)"
            fontFamily="var(--font-mono)"
          >
            {speedUnit(units)}
          </text>
          {geometry.xTicks.map((s) => (
            <text
              key={`x${s}`}
              x={geometry.x(s)}
              y={HEIGHT - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-faint)"
              fontFamily="var(--font-mono)"
            >
              {s >= 1000 ? `${(s / 1000).toFixed(1)}k` : s}
            </text>
          ))}

          {/* corner apex markers */}
          {corners.map((corner) => (
            <g key={corner.number}>
              <line
                x1={geometry.x(velocity[corner.apexIdx].s)}
                x2={geometry.x(velocity[corner.apexIdx].s)}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                stroke="rgba(140, 155, 175, 0.18)"
                strokeDasharray="2 3"
              />
              <text
                x={geometry.x(velocity[corner.apexIdx].s)}
                y={MARGIN.top + 7}
                textAnchor="middle"
                fontSize={8.5}
                fill="var(--text-faint)"
                fontFamily="var(--font-mono)"
              >
                T{corner.number}
              </text>
            </g>
          ))}

          {/* speed line, colored by throttle/brake/coast */}
          {geometry.segments.map((seg, i) => (
            <path
              key={i}
              d={seg.d}
              fill="none"
              stroke={PHASE_COLOR[seg.phase]}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          ))}

          {/* hover cursor */}
          {hovered && (
            <g>
              <line
                x1={geometry.x(hovered.s)}
                x2={geometry.x(hovered.s)}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                stroke="rgba(232, 234, 237, 0.4)"
              />
              <circle cx={geometry.x(hovered.s)} cy={geometry.y(hovered.v)} r={3} fill="var(--text)" />
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
