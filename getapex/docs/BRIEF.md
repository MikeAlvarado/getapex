# Apex — Product Brief

Single-page app: draw a race track freehand, auto-convert it into a closed circuit, and
compute + visualize the optimal racing line for a configurable car — apexes, corner speeds,
braking points. 2D top-down, flat (no elevation/banking in v1). Metric units (km/h) with a
mph toggle. Persistence via `localStorage` + JSON import/export of tracks and car setups.

## Core features

### Track drawing

- Freehand drawing with pointer (mouse/touch/pen); raw stroke captured then auto-smoothed.
- Straight-line mode while **Shift** is held or a toggle is active (anchor start → cursor).
- On finish: Ramer–Douglas–Peucker simplification → auto-detect closure (snap endpoint to
  start when near) → closed **centripetal Catmull-Rom** fit → resample at uniform
  arc-length spacing `ds`.
- Re-draw / clear supported. Control-point editing is a later enhancement.

### Track configuration

- Track width `w` (constant in v1; model kept open to per-point width).
- Boundaries = centerline offset `±w/2` along the normal.
- Car margin: effective usable half-width = `w/2 − carHalfWidth − margin`.

### Car configuration

Presets (F1, GT3, Street, Kart) + fine-tune sliders: `mass` (kg), `powerMax` (kW),
`CdA` (m²), `ClA` (m²), `muTire`, `brakeForceMax` (N), max traction force (N).
`ρ = 1.225 kg/m³`.

### Outputs

- Optimal line rendered as a speed heatmap; braking zones highlighted; apex markers;
  throttle/coast/brake segmentation.
- Per-corner cards: entry/apex/exit speed, braking point (distance before apex), min radius.
- Speed-vs-distance trace, estimated lap time, total length.
- Debounced recompute with a subtle "computing" state.

## Physics & optimizer model (implement EXACTLY — no simplification)

### Racing line — minimum curvature optimization

`P_i = C_i + α_i·h_i·n_i` with `α_i ∈ [−1, 1]`. Minimize `Σ ‖P″_i‖²` (second finite
difference). Linear in α → quadratic program with box constraints. Solve with projected
gradient descent (wrap indices — closed loop). Keep the solver modular so a min-lap-time
refinement can swap in later.

### Velocity profile — quasi-steady-state, two-pass

1. Grip-limited corner speed with downforce:
   `v²_max = (μ·m·g) / (m/R − ½·μ·ρ·ClA)` when the denominator > 0, else unbounded.
2. Forward pass: `F_drive = min(F_traction, P_max/v) − F_drag − F_roll`, `a = F_drive/m`,
   `F_drag = ½·ρ·CdA·v²`; longitudinal grip bounded by the friction circle.
3. Backward pass: deceleration bounded by `brakeForceMax` and friction circle; drag assists.
4. `v(s) = min(cornerSpeed, forward, backward)` per point.

### Friction circle

`a_lat² + a_long² ≤ (μ·g_eff)²` with `g_eff` including downforce load.
`a_long_max = √(a_grip² − a_lat²)`.

### Derived

- Apex = local min of `v` within each corner (≈ local max of `κ`).
- Corner = contiguous region where `κ` exceeds a threshold.
- Braking point = start of the backward-limited region before each apex.
- Lap time = `Σ ds / v(s)`.

## Definition of done

- Freehand + straight-mode drawing auto-closes into a valid circuit.
- Car changes visibly change line/speeds/braking via the real model (grippier car → faster
  apex; more downforce → faster high-speed corners; more drag → lower top speed).
- Worker-based compute, debounced, UI responsive.
- `lib/` fully unit-tested; no `any`; strict TS; ESLint clean.
- Tracks + setups persist and export/import as JSON. 2–3 sample tracks shipped.
