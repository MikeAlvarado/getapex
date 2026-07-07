import type { Vec2 } from '@/types'

/** World (meters) → screen (CSS px) affine transform: uniform scale + offset. */
export interface ViewTransform {
  scale: number
  tx: number
  ty: number
}

export const worldToScreen = (view: ViewTransform, p: Vec2): Vec2 => ({
  x: p.x * view.scale + view.tx,
  y: p.y * view.scale + view.ty,
})

export const screenToWorld = (view: ViewTransform, p: Vec2): Vec2 => ({
  x: (p.x - view.tx) / view.scale,
  y: (p.y - view.ty) / view.scale,
})

/** Default drawing view: canvas center = world origin, 1 px ≈ 1.25 m. */
export const defaultView = (width: number, height: number): ViewTransform => ({
  scale: 0.8,
  tx: width / 2,
  ty: height / 2,
})

/** Fit a point set into the canvas with padding (uniform scale, centered). */
export function fitView(
  points: readonly Vec2[],
  width: number,
  height: number,
  padding = 56,
): ViewTransform {
  if (points.length === 0 || width <= 0 || height <= 0) return defaultView(width, height)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY)
  return {
    scale,
    tx: width / 2 - ((minX + maxX) / 2) * scale,
    ty: height / 2 - ((minY + maxY) / 2) * scale,
  }
}
