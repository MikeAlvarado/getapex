import { useEffect } from 'react'
import { useStore } from '@/state/store'
import { useLapTimeline } from './useLapTimeline'
import { playbackClock } from '@/hooks/usePlayback'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Toggle } from '@/components/ui/Toggle'
import { Slider } from '@/components/ui/Slider'
import { formatLapTime } from '@/lib/units'
import { t } from '@/i18n/strings'

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

export function PlaybackControls() {
  const result = useStore((s) => s.result)
  const simStatus = useStore((s) => s.simStatus)
  const isPlaying = useStore((s) => s.isPlaying)
  const loop = useStore((s) => s.loop)
  const playbackSpeed = useStore((s) => s.playbackSpeed)
  const elapsedTime = useStore((s) => s.elapsedTime)
  const togglePlay = useStore((s) => s.togglePlay)
  const restart = useStore((s) => s.restart)
  const pause = useStore((s) => s.pause)
  const setLoop = useStore((s) => s.setLoop)
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed)
  const setElapsedTime = useStore((s) => s.setElapsedTime)
  const timeline = useLapTimeline()

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return
      if (useStore.getState().simStatus === 'idle') return
      e.preventDefault()
      useStore.getState().togglePlay()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  if (!result || !timeline || simStatus === 'idle') return null

  const total = timeline.totalLapTime

  return (
    <div className="playback-controls">
      <Button variant="primary" onClick={() => togglePlay()}>
        {isPlaying ? t('sim.pause') : t('sim.play')}
      </Button>
      <Button variant="ghost" onClick={() => restart()}>
        {t('sim.restart')}
      </Button>
      <Toggle label={t('sim.loop')} pressed={loop} onChange={setLoop} />

      <div className="playback-scrub">
        <Slider
          label={t('sim.lapTime')}
          value={elapsedTime}
          min={0}
          max={total}
          step={total / 1000}
          displayValue={`${formatLapTime(elapsedTime)} / ${formatLapTime(total)}`}
          onChange={(value) => {
            pause()
            playbackClock.time = value
            setElapsedTime(value)
          }}
        />
      </div>

      <Segmented
        options={SPEED_OPTIONS.map((v) => ({ value: String(v), label: `${v}×` }))}
        value={String(playbackSpeed)}
        onChange={(v) => setPlaybackSpeed(Number(v))}
        ariaLabel={t('sim.playbackSpeed')}
      />
    </div>
  )
}
