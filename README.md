# MyTube

Electron desktop app (macOS + Windows) that turns a song + cover art into a finished
music video and publishes it to YouTube: Library → Editor (live preview + composition
picker) → Publish (metadata review, quota pre-flight, upload progress) → Render Queue.

## Status

This is a **UI recreation** of the design handoff (`design_handoff_mytube_app/`),
built as a real Electron app rather than the standalone HTML prototype. Layout,
copy, tokens, and interaction behavior are recreated pixel-for-pixel per the
handoff spec.

The backend pieces the handoff describes as real integrations are **mocked here**,
matching the prototype's own simulated behavior:
- **Composition preview** — CSS/canvas mock in the Editor stage (Backdrop / Vinyl /
  Waveform / Minimal), not the real render pipeline.
- **YouTube publish** — simulated upload progress, including the
  connection-dropped → resumed-from-offset recovery message, but no real network
  call or OAuth.
- **Quota tracking** — in-memory only, resets on relaunch.
- **Render queue** — one track's progress ticks up on a timer; nothing is actually
  rendered.

Wiring these to real modules (`YouTubeUploadClient`, `QuotaTracker`, a real
compositions/render pipeline, OAuth device flow) is future work, not done here.

## Run

```
npm install
npm start
```

## Structure

- `main.js` — Electron main process; frameless 1280×820 window.
- `preload.js` — exposes window-control IPC (close/minimize/maximize) to the renderer.
- `renderer/` — the app itself (`index.html`, `styles.css`, `app.js`); vanilla JS,
  full re-render on state change, no framework/build step.

## Design tokens

Ink `#1a1917` · muted `#55524b` · faint `#8a867e` · borders `#e6e3dd`/`#e0ddd6` ·
bg `#f7f6f4` · panel `#fdfcfb` · hover `#f1efeb` · chip `#efedea` · stage `#141311` ·
success `#3d7a4e` · warn `#b0813a` · error `#b0483a`.
