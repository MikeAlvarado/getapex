/** 2D point/vector in world meters. */
export interface Vec2 {
  x: number
  y: number
}

/** A closed circuit resampled at uniform arc-length spacing. */
export interface Track {
  id: string
  name: string
  /** Closed centerline, uniform spacing; points[n-1] connects back to points[0]. */
  centerline: Vec2[]
  /** Arc-length spacing between consecutive centerline points (m). */
  ds: number
  /** Total track width (m). */
  width: number
  /** Safety margin kept off each boundary (m). */
  margin: number
  /** Total centerline length (m). */
  length: number
}

export interface CarSetup {
  name: string
  /** kg */
  mass: number
  /** W */
  powerMax: number
  /** Drag area Cd·A (m²) */
  cdA: number
  /** Downforce area Cl·A (m²) */
  clA: number
  /** Tire grip coefficient */
  muTire: number
  /** Max braking force (N) */
  brakeForceMax: number
  /** Drivetrain traction force cap (N) */
  tractionForceMax: number
  /** Car width (m) — reduces usable track width */
  width: number
}

export type CarPresetId = 'f1' | 'gt3' | 'street' | 'kart'

export type SpeedLimiter = 'corner' | 'accel' | 'brake'

export interface VelocityPoint {
  /** Lap distance at this point (m) */
  s: number
  /** Speed (m/s) */
  v: number
  /** Unsigned curvature of the racing line here (1/m) */
  kappa: number
  /** Longitudinal acceleration to the next point (m/s²) */
  aLong: number
  /** Which constraint set the speed here */
  limiter: SpeedLimiter
}

export interface Corner {
  /** 1-based corner number, in lap order */
  number: number
  startIdx: number
  apexIdx: number
  endIdx: number
  direction: 'left' | 'right'
  /** m/s */
  entrySpeed: number
  apexSpeed: number
  exitSpeed: number
  /** m */
  minRadius: number
  /** Index where braking for this corner starts, or null if no braking needed */
  brakingIdx: number | null
  /** Distance from braking point to apex along the lap (m) */
  brakingDistance: number
}

export interface RacingLineResult {
  /** Optimized line, same length/order as the track centerline */
  line: Vec2[]
  /** Lateral offset factor per point, in [-1, 1] */
  alpha: number[]
  velocity: VelocityPoint[]
  corners: Corner[]
  /** s */
  lapTime: number
  /** Racing line length (m) */
  lineLength: number
  /** Track centerline length (m) */
  trackLength: number
}

export type Units = 'metric' | 'imperial'

export type ComputeStatus =
  | { state: 'idle' }
  | { state: 'computing' }
  | { state: 'ready' }
  | { state: 'error'; message: string }
