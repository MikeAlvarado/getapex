import type { ComputeStatus, RacingLineResult, Track, Units, Vec2 } from '@/types'
import type { TrackBoundaries } from '@/lib/track/buildTrack'
import { segmentControls, type BezierAnchor } from '@/lib/geometry/bezier'
import { speedColor } from '@/features/racing-line/colorScale'
import { PEN_CLOSE_PX, type PenState } from '@/features/track-editor/useTrackDrawing'
import { formatSpeed } from '@/lib/units'
import { worldToScreen, type ViewTransform } from './view'

export interface Scene {
  track: Track | null
  boundaries: TrackBoundaries | null
  result: RacingLineResult | null
  status: ComputeStatus
  hoverIndex: number | null
  selectedCorner: number | null
  /** In-progress drawn stroke, world coords. */
  stroke: readonly Vec2[] | null
  /** Straight-mode preview segment (anchor → cursor), world coords. */
  straightPreview: readonly [Vec2, Vec2] | null
  /** In-progress pen path, world coords. */
  pen: PenState | null
  view: ViewTransform
  units: Units
  width: number
  height: number
}

const COLORS = {
  grid: 'rgba(140, 155, 175, 0.055)',
  asphalt: '#171b21',
  boundary: '#323a45',
  centerline: 'rgba(120, 132, 148, 0.35)',
  stroke: '#e8eaed',
  brakeZone: 'rgba(255, 81, 71, 0.85)',
  apexFill: '#e8eaed',
  apexStroke: '#0b0d10',
  label: '#9aa3af',
  hover: '#ffffff',
  handle: 'rgba(120, 170, 255, 0.9)',
} as const

function pathClosed(ctx: CanvasRenderingContext2D, view: ViewTransform, pts: readonly Vec2[]) {
  ctx.beginPath()
  const first = worldToScreen(view, pts[0])
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < pts.length; i++) {
    const p = worldToScreen(view, pts[i])
    ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
}

