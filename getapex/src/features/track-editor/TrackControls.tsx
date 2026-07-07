import { useRef, useState } from 'react'
import { useStore } from '@/state/store'
import { Panel } from '@/components/ui/Panel'
import { Slider } from '@/components/ui/Slider'
import { Button } from '@/components/ui/Button'
import { loadSample } from './loadSample'
import { SAMPLE_TRACKS } from './sampleTracks'
import { exportSetup, parseSetupFile } from './io'
import { t } from '@/i18n/strings'

export function TrackControls() {
  const track = useStore((s) => s.track)
  const trackWidth = useStore((s) => s.trackWidth)
  const margin = useStore((s) => s.margin)
  const setTrackWidth = useStore((s) => s.setTrackWidth)
  const setMargin = useStore((s) => s.setMargin)
  const car = useStore((s) => s.car)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState(false)

  const onImport = async (file: File): Promise<void> => {
    try {
      const { track: importedTrack, car: importedCar } = parseSetupFile(await file.text())
      setImportError(false)
      if (importedTrack) {
        useStore.setState({
          track: importedTrack,
          trackWidth: importedTrack.width,
          margin: importedTrack.margin,
          selectedCorner: null,
          hoverIndex: null,
        })
      }
      if (importedCar) {
        useStore.setState({ car: importedCar, presetId: 'custom' })
      }
    } catch {
      setImportError(true)
    }
  }

  return (
    <Panel title={track ? track.name : t('editor.samples')}>
      <Slider
        label={t('track.width')}
        value={trackWidth}
        min={6}
        max={25}
        step={0.5}
        displayValue={`${trackWidth.toFixed(1)} m`}
        onChange={setTrackWidth}
      />
      <Slider
        label={t('track.margin')}
        value={margin}
        min={0}
        max={2}
        step={0.1}
        displayValue={`${margin.toFixed(1)} m`}
        onChange={setMargin}
      />
      <div style={{ height: 8 }} />
      <div className="panel-row" style={{ flexWrap: 'wrap' }}>
        {SAMPLE_TRACKS.map((sample) => (
          <Button key={sample.id} onClick={() => loadSample(sample)}>
            {sample.name}
          </Button>
        ))}
      </div>
      <div style={{ height: 12 }} />
      <div className="panel-row">
        <Button variant="ghost" onClick={() => exportSetup(track, car)}>
          {t('io.export')}
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          {t('io.import')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onImport(file)
            e.target.value = ''
          }}
        />
      </div>
      {importError && (
        <>
          <div style={{ height: 8 }} />
          <div className="error-text" role="alert">
            {t('io.importError')}
          </div>
        </>
      )}
    </Panel>
  )
}
