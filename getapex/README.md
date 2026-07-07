# Apex

Interactive racing-line optimizer. Draw a circuit, tune your car, and watch the
optimal racing line — apexes, corner speeds, and braking points — computed live
with a real physics model. 2D top-down, flat track, SI units internally with a
km/h / mph display toggle.

The product spec lives in [`docs/BRIEF.md`](docs/BRIEF.md); contributor rules in
[`CLAUDE.md`](CLAUDE.md).

## Features

- **Track editor**, two tools:
  - *Freehand* — drag to sketch; hold **Shift** (or the toggle) for straight
    segments. Finish near the start and the loop closes itself.
  - *Pen* — Illustrator-style: click places a corner anchor, click-drag pulls
    out symmetric Bézier handles, clicking the first anchor closes the loop
    (**Enter** closes, **Backspace** removes the last anchor, **Esc** cancels).
- **Sample circuits** — Grand Prix, Kart Sprint, Speedway, Paddock Kart (a
  second, more technical kart layout), Harbor City (a street circuit with
  90° corners and a chicane), and Ardennes GP (a fast, flowing GP-style
  circuit with a tight hairpin, an uphill esses, and a closing chicane) — all
  built from control polygons through the same pipeline as drawn tracks.
- **Car setup** — F1 / GT3 / Street / Kart presets plus sliders for mass,
  power, drag CdA, downforce ClA, tire grip μ, brake force, and traction limit.
  Every change re-optimizes the line, so cause and effect are visible: more
  downforce → faster sweepers, more drag → lower top speed.
- **Outputs** — speed-heatmap racing line, braking zones, apex markers with
  corner numbers, per-corner cards (entry/apex/exit speed, braking distance,
  min radius), speed-vs-distance trace with hover sync to the map, lap time.
- **Persistence** — everything survives reload via `localStorage`; tracks and
  setups export/import as JSON.

## How it works

The whole computation is a pure-function pipeline. A drawn stroke goes in; a
racing line with a velocity profile and corner analysis comes out.

### 1. Stroke → closed circuit (`lib/track`, `lib/geometry`)

1. **Simplify** the raw pointer stroke with Ramer–Douglas–Peucker (freehand
   only — pen anchors are already sparse).
2. **Close the loop**: if the endpoint is within a size-proportional threshold
   of the start, trailing points that crowd the start are dropped and the loop
   snaps shut; otherwise the stroke is rejected with a message.
3. **Fit a smooth curve**: freehand control points get a closed *centripetal
   Catmull-Rom* fit (centripetal parameterization avoids cusps and
   self-intersection near tight control points); pen anchors are sampled
   directly as cubic Béziers.
4. **Resample at uniform arc length** — the optimizer and physics assume
   constant spacing `ds` (2–8 m depending on track length). The result is the
   `Track`: a closed centerline polyline + width + margin.

Track boundaries are the centerline offset ±w/2 along per-point normals. The
racing line may use half-width `w/2 − carWidth/2 − margin`.

Width is capped to what the tightest corner can carry (`maxSafeWidth` in
`lib/track/buildTrack.ts`, ≈ 2× the smallest radius of curvature minus a
clearance): a hairpin sharper than the requested width would otherwise offset
the boundary past itself. The cap applies wherever a track's width can
change — drawing, the track-width slider, sample selection, JSON import, and
`localStorage` hydration — so the boundary can never self-intersect.

### 2. Racing line — minimum-curvature QP (`lib/optimizer/minCurvature.ts`)

The line is parameterized laterally: each point is

```
P_i = C_i + α_i · h · n_i        α_i ∈ [−1, 1]
```

where `C_i` is the centerline, `n_i` its unit normal, and `h` the usable
half-width. The objective is total squared curvature `Σ ‖P″_i‖²`, with `P″`
the periodic second finite difference, plus a small smoothness tiebreaker
`λ·Σ(α_{i+1}−α_i)²` (the main objective is flat mid-straight; λ pins those
directions to smooth transitions). Because `P` is linear in α, this is a
convex quadratic program with box constraints.

It is solved matrix-free with **projected gradient descent** using
**Barzilai–Borwein steps**: the second-difference operator is a symmetric
circulant, so the gradient is just two applications of it, and each iteration
is O(n). A Lipschitz bound on the Hessian seeds the step size; convergence is
declared when `max |Δα|` falls below tolerance.

### 3. Velocity profile — quasi-steady-state, two passes (`lib/physics`)

Per point, speed is the minimum of three constraints:

