# Roblox → Polytoria Converter

Convert classic Roblox shirt/pants clothing templates into Polytoria "PT 2.0"
templates instantly, entirely inside your browser. No backend, no uploads,
no accounts — drop a PNG in, get a Polytoria-ready PNG out.

## Why this exists

Polytoria's clothing system uses a different UV layout than Roblox's classic
template, so a Roblox shirt/pants PNG can't be uploaded to Polytoria as-is.
This app automates the region-by-region remap (torso, arms, legs, caps) so
you never have to manually cut and paste pixels in an image editor.

## How the conversion works

1. You drop a Roblox template (585×559, or an HD multiple of it) into the
   **Shirt** or **Pants** zone. Which zone receives the file *is* the type
   detection — Roblox's classic shirt and pants templates share the exact
   same pixel layout, so there is no way to tell them apart from pixel data
   alone (see "Mapping provenance" below). This still means zero manual
   editing: you never touch a pixel yourself.
2. The app validates the file (must be a real PNG, roughly the right aspect
   ratio) and rejects anything else with a clear, non-crashing error.
3. Each named face — torso front/back/left/right/top/bottom, both arms
   (shirts), both legs (pants), and their caps — is cropped from its Roblox
   source rectangle and drawn into its Polytoria destination rectangle on a
   1024×1024 (or larger, for HD input) canvas. The alpha channel is
   preserved throughout; nothing is flattened onto a background.
4. Everything above runs inside a **Web Worker** using `OffscreenCanvas`, so
   the UI never freezes — even on large HD templates — with a same-thread
   fallback for browsers that lack `OffscreenCanvas`.

### Mapping provenance — read this before trusting the output blindly

Polytoria has not published a written pixel-mapping specification between
the two template formats, so the region tables in
[`converter.js`](./converter.js) were verified in two passes rather than
invented:

1. Cross-referenced against two independent, open-source, community-built
   converters already used by the Polytoria community, which agree with
   each other to within rounding:
   - [ScoofyTheFox/Rblx-2-Polytoria-Converter](https://github.com/ScoofyTheFox/Rblx-2-Polytoria-Converter) (MIT)
   - [INEEDCHATPROGRAAAAAMS/Roblox---Polytoria-Texture-Converter](https://github.com/INEEDCHATPROGRAAAAAMS/Roblox---Polytoria-Texture-Converter)
2. **Pixel-verified directly against Polytoria's own official "Expert
   Template"** (downloaded from `polytoria.com/store/create/clothing`).
   That file is a 1024×1024 opaque/transparent mask with no color content —
   every `POLY_*` rectangle in `converter.js` was overlaid on it and
   confirmed to align exactly, pixel-for-pixel, with the opaque region
   boundaries for all 30 named faces across the torso, both arms, and both
   legs. This is the strongest evidence available short of Polytoria
   publishing written coordinates, since it's Polytoria's own asset rather
   than a third party's interpretation of it.

The app surfaces this openly in its "About the conversion mapping" panel.
If Polytoria ever changes the official template, only the `*_REGIONS`
constants at the top of `converter.js` need to change — every other module
consumes them indirectly.

A second, confirmed-non-obvious detail baked into the mapping: **Roblox's
Right Arm maps to Polytoria's Left Arm slot, and vice versa** — the two
platforms disagree on which side is "left" in template space. This is
intentional, not a bug, and matches both reference converters.

## Features

- Drag-and-drop (or click-to-browse, multi-select) **batch upload — up to 20
  shirts and 20 pants at once**, each queued independently with its own
  validation status and a remove button.
- Fully automatic conversion — no manual pixel editing at any point.
- Before/after comparison slider with a checkerboard background (so
  transparency is easy to inspect) and independent zoom per result, one
  card per converted file in a responsive grid.
- Per-file **Download** button, a toolbar **Download all** (every current
  result, individually) and **Download ZIP** (dependency-free ZIP writer,
  `STORE` method so PNGs aren't needlessly re-compressed) — recommended for
  batches.
- Automatic file naming: `Polytoria_Template.png` when there's a single
  result; `Polytoria_Shirt_1.png`, `Polytoria_Pants_1.png`,
  `Polytoria_Outfit_1.png`, etc. (numbered per garment type) for batches.
- **Optional outfit merging** — see below.
- Session conversion history (up to 5 runs, since a run can hold up to 40
  images) with Undo/Redo.
- Light/dark theme, persisted across visits.
- Keyboard shortcuts: `Ctrl/Cmd+O` open, `Ctrl/Cmd+S` download, `Ctrl/Cmd+R`
  reset, `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` undo/redo.
- Full keyboard and screen-reader support: operable drop zones, `aria-live`
  status/progress, labeled controls, visible focus states.
- 100% client-side: templates are decoded and processed in-memory and never
  leave the device — there is no server component at all.

### Merging shirt + pants into one outfit file

Turn on **"Merge matching shirt + pants into one outfit file"** in Settings
(off by default — this is opt-in) to also get combined outfit downloads
alongside the normal per-garment results.

- After converting, if both shirt and pants results exist, the app samples
  a coarse 8×8 grid of average colors from each converted image (ignoring
  transparent panel gaps) and greedily pairs each shirt with the closest-
  matching pants by color distance — the single closest pair first, then
  the next-closest among what's left, and so on.
- Each matched pair is drawn onto one combined canvas. This is a plain
  stack, not a blend: a shirt's panels (torso + both arms) and a pants'
  panels (both legs) occupy disjoint regions of the same Polytoria layout,
  verified directly against Polytoria's own Expert Template, so there's
  nothing to composite or mask. The combined canvas uses the larger of the
  two native sizes, so pairing an HD shirt with a base-resolution pants (or
  vice versa) never loses quality.
- Merged outputs appear in their own **Merged Outfits** section as
  `Polytoria_Outfit_N.png`, and are included in Download all / Download ZIP.
  They are purely additive — the individual shirt and pants results used to
  build them are never hidden or removed.
- **This is a best-effort heuristic, not a guarantee.** Color similarity is
  a reasonable proxy for "these were designed together," but it isn't
  perfect — a wardrobe with multiple garments in very similar colors can
  get paired incorrectly. Always check each merged card before relying on
  it; the individual shirt/pants downloads are still there as a fallback.

## Architecture

Zero build step, zero runtime dependencies — plain ES modules loaded
directly by the browser.

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic page structure and ARIA wiring. |
| `styles.css` | Design system: theming, glassmorphism, layout, motion. |
| `app.js` | Application state, orchestration, worker bridge, downloads, history. |
| `converter.js` | Roblox↔Polytoria region tables and the pure conversion algorithm. |
| `imageProcessor.js` | Environment-agnostic canvas/image I/O primitives (works in both Window and Worker contexts). |
| `worker.js` | Background thread entry point; delegates to `converter.js`/`imageProcessor.js`. |
| `zipWriter.js` | Minimal dependency-free ZIP (STORE method) builder. |
| `outfitMerger.js` | Optional color-similarity shirt/pants pairing and outfit merging. |
| `ui.js` | All DOM rendering and event wiring, decoupled from app state. |

## Running locally

No install step is required for the app itself (there are no runtime
dependencies to fetch). Serve the folder with any static file server, e.g.:

```bash
npm run dev
# or simply:
npx serve .
# or:
python3 -m http.server 5173
```

Then open `http://localhost:5173`. ES modules require a real HTTP server —
opening `index.html` via `file://` will not work in most browsers.

## Deployment

This is a static site: any static host works. Three ready-made options:

### Vercel

`vercel.json` is already configured (security headers only — no build step
needed). From the project root:

```bash
npx vercel
```

Or connect the repository in the Vercel dashboard with **Framework Preset:
Other** and leave the build command empty.

### Cloudflare Pages

1. Connect the repository in the Cloudflare dashboard.
2. Build command: *(leave empty)*
3. Build output directory: `/`
4. Deploy.

### GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Source** to the branch containing this
   project and the root (`/`) folder.
3. Save — GitHub will publish the static files as-is.

## Browser support

Targets current Chrome, Firefox, Safari and Edge on desktop, Android and
iOS. Requires `createImageBitmap`, the Canvas API, and (for background
processing) `Worker` + `OffscreenCanvas`; browsers without
`OffscreenCanvas` automatically fall back to synchronous main-thread
conversion instead of failing.

## Known limitations

- **Clothing-type detection is zone-based, not pixel-based** — see "Mapping
  provenance" above for why that's a property of the source format, not a
  shortcut taken by this app.
- **The region mapping has no written official spec**, but is pixel-verified
  directly against Polytoria's own Expert Template asset (see "Mapping
  provenance" above) — the strongest confirmation available short of
  Polytoria publishing coordinates in writing.
- **Artwork painted continuously across panel edges will show a seam after
  conversion.** Each panel (torso front, sleeve, etc.) is individually placed
  at its geometrically correct spot in the Polytoria layout — verified by
  converting a template with a distinct solid color painted into every named
  panel and confirming each one lands where expected, with no overlap — but
  Roblox's and Polytoria's layouts don't use the same relative spacing
  between panels. A hood shape, a
  wraparound print, or fabric folds that flow from one panel into the next
  cannot stay visually continuous across that boundary in *any* converter,
  including the reference tools this mapping is based on. Solid colors and
  art painted independently per panel are unaffected. The app surfaces this
  as an inline hint next to every result.
- Output format is PNG only for now. The output pipeline already threads an
  `outputFormat` setting through the app so adding another lossless format
  later is a small, contained change.

## License

MIT — see [`LICENSE`](./LICENSE). The region-mapping constants in
`converter.js` were derived by cross-referencing the two community projects
credited above and in the file's header comment.
