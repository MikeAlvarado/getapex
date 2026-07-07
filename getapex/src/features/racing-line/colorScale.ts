/** Speed heatmap ramp: cool (slow) → warm (fast). Matches the HUD legend. */
const STOPS: Array<[number, number, number]> = [
  [43, 98, 255], // #2b62ff
  [0, 212, 176], // #00d4b0
  [96, 222, 34], // #60de22
  [255, 224, 0], // #ffe000
  [255, 133, 0], // #ff8500
]

/** t ∈ [0, 1] → CSS color along the speed ramp. */
export function speedColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(scaled))
  const f = scaled - i
  const a = STOPS[i]
  const b = STOPS[i + 1]
  const r = Math.round(a[0] + (b[0] - a[0]) * f)
  const g = Math.round(a[1] + (b[1] - a[1]) * f)
  const bl = Math.round(a[2] + (b[2] - a[2]) * f)
  return `rgb(${r}, ${g}, ${bl})`
}