1. **Grip-limited corner speed**, downforce-aware. From
   `m·v²·κ ≤ μ·(m·g + ½ρ·ClA·v²)`:

   ```
   v² = μ·m·g / (m·κ − ½·μ·ρ·ClA)
   ```

   If the denominator is ≤ 0, downforce grows grip faster than lateral demand
   and the corner is flat-out (capped by terminal velocity, found by bisecting
   drive force = drag + rolling resistance).

2. **Forward pass (acceleration)** — drive force is
   `min(tractionLimit, P_max/v)` minus drag `½ρ·CdA·v²` and rolling
   resistance, and longitudinal grip is bounded by the **friction circle**:
   `a_long ≤ √((μ·g_eff)² − a_lat²)` where `g_eff` includes downforce load.

3. **Backward pass (braking)** — deceleration bounded by brake force and the
   friction circle; drag helps slow the car.

Both passes start from the globally slowest corner and sweep the closed loop
twice so constraints propagate across the start/finish wrap. Each point
records which constraint won (`corner | accel | brake`) — that drives the
braking-zone overlay and corner cards. Lap time is `Σ ds / v̄` per segment.

### 4. Corner detection & apexes (`lib/optimizer/corners.ts`)

Corners are contiguous regions where |κ| of the racing line exceeds an
adaptive threshold (a fraction of peak curvature, clamped to sane radii).
Short gaps are merged so a chicane flick doesn't split into two corners, and
runt regions are dropped. Within each corner the apex is the speed minimum,
and the braking point is the start of the brake-limited region before it.

### 5. Orchestration — Web Worker + debounce

The pipeline runs in a **Web Worker** (`src/workers/racingLine.worker.ts`)
behind a typed `postMessage` contract (discriminated unions in
`src/workers/protocol.ts`, stale responses dropped by `requestId`). Track or
car edits are debounced (250 ms); while computing, the previous line renders
dimmed. The main thread never blocks.

### 6. Rendering

The canvas is **imperative**: a single `requestAnimationFrame` loop reads the
zustand store and draws grid, asphalt, boundaries, racing line (per-segment
speed colors), overlays, and the in-progress stroke/pen path. React never
re-renders per frame — a cheap dirty-check stamp (ids, versions, view
transform) skips redraws when nothing changed. DPR-aware bitmap sizing keeps
it crisp on retina displays.

## Architecture

```
src/
  app/                # shell, providers
  components/
    canvas/           # TrackCanvas + imperative render loop + view transform
    controls/         # sliders, preset picker, toggles
    ui/               # design-system primitives (Button, Panel, Slider, …)
  features/
    track-editor/     # freehand + pen drawing, samples, JSON import/export
    racing-line/      # worker orchestration hook, speed color scale
    car-config/       # presets + fine-tune panel
    telemetry/        # speed trace, corner cards
  hooks/              # useAnimationFrame, useResizeObserver, useDebouncedValue
  lib/                # PURE, framework-agnostic, unit-tested — never imports React
    geometry/         # vec2, Catmull-Rom, Bézier, RDP, resampling, curvature, offsets
    physics/          # aero, friction circle, velocity profile, constants
    optimizer/        # min-curvature QP, corner detection, pipeline entry
    track/            # stroke/anchors → Track, boundaries, usable width
  workers/            # racingLine.worker.ts + typed message protocol
  state/              # zustand store (track / car / results / ui slices) + persistence
  styles/ types/ i18n/
```

Rules the code follows:

- `lib/` is pure and fully unit-tested; React appears nowhere in it.
- Compute status is a discriminated union (`idle | computing | ready | error`).
- SI units internally (m, m/s, kg, N); conversion happens only at display.
- All UI strings live in `src/i18n/strings.ts` (EN default, ES-ready).

## Libraries

Deliberately minimal — the interesting parts are hand-rolled:

| Library | Role |
|---|---|
| [React 19](https://react.dev) | UI shell (panels, controls — not the canvas loop) |
| [zustand 5](https://github.com/pmndrs/zustand) | app state, subscribable outside React |
| [Vite 8](https://vite.dev) | dev server, build, worker bundling |
| [TypeScript 6](https://www.typescriptlang.org) | strict mode, no `any` |
| [Vitest 4](https://vitest.dev) | unit tests for all domain math |
| ESLint 10 + Prettier 3 | lint/format |

No math, geometry, canvas, or physics dependencies — `lib/` is all
first-party and testable.

## Development

```bash
npm install
npm run dev          # dev server at localhost:5173
npm test             # Vitest (geometry, physics, optimizer, track building)
npm run test:watch
npm run lint
npm run format
npm run build        # tsc -b + vite build → dist/
npm run preview      # serve the production build locally
```

## Deploy

Firebase Hosting serves `dist/` (see `firebase.json`; hashed assets get
immutable cache headers, `index.html` is `no-cache`):

```bash
npm run build
firebase deploy --only hosting
```