function drawGrid(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { view, width, height } = scene
  // grid pitch in world meters, snapped to a 1-2-5 ladder near 60px on screen
  const target = 60 / view.scale
  const pow = Math.pow(10, Math.floor(Math.log10(target)))
  const pitch = [1, 2, 5, 10].map((m) => m * pow).find((p) => p >= target) ?? 10 * pow
  const step = pitch * view.scale
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  const startX = ((view.tx % step) + step) % step
  for (let x = startX; x < width; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  const startY = ((view.ty % step) + step) % step
  for (let y = startY; y < height; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()
}

function drawTrack(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { track, boundaries, view } = scene
  if (!track || !boundaries) return

  // asphalt: left boundary forward + right boundary reversed, even-odd safe
  ctx.beginPath()
  const l0 = worldToScreen(view, boundaries.left[0])
  ctx.moveTo(l0.x, l0.y)
  for (let i = 1; i < boundaries.left.length; i++) {
    const p = worldToScreen(view, boundaries.left[i])
    ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  const r0 = worldToScreen(view, boundaries.right[0])
  ctx.moveTo(r0.x, r0.y)
  for (let i = boundaries.right.length - 1; i >= 1; i--) {
    const p = worldToScreen(view, boundaries.right[i])
    ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.fillStyle = COLORS.asphalt
  ctx.fill('evenodd')

  ctx.strokeStyle = COLORS.boundary
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  pathClosed(ctx, view, boundaries.left)
  ctx.stroke()
  pathClosed(ctx, view, boundaries.right)
  ctx.stroke()

  // faint centerline
  ctx.strokeStyle = COLORS.centerline
  ctx.lineWidth = 1
  ctx.setLineDash([4, 6])
  pathClosed(ctx, view, track.centerline)
  ctx.stroke()
  ctx.setLineDash([])

  // start/finish tick across the track at point 0
  const n = track.centerline.length
  const a = track.centerline[0]
  const b = track.centerline[1 % n]
  const tangent = { x: b.x - a.x, y: b.y - a.y }
  const tl = Math.hypot(tangent.x, tangent.y) || 1
  const normal = { x: -tangent.y / tl, y: tangent.x / tl }
  const half = track.width / 2
  const p1 = worldToScreen(view, { x: a.x + normal.x * half, y: a.y + normal.y * half })
  const p2 = worldToScreen(view, { x: a.x - normal.x * half, y: a.y - normal.y * half })
  ctx.strokeStyle = COLORS.label
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
}

function drawRacingLine(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { result, view } = scene
  if (!result) return
  const { line, velocity, corners } = result
  const n = line.length
  if (n < 2) return

  const computing = scene.status.state === 'computing'
  ctx.globalAlpha = computing ? 0.45 : 1

  let vMin = Infinity
  let vMax = -Infinity
  for (const p of velocity) {
    if (p.v < vMin) vMin = p.v
    if (p.v > vMax) vMax = p.v
  }
  const span = Math.max(vMax - vMin, 0.1)

  // braking zones: red casing beneath the line
  ctx.lineCap = 'round'
  ctx.strokeStyle = COLORS.brakeZone
  ctx.lineWidth = 7
  ctx.beginPath()
  let penDown = false
  for (let i = 0; i < n; i++) {
    const braking = velocity[i].limiter === 'brake'
    const p = worldToScreen(view, line[i])
    if (braking) {
      if (!penDown) {
        ctx.moveTo(p.x, p.y)
        penDown = true
      } else {
        ctx.lineTo(p.x, p.y)
      }
      // extend to the next point so single-point zones still show
      const q = worldToScreen(view, line[(i + 1) % n])
      ctx.lineTo(q.x, q.y)
    } else {
      penDown = false
    }
  }
  ctx.stroke()

  // heatmap line, one segment per point pair
  ctx.lineWidth = 3
  for (let i = 0; i < n; i++) {
    const p = worldToScreen(view, line[i])
    const q = worldToScreen(view, line[(i + 1) % n])
    ctx.strokeStyle = speedColor((velocity[i].v - vMin) / span)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }

  // selected corner: white halo over its span
  if (scene.selectedCorner !== null) {
    const corner = corners.find((c) => c.number === scene.selectedCorner)
    if (corner) {
      ctx.strokeStyle = 'rgba(232, 234, 237, 0.5)'
      ctx.lineWidth = 8
      ctx.beginPath()
      let idx = corner.brakingIdx ?? corner.startIdx
      const start = worldToScreen(view, line[idx])
      ctx.moveTo(start.x, start.y)
      let guard = 0
      while (idx !== corner.endIdx && guard < n) {
        idx = (idx + 1) % n
        const p = worldToScreen(view, line[idx])
        ctx.lineTo(p.x, p.y)
        guard++
      }
      ctx.globalAlpha = (computing ? 0.45 : 1) * 0.35
      ctx.stroke()
      ctx.globalAlpha = computing ? 0.45 : 1
    }
  }

  // apex markers: diamond + corner number
  ctx.font = '600 10px ui-monospace, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const corner of corners) {
    const p = worldToScreen(view, line[corner.apexIdx])
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = COLORS.apexFill
    ctx.strokeStyle = COLORS.apexStroke
    ctx.lineWidth = 1.5
    const s = 4.2
    ctx.beginPath()
    ctx.rect(-s, -s, 2 * s, 2 * s)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    // number label, offset away from the line along the local normal
    const before = worldToScreen(view, line[(corner.apexIdx - 2 + n) % n])
    const after = worldToScreen(view, line[(corner.apexIdx + 2) % n])
    const tx = after.x - before.x
    const ty = after.y - before.y
    const tl = Math.hypot(tx, ty) || 1
    const side = corner.direction === 'left' ? 1 : -1
    const lx = p.x + (-ty / tl) * 14 * side
    const ly = p.y + (tx / tl) * 14 * side
    ctx.fillStyle = COLORS.label
    ctx.fillText(`T${corner.number}`, lx, ly)
  }

  // hover marker from the speed trace
  if (scene.hoverIndex !== null && scene.hoverIndex < n) {
    const i = scene.hoverIndex
    const p = worldToScreen(view, line[i])
    ctx.fillStyle = COLORS.hover
    ctx.strokeStyle = COLORS.apexStroke
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()
    ctx.font = '600 11px ui-monospace, Menlo, monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.stroke
    ctx.fillText(formatSpeed(velocity[i].v, scene.units), p.x + 10, p.y - 10)
  }

  ctx.globalAlpha = 1
}

function drawStroke(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { stroke, straightPreview, view } = scene
  if (stroke && stroke.length > 1) {
    ctx.strokeStyle = COLORS.stroke
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    const first = worldToScreen(view, stroke[0])
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < stroke.length; i++) {
      const p = worldToScreen(view, stroke[i])
      ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()

    // closing hint: marker at the start point
    ctx.fillStyle = COLORS.label
    ctx.beginPath()
    ctx.arc(first.x, first.y, 4, 0, 2 * Math.PI)
    ctx.fill()
  }
  if (straightPreview) {
    const a = worldToScreen(view, straightPreview[0])
    const b = worldToScreen(view, straightPreview[1])
    ctx.strokeStyle = COLORS.stroke
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

/** Screen-space cubic segment between two pen anchors. */
function bezierSegment(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  from: BezierAnchor,
  to: BezierAnchor,
): void {
  const [p0, p1, p2, p3] = segmentControls(from, to).map((p) => worldToScreen(view, p))
  ctx.moveTo(p0.x, p0.y)
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
}

function drawHandles(ctx: CanvasRenderingContext2D, view: ViewTransform, anchor: BezierAnchor) {
  const p = worldToScreen(view, anchor.point)
  for (const handle of [anchor.handleIn, anchor.handleOut]) {
    if (!handle) continue
    const h = worldToScreen(view, handle)
    ctx.strokeStyle = COLORS.handle
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(h.x, h.y)
    ctx.stroke()
    ctx.fillStyle = COLORS.handle
    ctx.beginPath()
    ctx.arc(h.x, h.y, 3, 0, 2 * Math.PI)
    ctx.fill()
  }
}

function drawPen(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { pen, view } = scene
  if (!pen || pen.anchors.length === 0) return
  const anchors = pen.anchors
  const n = anchors.length
  const first = worldToScreen(view, anchors[0].point)
  const cursor = pen.cursor ? worldToScreen(view, pen.cursor) : null
  const closable =
    n >= 3 && cursor !== null && Math.hypot(cursor.x - first.x, cursor.y - first.y) <= PEN_CLOSE_PX

  // committed path (plus the closing segment while its joint is being shaped)
  ctx.strokeStyle = COLORS.stroke
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < n - 1; i++) bezierSegment(ctx, view, anchors[i], anchors[i + 1])
  if (pen.closing && n >= 2) bezierSegment(ctx, view, anchors[n - 1], anchors[0])
  ctx.stroke()

  // rubber band: last anchor → cursor, or the closing curve when near the start
  if (pen.cursor && !pen.dragging && n >= 1) {
    ctx.setLineDash([6, 6])
    ctx.strokeStyle = COLORS.stroke
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (closable) {
      bezierSegment(ctx, view, anchors[n - 1], anchors[0])
    } else {
      const cursorAnchor: BezierAnchor = { point: pen.cursor, handleIn: null, handleOut: null }
      bezierSegment(ctx, view, anchors[n - 1], cursorAnchor)
    }
    ctx.stroke()
    ctx.setLineDash([])
  }

  // handles for the anchor currently being shaped
  const active = pen.closing ? anchors[0] : anchors[n - 1]
  drawHandles(ctx, view, active)

  // anchor squares; first anchor gets a ring when the loop can close
  for (let i = 0; i < n; i++) {
    const p = worldToScreen(view, anchors[i].point)
    ctx.fillStyle = i === 0 ? COLORS.stroke : COLORS.label
    ctx.beginPath()
    ctx.rect(p.x - 3, p.y - 3, 6, 6)
    ctx.fill()
  }
  if (n >= 3) {
    ctx.strokeStyle = closable || pen.closing ? COLORS.hover : COLORS.label
    ctx.lineWidth = closable || pen.closing ? 2 : 1
    ctx.beginPath()
    ctx.arc(first.x, first.y, 8, 0, 2 * Math.PI)
    ctx.stroke()
  }
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  ctx.clearRect(0, 0, scene.width, scene.height)
  drawGrid(ctx, scene)
  drawTrack(ctx, scene)
  drawRacingLine(ctx, scene)
  drawStroke(ctx, scene)
  drawPen(ctx, scene)
}
