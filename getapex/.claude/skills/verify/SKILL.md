---
name: verify
description: Build, launch, and drive Apex (racing-line optimizer) to verify changes end-to-end in the browser.
---

# Verifying Apex

## Launch

```bash
npm run dev        # Vite, serves http://localhost:5173/ in <1s
```

Run it in the background and drive the app with the Claude-in-Chrome tools
(navigate to http://localhost:5173/, then screenshot/click/drag on the canvas).

## Flows worth driving

- **Freehand drawing**: press-drag a closed loop on the canvas. Note: the
  browser driver's `left_click_drag` moves in a straight line and dispatches
  few pointermove events, so it cannot trace a closed freehand loop — use the
  sample-track buttons (Grand Prix / Kart Sprint / Speedway) to get a track
  instead, or verify freehand only for degenerate/error paths.
- **Pen tool**: switch the HUD segmented control to "Pen". Single clicks place
  corner anchors; `left_click_drag` places a smooth anchor with symmetric
  handles (works fine — only needs one move event). Click the first anchor
  (ring marker) to close; the track builds and the worker computes the line.
  Keys: Enter closes (≥3 anchors), Backspace pops an anchor, Escape cancels.
- **Compute pipeline**: after any track loads, the header shows track length,
  top speed, and lap time; corner cards appear on the right. That is the
  worker round-trip evidence.
- **Errors** surface as a red note at the bottom-center of the canvas for
  3.5 s (e.g. "Circuit too small. Draw a larger loop").

## Gotchas

- The canvas re-renders only when its dirty-check stamp changes; if a
  screenshot looks stale, move the pointer once.
- State persists to localStorage (`getapex:v1`) — a previously drawn track
  reappears on reload; press Clear for a clean slate.
