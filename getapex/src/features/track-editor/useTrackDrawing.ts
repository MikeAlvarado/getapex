import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Vec2 } from '@/types'
import { dist } from '@/lib/geometry/vec2'
import type { BezierAnchor } from '@/lib/geometry/bezier'
import { buildTrackFromBezier, buildTrackFromStroke, TrackBuildError } from '@/lib/track/buildTrack'
import { useStore } from '@/state/store'
import { screenToWorld, type ViewTransform } from '@/components/canvas/view'
import { t } from '@/i18n/strings'

/** Screen-px radius around the first anchor that closes the pen path. */
export const PEN_CLOSE_PX = 12
/** Screen-px drag before a pen click becomes a smooth point with handles. */
const PEN_DRAG_PX = 4

export interface PenState {
  anchors: BezierAnchor[]
  /** Cursor position for the rubber-band preview, world coords. */
  cursor: Vec2 | null
  /** Pointer is down, pulling handles out of the newest (or closing) anchor. */
  dragging: boolean
  /** The active drag started on the first anchor and will close the loop. */
  closing: boolean
}

export interface DrawingState {
  stroke: Vec2[] | null
  straightPreview: [Vec2, Vec2] | null
  /** In-progress pen path, or null when the pen tool is idle. */
  pen: PenState | null
  /** Bumped on every mutation so the render loop can dirty-check cheaply. */
  version: number
}

/**
 * Track drawing on the canvas, in two modes selected via the store:
 *
 * - `freehand`: drag to sketch. Straight-segment mode while Shift is held or
 *   the UI toggle is on; the segment previews as anchor → cursor and commits
 *   as interpolated points when the mode releases or the stroke ends.
 * - `pen`: Illustrator-style. Click places a corner anchor, click-drag pulls
 *   out symmetric Bézier handles, clicking the first anchor closes the loop
 *   (drag while closing to shape it). Enter closes, Backspace removes the
 *   last anchor, Escape cancels.
 */
