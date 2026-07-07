# Apex

Interactive racing-line optimizer. Draw a circuit, tune your car, and see the
optimal racing line — apexes, corner speeds, and braking points — computed live.

## Features

- **Track editor** — sketch freehand (hold Shift for straights) or use the
  Illustrator-style pen tool: click for corners, drag for curves, click the
  first point to close the loop. Or load a sample circuit.
- **Real physics** — minimum-curvature optimization, two-pass velocity profile,
  friction-circle model with aero drag and downforce. No canned results.
- **Car setups** — F1 / GT3 / Street / Kart presets, all parameters tunable.
- **Telemetry** — lap time, speed heatmap, speed trace, and per-corner cards.

Heavy computation runs in a Web Worker; the canvas renders at 60fps.

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (domain math)
npm run lint       # eslint
npm run build      # typecheck + production build → dist/
```

Product spec lives in `docs/BRIEF.md`; architecture notes in `CLAUDE.md`.

## Deploy

Hosted on Firebase. Build, then:

```bash
firebase deploy --only hosting
```
