import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '@/state/store'
import { trackBoundaries } from '@/lib/track/buildTrack'
import { useResizeObserver } from '@/hooks/useResizeObserver'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { playbackClock } from '@/hooks/usePlayback'
import { useTrackDrawing } from '@/features/track-editor/useTrackDrawing'
import { SAMPLE_TRACKS } from '@/features/track-editor/sampleTracks'
import { loadSample } from '@/features/track-editor/loadSample'
import { useLapTimeline } from '@/features/simulation/useLapTimeline'
import { SimulationHud } from '@/features/simulation/SimulationHud'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Toggle } from '@/components/ui/Toggle'
import { t } from '@/i18n/strings'
import { defaultView, fitView, type ViewTransform } from './view'
import { renderScene, type Scene } from './render'
import { CarLayer } from './CarLayer'

export function TrackCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<ViewTransform>(defaultView(0, 0))
  const { ref: wrapRef, width, height } = useResizeObserver()
  const { drawingRef, message } = useTrackDrawing(canvasRef, viewRef)

  const track = useStore((s) => s.track)
  const result = useStore((s) => s.result)
  const isDrawing = useStore((s) => s.isDrawing)
  const drawMode = useStore((s) => s.drawMode)
  const setDrawMode = useStore((s) => s.setDrawMode)
  const straightMode = useStore((s) => s.straightMode)
  const setStraightMode = useStore((s) => s.setStraightMode)
  const setTrack = useStore((s) => s.setTrack)

  const boundaries = useMemo(() => (track ? trackBoundaries(track) : null), [track])
  const timeline = useLapTimeline()
  const reducedMotion = usePrefersReducedMotion()
  const carLayerRef = useRef(new CarLayer())
  const maxSpeedMs = useMemo(
    () => (result ? Math.max(...result.velocity.map((p) => p.v)) : 0),
    [result],
  )

  useEffect(() => {
    carLayerRef.current.reset()
  }, [timeline])

  // Refit the view when the circuit or canvas size changes (never mid-draw).
  const trackId = track?.id
  useEffect(() => {
    if (width === 0 || height === 0) return
    const current = useStore.getState().track
    viewRef.current = current
      ? fitView(current.centerline, width, height)
      : defaultView(width, height)
  }, [trackId, width, height])

  // Size the bitmap for the device pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }, [width, height])

  const lastDrawn = useRef<string>('')
  useAnimationFrame((time) => {
    const canvas = canvasRef.current
    if (!canvas || width === 0) return
    const s = useStore.getState()
    const drawing = drawingRef.current
    const isPlaying = s.simStatus === 'playing'
    // cheap dirty check: identities + versions (bypassed entirely while playing)
    const stamp = [
      s.track?.id,
      s.track?.width,
      s.track?.margin,
      s.result ? s.result.lapTime : null,
      s.status.state,
      s.hoverIndex,
      s.selectedCorner,
      s.simStatus,
      s.elapsedTime,
      drawing.version,
      viewRef.current.tx,
      viewRef.current.ty,
      viewRef.current.scale,
      width,
      height,
      s.units,
    ].join('|')
    if (!isPlaying && stamp === lastDrawn.current) return
    lastDrawn.current = stamp

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const scene: Scene = {
      track: s.track,
      boundaries,
      result: s.result,
      status: s.status,
      hoverIndex: s.hoverIndex,
      selectedCorner: s.selectedCorner,
      stroke: drawing.stroke,
      straightPreview: drawing.straightPreview,
      pen: drawing.pen,
      view: viewRef.current,
      units: s.units,
      width,
      height,
    }
    renderScene(ctx, scene)

    if (timeline && s.simStatus !== 'idle') {
      const simTime = isPlaying ? playbackClock.time : s.elapsedTime
      const sample = timeline.sample(simTime)
      carLayerRef.current.render(ctx, viewRef.current, sample, maxSpeedMs, time, reducedMotion)
    }
  })

  const showEmpty = !track && !isDrawing

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        aria-label={t('editor.draw')}
        style={{ cursor: drawMode === 'pen' ? 'crosshair' : undefined }}
      />

      <div className="canvas-hud">
        <Segmented
          options={[
            { value: 'freehand', label: t('editor.modeFreehand') },
            { value: 'pen', label: t('editor.modePen') },
          ]}
          value={drawMode}
          onChange={setDrawMode}
          ariaLabel={t('editor.drawMode')}
        />
        {drawMode === 'freehand' && (
          <Toggle
            label={`${t('editor.straightMode')} (${t('editor.straightHint')})`}
            pressed={straightMode}
            onChange={setStraightMode}
          />
        )}
        <div className="hud-spacer" />
        {track && (
          <Button variant="ghost" onClick={() => setTrack(null)}>
            {t('editor.clear')}
          </Button>
        )}
        <div className="legend" aria-hidden="true">
          <span className="legend-item">
            {t('legend.slow')}
            <span className="legend-ramp" />
            {t('legend.fast')}
          </span>
          <span className="legend-item">
            <span className="legend-swatch is-brake" />
            {t('legend.brake')}
          </span>
          <span className="legend-item">
            <span className="legend-apex" />
            {t('legend.apex')}
          </span>
        </div>
      </div>

      {showEmpty && (
        <div className="empty-state">
          <div className="empty-title">{t('editor.emptyTitle')}</div>
          <p className="empty-body">
            {drawMode === 'pen' ? t('editor.emptyBodyPen') : t('editor.emptyBody')}
          </p>
          <div className="empty-samples">
            {SAMPLE_TRACKS.map((sample) => (
              <Button key={sample.id} onClick={() => loadSample(sample)}>
                {sample.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {message && <div className="hud-note is-error">{message}</div>}
      {!message && drawMode === 'pen' && isDrawing && (
        <div className="hud-note">{t('editor.penHint')}</div>
      )}

      <SimulationHud />
    </div>
  )
}
