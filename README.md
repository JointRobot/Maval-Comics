# MyTube

Electron desktop app (macOS + Windows) that turns a song + cover art into a finished
music video and publishes it to YouTube: Library → Editor (live preview + composition
picker) → Publish (metadata review, quota pre-flight, upload progress) → Render Queue.

## Status

The Editor's live in-app preview is still a CSS/canvas mock — same as before. But the
actual publish path is now real, not simulated:

- **Video rendering is real.** Hitting Publish opens a hidden Electron window that
  renders the composition (Backdrop/Vinyl/Waveform/Minimal) to a `<canvas>`, driven by
  a live Web Audio `AnalyserNode` reading the real dropped audio file (so the EQ bars
  react to the actual track, not a fake keyframe loop). It's captured via
  `MediaRecorder`, then muxed with the original audio at full quality via
  `ffmpeg-static` into a real `.mp4`, saved to `~/Movies/MyTube/`. Rendering is
  real-time (captured at normal playback speed) — a 4-minute song takes about 4
  minutes to render, not the instant fake progress bar from before.
- **YouTube publish is real.** OAuth device-code flow (no embedded browser or client
  secret exposure needed), a real resumable upload to the YouTube Data API v3 with
  actual chunked PUT + drop/resume-from-offset recovery (the "connection dropped"
  message is now a real retry path, not a scripted one), and a real video URL back.
- **Quota tracking is real**, using YouTube's actual published per-operation costs —
  1600 units for the video upload alone, not the prototype's fictional ~100. Default
  daily project quota is 10,000 units, so **expect roughly 4-5 real publishes per day**
  (fewer with captions), not the ~20-90 the original mock implied. Persisted to disk,
  resets at Pacific midnight.

This whole path has been exercised end-to-end for real (sign-in → render → resumable
upload → live video URL back), not just unit-tested in isolation.

**Still not wired up / known simplifications:**
- **Captions-as-lyrics** isn't real — there's no lyrics input anywhere in the app, so
  there's nothing to upload as an SRT. The captions toggle still affects the quota
  estimate (+400 units) but doesn't call `captions.insert`. YouTube's own auto-captions
  still apply regardless, same as any YouTube video.
- **Playlist item insertion isn't called** — no playlist-picker UI exists to choose a
  target. Its 50-unit cost is still reserved in the quota estimate to stay
  conservative rather than undercount.
- **Thumbnail upload is best-effort** — uses the dropped cover art if present; a
  failure there doesn't fail the whole publish.
- **Cancel is best-effort** — it takes effect at the next render/upload checkpoint,
  not instantly mid-chunk (see the comment in `main.js`).
- **Render queue history is session-only** — reflects whatever's currently
  publishing plus tracks already marked Rendered/Published; there's no persisted job
  log across relaunches.

### Setup required before any of this works

1. A Google Cloud project with the YouTube Data API v3 enabled, an OAuth consent
   screen (Testing mode, `youtube.upload` + `youtube` scopes, your own account added
   as a test user), and an OAuth client of type **TVs and Limited Input devices**.
2. Credentials go in a `config.json` with `youtubeClientId` / `youtubeClientSecret`
   (see `config.example.json` for the shape) — **not** inside the app bundle, since
   `app.asar` is read-only once packaged. The real location is Electron's per-user
   data directory:
   - macOS: `~/Library/Application Support/MyTube/config.json`
   - Windows: `%APPDATA%/MyTube/config.json`

   For local dev (`npm start` from source), a `config.local.json` next to the source
   is also checked and is gitignored — same pattern as sitecalmshade's `secrets.php`.
3. First publish attempt triggers sign-in: the app shows a code and a URL, you approve
   in any browser, no password ever touches the app.

## Run

```
npm install
npm start
```

## Structure

- `main.js` — Electron main process; frameless 1280×820 window; wires up OAuth,
  upload, quota, and render IPC handlers.
- `preload.js` — exposes window controls, real file-path resolution, and the
  youtube/quota/publish IPC surface to the renderer.
- `renderer/` — the primary UI (`index.html`, `styles.css`, `app.js`) plus the hidden
  compositor window used only during rendering (`render.html`, `render.js`,
  `render-preload.js`). Vanilla JS, full re-render on state change, no framework.
- `src/core/youtube/` — `oauth.js` (device flow + token storage via `safeStorage`),
  `upload.js` (resumable upload client), `quota.js` (real unit-cost tracking).
- `src/core/render/composer.js` — orchestrates the hidden render window and the
  ffmpeg mux step.

## Design tokens

Ink `#1a1917` · muted `#55524b` · faint `#8a867e` · borders `#e6e3dd`/`#e0ddd6` ·
bg `#f7f6f4` · panel `#fdfcfb` · hover `#f1efeb` · chip `#efedea` · stage `#141311` ·
success `#3d7a4e` · warn `#b0813a` · error `#b0483a`.
