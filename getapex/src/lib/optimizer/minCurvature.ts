import type { Vec2 } from '@/types'

export interface MinCurvatureInput {
  /** Closed centerline, uniformly spaced. */
  centerline: readonly Vec2[]
  /** Unit normals per centerline point. */
  normals: readonly Vec2[]
  /** Usable half-width (m) — the box constraint is α·h with α ∈ [−1, 1]. */
  halfWidth: number
}

export interface MinCurvatureOptions {
  maxIterations?: number
  /** Convergence: stop when max |Δα| per iteration falls below this. */
  tolerance?: number
  /**
   * Weight of the α-smoothness tiebreaker λ·Σ(α_{i+1}−α_i)², as a fraction of
   * the centerline's mean per-point curvature energy. The main objective is
   * flat along some directions (e.g. lateral position mid-straight); this pins
   * them to smooth transitions without fighting the curvature term.
   */
  smoothness?: number
}

export interface MinCurvatureResult {
  alpha: number[]
  line: Vec2[]
  iterations: number
  /** Objective value Σ‖P″‖² before/after, for diagnostics and tests. */
  initialEnergy: number
  finalEnergy: number
}

/** Periodic second difference: out[i] = a[i−1] − 2a[i] + a[i+1]. */
function secondDiff(a: readonly number[], out: number[]): void {
  const n = a.length
  for (let i = 0; i < n; i++) {
    out[i] = a[(i - 1 + n) % n] - 2 * a[i] + a[(i + 1) % n]
  }
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/**
 * Minimum-curvature racing line (Σ‖P″‖² with P″ the second finite difference
 * of position, per the product brief).
 *
 * The line is P_i = C_i + α_i·h·n_i, linear in α, so
 * E(α) = Σ‖(D·P)_i‖² + λ·Σ(α_{i+1}−α_i)²  (D = periodic second difference)
 * is a convex quadratic with box constraints α ∈ [−1, 1]. Solved matrix-free
 * with projected gradient descent and Barzilai–Borwein steps; D is a
 * symmetric circulant, so ∇E is two applications of D:
 *   ∂E/∂α_j = 2h·[(D²Pₓ)_j·n_jx + (D²P_y)_j·n_jy] + 2λ·(Lα)_j.
 */
export function minimizeCurvature(
  input: MinCurvatureInput,
  options: MinCurvatureOptions = {},
): MinCurvatureResult {
  const { centerline, normals, halfWidth: h } = input
  const n = centerline.length
  const maxIterations = options.maxIterations ?? 4000
  const tolerance = options.tolerance ?? 1e-5
  const smoothnessFraction = options.smoothness ?? 0.05

  const cx = centerline.map((p) => p.x)
  const cy = centerline.map((p) => p.y)
  const nx = normals.map((p) => p.x)
  const ny = normals.map((p) => p.y)

  const px = new Array<number>(n)
  const py = new Array<number>(n)
  const dx = new Array<number>(n)
  const dy = new Array<number>(n)
  const ddx = new Array<number>(n)
  const ddy = new Array<number>(n)

  // λ relative to the centerline's own curvature energy so it stays a
  // tiebreaker across track scales.
  secondDiff(cx, dx)
  secondDiff(cy, dy)
  let centerEnergy = 0
  for (let i = 0; i < n; i++) centerEnergy += dx[i] * dx[i] + dy[i] * dy[i]
  const lambda = (smoothnessFraction * centerEnergy) / n

  const energyAndGrad = (alpha: readonly number[], grad: number[]): number => {
    for (let i = 0; i < n; i++) {
      px[i] = cx[i] + alpha[i] * h * nx[i]
      py[i] = cy[i] + alpha[i] * h * ny[i]
    }
    secondDiff(px, dx)
    secondDiff(py, dy)
    secondDiff(dx, ddx)
    secondDiff(dy, ddy)
    let energy = 0
    for (let i = 0; i < n; i++) {
      const aPrev = alpha[(i - 1 + n) % n]
      const aNext = alpha[(i + 1) % n]
      const diff = aNext - alpha[i]
      energy += dx[i] * dx[i] + dy[i] * dy[i] + lambda * diff * diff
      grad[i] =
        2 * h * (ddx[i] * nx[i] + ddy[i] * ny[i]) + 2 * lambda * (2 * alpha[i] - aPrev - aNext)
    }
    return energy
  }

  // Lipschitz bound: curvature part 2h²·‖D²‖ ≤ 32h², smoothness part ≤ 8λ.
  const baseStep = 1 / (32 * h * h + 8 * lambda)

  let alpha = new Array<number>(n).fill(0)
  let grad = new Array<number>(n)
  let alphaNext = new Array<number>(n)
  let gradNext = new Array<number>(n)

  const initialEnergy = energyAndGrad(alpha, grad)
  let energy = initialEnergy
  let step = baseStep
  let iterations = 0

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1
    let maxDelta = 0
    for (let i = 0; i < n; i++) {
      alphaNext[i] = clamp(alpha[i] - step * grad[i], -1, 1)
      const d = Math.abs(alphaNext[i] - alpha[i])
      if (d > maxDelta) maxDelta = d
    }
    energy = energyAndGrad(alphaNext, gradNext)

    // Barzilai–Borwein (BB1) step for the next iteration.
    let sy = 0
    let ss = 0
    for (let i = 0; i < n; i++) {
      const sDiff = alphaNext[i] - alpha[i]
      sy += sDiff * (gradNext[i] - grad[i])
      ss += sDiff * sDiff
    }
    step = sy > 1e-30 ? clamp(ss / sy, baseStep, baseStep * 1e5) : baseStep
    ;[alpha, alphaNext] = [alphaNext, alpha]
    ;[grad, gradNext] = [gradNext, grad]
    if (maxDelta < tolerance) break
  }

  const line: Vec2[] = centerline.map((c, i) => ({
    x: c.x + alpha[i] * h * nx[i],
    y: c.y + alpha[i] * h * ny[i],
  }))
  return { alpha, line, iterations, initialEnergy, finalEnergy: energy }
}