export function useTrackDrawing(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  viewRef: RefObject<ViewTransform>,
): { drawingRef: RefObject<DrawingState>; message: string | null } {
  const drawingRef = useRef<DrawingState>({
    stroke: null,
    straightPreview: null,
    pen: null,
    version: 0,
  })
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const state = drawingRef.current
    let shiftHeld = false
    let messageTimer = 0

    const flash = (text: string): void => {
      setMessage(text)
      window.clearTimeout(messageTimer)
      messageTimer = window.setTimeout(() => setMessage(null), 3500)
    }

    const toWorld = (e: PointerEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect()
      return screenToWorld(viewRef.current, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }

    const straightActive = (): boolean => shiftHeld || useStore.getState().straightMode
    const penActive = (): boolean => useStore.getState().drawMode === 'pen'

    /** Screen-space step between committed points, converted to meters. */
    const stepWorld = (): number => 3 / viewRef.current.scale

    const commitStraight = (): void => {
      const { stroke, straightPreview } = state
      if (!stroke || !straightPreview) return
      const [from, to] = straightPreview
      const length = dist(from, to)
      const steps = Math.max(1, Math.ceil(length / stepWorld()))
      for (let i = 1; i <= steps; i++) {
        stroke.push({
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        })
      }
      state.straightPreview = null
      state.version++
    }

    const endStroke = (): void => {
      const stroke = state.stroke
      state.stroke = null
      state.straightPreview = null
      state.version++
      useStore.getState().setIsDrawing(false)
      if (!stroke || stroke.length < 8) return
      const { trackWidth, margin, setTrack } = useStore.getState()
      try {
        const track = buildTrackFromStroke(stroke, {
          id: `drawn-${Date.now()}`,
          name: 'Custom circuit',
          width: trackWidth,
          margin,
        })
        setTrack(track)
      } catch (error) {
        flash(error instanceof TrackBuildError ? error.message : t('editor.openStroke'))
      }
    }

    // ---- pen tool -----------------------------------------------------

    const cancelPen = (): void => {
      state.pen = null
      state.version++
      useStore.getState().setIsDrawing(false)
    }

    const finishPen = (): void => {
      const pen = state.pen
      if (!pen) return
      const anchors = pen.anchors
      cancelPen()
      const { trackWidth, margin, setTrack } = useStore.getState()
      try {
        const track = buildTrackFromBezier(anchors, {
          id: `drawn-${Date.now()}`,
          name: 'Custom circuit',
          width: trackWidth,
          margin,
        })
        setTrack(track)
      } catch (error) {
        flash(error instanceof TrackBuildError ? error.message : t('editor.openStroke'))
      }
    }

    const penDown = (world: Vec2): void => {
      let pen = state.pen
      if (!pen) {
        pen = { anchors: [], cursor: world, dragging: false, closing: false }
        state.pen = pen
        useStore.getState().setIsDrawing(true)
      }
      const closeRadius = PEN_CLOSE_PX / viewRef.current.scale
      if (pen.anchors.length >= 3 && dist(world, pen.anchors[0].point) <= closeRadius) {
        // clicked the first anchor: close on pointerup, drag shapes the joint
        pen.closing = true
      } else {
        pen.anchors.push({ point: world, handleIn: null, handleOut: null })
      }
      pen.dragging = true
      pen.cursor = world
      state.version++
    }

    const penMove = (world: Vec2): void => {
      const pen = state.pen
      if (!pen) return
      pen.cursor = world
      if (pen.dragging) {
        const target = pen.closing ? pen.anchors[0] : pen.anchors[pen.anchors.length - 1]
        if (dist(world, target.point) >= PEN_DRAG_PX / viewRef.current.scale) {
          // symmetric smooth point: handleOut follows the cursor, handleIn mirrors
          target.handleOut = world
          target.handleIn = { x: 2 * target.point.x - world.x, y: 2 * target.point.y - world.y }
        } else {
          target.handleOut = null
          target.handleIn = null
        }
      }
      state.version++
    }

    const penUp = (): void => {
      const pen = state.pen
      if (!pen) return
      pen.dragging = false
      state.version++
      if (pen.closing) finishPen()
    }

    // ---- event wiring -------------------------------------------------

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return
      canvas.setPointerCapture(e.pointerId)
      if (penActive()) {
        penDown(toWorld(e))
        return
      }
      state.stroke = [toWorld(e)]
      state.straightPreview = null
      state.version++
      useStore.getState().setIsDrawing(true)
    }

    const onPointerMove = (e: PointerEvent): void => {
      shiftHeld = e.shiftKey
      if (penActive() || state.pen) {
        penMove(toWorld(e))
        return
      }
      if (!state.stroke) return
      const world = toWorld(e)
      if (straightActive()) {
        const anchor = state.straightPreview?.[0] ?? state.stroke[state.stroke.length - 1]
        state.straightPreview = [anchor, world]
        state.version++
        return
      }
      if (state.straightPreview) commitStraight()
      const last = state.stroke[state.stroke.length - 1]
      if (dist(world, last) >= stepWorld()) {
        state.stroke.push(world)
        state.version++
      }
    }

    const onPointerUp = (e: PointerEvent): void => {
      if (state.pen) {
        canvas.releasePointerCapture(e.pointerId)
        penUp()
        return
      }
      if (!state.stroke) return
      canvas.releasePointerCapture(e.pointerId)
      if (state.straightPreview) commitStraight()
      endStroke()
    }

    const isTyping = (e: KeyboardEvent): boolean => {
      const el = e.target
      return (
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      )
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') shiftHeld = true
      if (isTyping(e)) return
      if (e.key === 'Escape') {
        if (state.pen) cancelPen()
        if (state.stroke) {
          state.stroke = null
          state.straightPreview = null
          state.version++
          useStore.getState().setIsDrawing(false)
        }
      }
      if (state.pen && !state.pen.dragging) {
        if (e.key === 'Enter' && state.pen.anchors.length >= 3) {
          finishPen()
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault()
          state.pen.anchors.pop()
          if (state.pen.anchors.length === 0) cancelPen()
          else state.version++
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') shiftHeld = false
    }

    // switching tools abandons any in-progress path
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.drawMode === prev.drawMode) return
      if (state.pen) cancelPen()
      if (state.stroke) {
        state.stroke = null
        state.straightPreview = null
        state.version++
        useStore.getState().setIsDrawing(false)
      }
    })

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.clearTimeout(messageTimer)
      unsubscribe()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [canvasRef, viewRef])

  return { drawingRef, message }
}
