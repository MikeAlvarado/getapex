# Apex (`getapex`)

Interactive racing-line optimizer. Product spec lives in `docs/BRIEF.md` — read it before
touching the physics or optimizer.

## Standards

- Vite + React + TypeScript **strict**, no `any`. Path alias `@/` → `src/`.
- The physics and optimizer are **real implementations** (min-curvature QP, two-pass velocity
  profile, friction circle). Never stub or hardcode results — flag instead.
- Pure domain math (geometry, physics, optimizer, track) is unit-tested with Vitest.
- Heavy computation runs in the Web Worker (`src/workers/racingLine.worker.ts`); the main
  thread never blocks and the canvas renders imperatively at 60fps.
- ESLint + Prettier; conventional commits; small reviewable modules.

## Architecture

```
src/
  app/                # shell, providers
  components/
    canvas/           # TrackCanvas, overlays, HUD (imperative rAF render)
    controls/         # sliders, preset picker, toggles
    ui/               # design-system primitives
  features/
    track-editor/     # drawing (hooks + components + local logic)
    racing-line/      # optimizer orchestration + UI
    car-config/       # presets + fine-tune
    telemetry/        # speed trace, corner cards
  hooks/              # useCanvasPointer, useAnimationFrame, useResizeObserver,
                      # useWorker, useDebouncedValue
  lib/                # PURE, framework-agnostic, unit-tested — never imports React
    geometry/         # vec2, catmullRom, resampleByArcLength, rdp, offsetPath, curvature
    physics/          # aero, tireModel, frictionCircle, velocityProfile
    optimizer/        # minCurvature (projected gradient), cornerDetection, apex
    track/            # track model, boundaries, closure detection
  workers/            # racingLine.worker.ts
  state/              # zustand store, typed slices (track, car, results, ui)
  styles/             # design tokens
  types/              # shared domain types (Track, RacingLine, CarSetup, …)
  i18n/               # centralized strings (default EN, ES-ready)
```

Rules:

- `lib/` never imports React. All domain math is pure and tested there.
- Canvas rendering is imperative (rAF loop) fed by store state — not re-rendered through
  React per frame.
- Worker communicates via a typed `postMessage` message contract (discriminated unions in
  `src/workers/protocol.ts`).
- Compute status is a discriminated union: `idle | computing | ready | error`.
- Units: SI internally (m, m/s, kg, N); display converts to km/h or mph.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` (Vitest, node env, `src/**/*.test.ts`)
- `npm run lint` / `npm run format`
