import { useStore } from '@/state/store'
import { Panel } from '@/components/ui/Panel'
import { Segmented } from '@/components/ui/Segmented'
import { Slider } from '@/components/ui/Slider'
import { t } from '@/i18n/strings'
import type { CarPresetId } from '@/types'
import { CAR_PARAM_SPECS } from './presets'

const PRESET_OPTIONS: ReadonlyArray<{ value: CarPresetId; label: string }> = [
  { value: 'f1', label: 'F1' },
  { value: 'gt3', label: 'GT3' },
  { value: 'street', label: 'Street' },
  { value: 'kart', label: 'Kart' },
]

export function CarConfigPanel() {
  const car = useStore((s) => s.car)
  const presetId = useStore((s) => s.presetId)
  const applyPreset = useStore((s) => s.applyPreset)
  const setCarParam = useStore((s) => s.setCarParam)

  return (
    <Panel title={t('car.title')}>
      <Segmented
        options={PRESET_OPTIONS}
        value={presetId === 'custom' ? null : presetId}
        onChange={applyPreset}
        ariaLabel={t('car.preset')}
      />
      <div style={{ height: 8 }} />
      {CAR_PARAM_SPECS.map((spec) => (
        <Slider
          key={spec.key}
          label={t(spec.labelKey)}
          value={car[spec.key]}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          displayValue={spec.format(car[spec.key])}
          onChange={(value) => setCarParam(spec.key, value)}
        />
      ))}
    </Panel>
  )
}
