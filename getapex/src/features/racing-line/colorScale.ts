/** Speed heatmap ramp: cool (slow) → warm (fast). Matches the HUD legend. */
const STOPS: Array<[number, number, number]> = [
  [74, 109, 240], // #4a6df0
  [47, 191, 164], // #2fbfa4
  [143, 212, 74], // #8fd44a
  [255, 210, 58], // #ffd23a
  [255, 176, 58], // #ffb03a
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
