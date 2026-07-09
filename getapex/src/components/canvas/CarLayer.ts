import type { Phase, Vec2 } from '@/types'
import type { LapSample } from '@/lib/simulation/lapTimeline'
import { worldToScreen, type ViewTransform } from './view'

const PHASE_COLOR: Record<Phase, string> = {
  throttle: '#3fd07f',
  brake: '#ff3b2f',
  coast: '#8b93a1',
}

const TRAIL_DURATION_MS = 1000
const TRAIL_MIN_SPACING_M = 0.05
const CAR_LENGTH_M = 4.4
const CAR_WIDTH_M = 2.4
const GLOW_COLOR = '255, 77, 54'

interface TrailPoint {
  x: number
  y: number
  phase: Phase
  t: number
}

/** Imperative car + fading trail renderer. Owns trail state — call `render` every frame. */
export class CarLayer {
  private trail: TrailPoint[] = []

  reset(): void {
    this.trail.length = 0
  }

  render(
    ctx: CanvasRenderingContext2D,
    view: ViewTransform,
    sample: LapSample,
    maxSpeedMs: number,
    nowMs: number,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion) {
      this.trail.length = 0
    } else {
      this.pushTrail(sample, nowMs)
      this.drawTrail(ctx, view, nowMs)
    }
    const speedT = maxSpeedMs > 0 ? Math.min(1, Math.max(0, sample.speedMs / maxSpeedMs)) : 0
    if (!reducedMotion) this.drawGlow(ctx, view, sample.position, speedT)
    this.drawCar(ctx, view, sample, speedT)
  }

  private pushTrail(sample: LapSample, nowMs: number): void {
    const last = this.trail[this.trail.length - 1]
    if (
      !last ||
      Math.hypot(sample.position.x - last.x, sample.position.y - last.y) > TRAIL_MIN_SPACING_M
    ) {
      this.trail.push({ x: sample.position.x, y: sample.position.y, phase: sample.phase, t: nowMs })
    }
    const cutoff = nowMs - TRAIL_DURATION_MS
    while (this.trail.length > 1 && this.trail[0].t < cutoff) this.trail.shift()
  }

  private drawTrail(ctx: CanvasRenderingContext2D, view: ViewTransform, nowMs: number): void {
    if (this.trail.length < 2) return
    ctx.lineCap = 'round'
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1]
      const b = this.trail[i]
      const age = (nowMs - b.t) / TRAIL_DURATION_MS
      const alpha = 1 - Math.min(1, Math.max(0, age))
      if (alpha <= 0.02) continue
      const p = worldToScreen(view, a)
      const q = worldToScreen(view, b)
      ctx.strokeStyle = PHASE_COLOR[b.phase]
      ctx.globalAlpha = alpha * 0.6
      ctx.lineWidth = 1.5 + alpha * 3.5
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(q.x, q.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private drawGlow(
    ctx: CanvasRenderingContext2D,
    view: ViewTransform,
    position: Vec2,
    speedT: number,
  ): void {
    const center = worldToScreen(view, position)
    const radius = 12 + speedT * 20
    const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius)
    gradient.addColorStop(0, `rgba(${GLOW_COLOR}, ${0.22 + speedT * 0.2})`)
    gradient.addColorStop(1, `rgba(${GLOW_COLOR}, 0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawCar(
    ctx: CanvasRenderingContext2D,
    view: ViewTransform,
    sample: LapSample,
    speedT: number,
  ): void {
    const cos = Math.cos(sample.heading)
    const sin = Math.sin(sample.heading)
    const local = (lx: number, ly: number): Vec2 =>
      worldToScreen(view, {
        x: sample.position.x + lx * cos - ly * sin,
        y: sample.position.y + lx * sin + ly * cos,
      })

    const scale = 1 + speedT * 0.12
    const half = (CAR_WIDTH_M / 2) * scale
    const nose = local(CAR_LENGTH_M * 0.6 * scale, 0)
    const rightBack = local(-CAR_LENGTH_M * 0.4 * scale, half)
    const notch = local(-CAR_LENGTH_M * 0.15 * scale, 0)
    const leftBack = local(-CAR_LENGTH_M * 0.4 * scale, -half)

    ctx.beginPath()
    ctx.moveTo(nose.x, nose.y)
    ctx.lineTo(rightBack.x, rightBack.y)
    ctx.lineTo(notch.x, notch.y)
    ctx.lineTo(leftBack.x, leftBack.y)
    ctx.closePath()
    ctx.fillStyle = PHASE_COLOR[sample.phase]
    ctx.fill()
    ctx.strokeStyle = '#0b0d10'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}
