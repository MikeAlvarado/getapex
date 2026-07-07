import type { CarPresetId, CarSetup } from '@/types'
import type { StringKey } from '@/i18n/strings'

/**
 * Real-ish reference values. Grip/brake numbers are peak figures; combined
 * usage is bounded by the friction circle at compute time.
 */
export const CAR_PRESETS: Record<CarPresetId, CarSetup> = {
  f1: {
    name: 'F1',
    mass: 798,
    powerMax: 750_000,
    cdA: 1.25,
    clA: 4.8,
    muTire: 1.8,
    brakeForceMax: 40_000,
    tractionForceMax: 16_000,
    width: 2.0,
  },
  gt3: {
    name: 'GT3',
    mass: 1300,
    powerMax: 405_000,
    cdA: 1.1,
    clA: 3.0,
    muTire: 1.35,
    brakeForceMax: 20_000,
    tractionForceMax: 9_000,
    width: 2.0,
  },
  street: {
    name: 'Street',
    mass: 1450,
    powerMax: 150_000,
    cdA: 0.75,
    clA: 0,
    muTire: 0.95,
    brakeForceMax: 13_000,
    tractionForceMax: 5_000,
    width: 1.85,
  },
  kart: {
    name: 'Kart',
    mass: 180,
    powerMax: 22_000,
    cdA: 0.55,
    clA: 0,
    muTire: 1.5,
    brakeForceMax: 2_600,
    tractionForceMax: 1_900,
    width: 1.4,
  },
}

export interface CarParamSpec {
  key: keyof Omit<CarSetup, 'name'>
  labelKey: StringKey
  min: number
  max: number
  step: number
  /** SI → display conversion for the readout. */
  format: (value: number) => string
}

export const CAR_PARAM_SPECS: CarParamSpec[] = [
  {
    key: 'mass',
    labelKey: 'car.mass',
    min: 100,
    max: 2200,
    step: 10,
    format: (v) => `${Math.round(v)} kg`,
  },
  {
    key: 'powerMax',
    labelKey: 'car.power',
    min: 10_000,
    max: 800_000,
    step: 5_000,
    format: (v) => `${Math.round(v / 1000)} kW`,
  },
  {
    key: 'cdA',
    labelKey: 'car.drag',
    min: 0.3,
    max: 2.5,
    step: 0.05,
    format: (v) => `${v.toFixed(2)} m²`,
  },
  {
    key: 'clA',
    labelKey: 'car.downforce',
    min: 0,
    max: 6,
    step: 0.1,
    format: (v) => `${v.toFixed(1)} m²`,
  },
  {
    key: 'muTire',
    labelKey: 'car.grip',
    min: 0.6,
    max: 2.0,
    step: 0.05,
    format: (v) => `μ ${v.toFixed(2)}`,
  },
  {
    key: 'brakeForceMax',
    labelKey: 'car.brakes',
    min: 1_000,
    max: 60_000,
    step: 500,
    format: (v) => `${(v / 1000).toFixed(1)} kN`,
  },
  {
    key: 'tractionForceMax',
    labelKey: 'car.traction',
    min: 1_000,
    max: 20_000,
    step: 250,
    format: (v) => `${(v / 1000).toFixed(1)} kN`,
  },
]
