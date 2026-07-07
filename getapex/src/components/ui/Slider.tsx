import { useId } from 'react'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  displayValue: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, displayValue, onChange }: SliderProps) {
  const id = useId()
  return (
    <div className="slider">
      <label className="slider-label" htmlFor={id}>
        {label}
      </label>
      <output className="slider-value" htmlFor={id}>
        {displayValue}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
