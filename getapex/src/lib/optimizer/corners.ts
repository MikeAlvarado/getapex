import type { Corner, SpeedLimiter } from '@/types'

export interface CornerDetectionInput {
  /** Signed curvature of the racing line per point. */
  kappa: readonly number[]
  /** Speed per point (m/s). */
  v: readonly number[]
  limiter: readonly SpeedLimiter[]
  /** Segment length from point i to i+1 (m). */
  segLengths: readonly number[]
}

interface Region {
  start: number
  end: number // inclusive, may wrap past n via modulo
}

/**
 * Corners = contiguous regions where |κ| exceeds a threshold adaptive to the
 * track (fraction of peak curvature, clamped to sane absolute radii).
 */
export function cornerCurvatureThreshold(kappa: readonly number[]): number {
  let maxK = 0
  for (const k of kappa) maxK = Math.max(maxK, Math.abs(k))
  return Math.min(1 / 50, Math.max(1 / 350, 0.15 * maxK))
}

/** Contiguous |κ|>threshold regions on a closed loop, gaps merged, runts dropped. */
function detectRegions(kappa: readonly number[], threshold: number): Region[] {
  const n = kappa.length
  const mask = kappa.map((k) => Math.abs(k) > threshold)
  if (mask.every((m) => m)) return [{ start: 0, end: n - 1 }]
  if (mask.every((m) => !m)) return []

  // Merge short gaps so chicane flicks don't split one corner into many.
  const mergeGap = Math.max(3, Math.round(n * 0.01))
  const merged = [...mask]
  let i = 0
  while (i < n) {
    if (!merged[i]) {
      let gapLen = 0
      while (gapLen < n && !merged[(i + gapLen) % n]) gapLen++
      const before = merged[(i - 1 + n) % n]
      const after = merged[(i + gapLen) % n]
      if (before && after && gapLen <= mergeGap) {
        for (let j = 0; j < gapLen; j++) merged[(i + j) % n] = true
      }
      i += gapLen
    } else {
      i++
    }
  }

  // Walk the loop starting from a non-corner point so regions don't split at 0.
  const origin = merged.findIndex((m) => !m)
  const regions: Region[] = []
  let j = 0
  while (j < n) {
    const idx = (origin + j) % n
    if (merged[idx]) {
      const start = idx
      let length = 0
      while (length < n && merged[(start + length) % n]) length++
      if (length >= 3) regions.push({ start, end: (start + length - 1) % n })
      j += length
    } else {
      j++
    }
  }
  return regions
}

const forwardDistance = (from: number, to: number, n: number): number => (to - from + n) % n

export function detectCorners(input: CornerDetectionInput): Corner[] {
  const { kappa, v, limiter, segLengths } = input
  const n = kappa.length
  const regions = detectRegions(kappa, cornerCurvatureThreshold(kappa))

  const corners = regions.map((region): Omit<Corner, 'number'> => {
    const length = forwardDistance(region.start, region.end, n) + 1
    // Apex: slowest point in the corner; curvature peak breaks ties.
    let apexIdx = region.start
    let maxAbsK = 0
    for (let offset = 0; offset < length; offset++) {
      const idx = (region.start + offset) % n
      if (
        v[idx] < v[apexIdx] - 1e-9 ||
        (Math.abs(v[idx] - v[apexIdx]) <= 1e-9 && Math.abs(kappa[idx]) > Math.abs(kappa[apexIdx]))
      ) {
        apexIdx = idx
      }
      maxAbsK = Math.max(maxAbsK, Math.abs(kappa[idx]))
    }

    // Braking point: start of the brake-limited run feeding this apex. The
    // entry plateau between brake zone and apex is corner-limited (with
    // numeric corner/accel alternation), so scan back across it — bounded by
    // the region entry — then follow the brake run to its beginning.
    let brakingIdx: number | null = null
    let walk = (apexIdx - 1 + n) % n
    let steps = 0
    const entryLen = forwardDistance(region.start, apexIdx, n)
    while (steps <= entryLen && limiter[walk] !== 'brake') {
      walk = (walk - 1 + n) % n
      steps++
    }
    while (limiter[walk] === 'brake' && steps < n - 1) {
      brakingIdx = walk
      walk = (walk - 1 + n) % n
      steps++
    }
    let brakingDistance = 0
    if (brakingIdx !== null) {
      for (let idx = brakingIdx; idx !== apexIdx; idx = (idx + 1) % n) {
        brakingDistance += segLengths[idx]
      }
    }

    return {
      startIdx: region.start,
      apexIdx,
      endIdx: region.end,
      direction: kappa[apexIdx] > 0 ? 'left' : 'right',
      entrySpeed: v[region.start],
      apexSpeed: v[apexIdx],
      exitSpeed: v[region.end],
      minRadius: maxAbsK > 0 ? 1 / maxAbsK : Infinity,
      brakingIdx,
      brakingDistance,
    }
  })

  return corners.sort((a, b) => a.startIdx - b.startIdx).map((c, i) => ({ ...c, number: i + 1 }))
}
