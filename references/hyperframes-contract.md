# HyperFrames contract (local reference)

Authoritative local copy of the HyperFrames composition + render contract.
Source: <https://hyperframes.heygen.com/reference/html-schema.md> and
<https://hyperframes.heygen.com/guides/gsap-animation.md>. When in doubt, re-fetch
those pages; this file is a distillation, not a replacement.

## Project shape

```
project/
├── index.html            main composition (rendered by default)
├── hyperframes.json      project settings (optional)
├── compositions/         scenes / reusable parts (nested)
├── assets/               images, video, audio, fonts, vendor/gsap.min.js
├── BRIEF.md              what the video must communicate
├── frame.md              visual direction
└── renders/              output
```

Only the source is essential. Planning files preserve decisions across sessions.

## Minimal composition

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="./assets/vendor/gsap.min.js"></script>
    <style>
      body { margin: 0; }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
      .clip { position: absolute; inset: 0; display: grid; place-items: center; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0"
         data-duration="5" data-width="1920" data-height="1080">
      <section id="title-card" class="clip" data-start="0"
               data-duration="5" data-track-index="1">
        <h1 id="title">Hello</h1>
      </section>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const timeline = gsap.timeline({ paused: true });
      timeline.fromTo("#title",
        { y: 48, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.2);
      window.__timelines.main = timeline;
    </script>
  </body>
</html>
```

## Composition root

| Attribute | Required | Meaning |
|---|---|---|
| `data-composition-id` | Yes | Unique ID; must equal the `window.__timelines` key |
| `data-start="0"` | Yes on top-level root | Composition start |
| `data-width` / `data-height` | Yes | Authored frame size in px |
| `data-duration` | Usually | Render length in seconds (read before scripts run) |
| `data-no-timeline` | Only if no timeline | Opt out of timeline readiness (avoids a 45s wait; lint reports `missing_data_no_timeline`) |

An explicit root `data-duration` is the render length. Rely on inference (timelines
+ media) only when you must; explicit is clearer.

## Timed clips

| Attribute | Required | Meaning |
|---|---|---|
| `id` | Yes | Stable identifier for timing/animation |
| `data-start` | Yes | Seconds, or relative: `clipId`, `clipId + 0.5`, `clipId - 0.5` |
| `data-duration` | DOM/nested yes; image default 3s; video/audio source length | Visible slot length |
| `data-track-index` | No | Studio lane only. Render ignores it. Use CSS `z-index` for order |
| `class="clip"` | Recommended for DOM/images | Full-frame box convention |

Relative `data-start` resolves within one composition, must resolve to a known
duration, and cannot cycle.

## Media

```html
<video id="demo" src="./assets/demo.mp4" data-start="0" data-duration="8"
       data-track-index="0" muted playsinline></video>
```

| Attribute | Applies to | Meaning |
|---|---|---|
| `data-media-start` | video, audio | Offset into source (trim). Use this name for `<video>`/`<audio>` |
| `data-playback-start` | nested composition | Canonical name for composition hosts (child-timeline offset) |
| `data-playback-rate` | all | 0.1 to 10 |
| `data-volume` | video, audio | 1 = 0 dB; 0 = silence; up to 3.98 (+12 dB) |
| `data-fade-in` / `data-fade-out` | video, audio | Edge fades in seconds, anchored to clip edges |
| `data-has-audio="true"` | video | Declares the video contributes audio |

Every timed `<video>` must be `muted` or `data-has-audio="true"` (lint
`video_missing_muted`). Never call `play()`, `pause()`, or set `currentTime` from
JS; HyperFrames owns media. To move/resize a video, animate a wrapper.

## Relative timing

```html
<video id="intro" data-start="0" data-duration="4" ...></video>
<section id="result" class="clip" data-start="intro + 0.5" data-duration="3">…</section>
```

Put intentional overlaps on different tracks.

## Nested compositions

Host declares a fixed window; the source file transports markup through
`<template>` with its own styles/scripts inside:

```html
<!-- host -->
<div id="pricing-scene" data-composition-id="pricing"
     data-composition-src="./compositions/pricing.html"
     data-start="4" data-duration="6" data-track-index="1"
     data-width="1920" data-height="1080"></div>
```

```html
<!-- compositions/pricing.html -->
<template>
  <style>#root { position:absolute; inset:0; }</style>
  <div id="root" data-composition-id="pricing" data-width="1920" data-height="1080">
    <!-- scene content -->
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const timeline = gsap.timeline({ paused: true });
    // scene animation
    window.__timelines.pricing = timeline;
  </script>
</template>
```

Seek nested timelines independently. Do **not** add a child timeline to the parent.
The inner timeline holds its final state if shorter than the host slot.

## Variables

```html
<html data-composition-variables='[
  {"id":"title","type":"string","label":"Title","default":"Hello"}
]'>
```

Bind with `data-var-text`, `data-var-src`, or CSS `var(--variableId)`. Pass values
on a nested host with `data-variable-values='{"title":"Built for teams"}'`, or at
render time for batch output.

## Animation contract

- One finite timeline, `{ paused: true }`, registered synchronously on
  `window.__timelines` under `data-composition-id`.
- Give important tweens explicit positions.
- Prefer `fromTo()`; it stays correct after backward/random seeks.
- Animate transforms + opacity. Avoid layout properties.
- No wall-clock state, no unseeded randomness, no infinite repeats.
- Elements with `data-composition-id` participate in readiness; for a static
  section use a plain `id` (or `data-no-timeline`).

## Verify and render

```bash
npx hyperframes lint                                   # static contract
npx hyperframes check                                  # runtime/layout/motion/contrast
npx hyperframes snapshot --at 0,0.6,2.9                # stills at key frames
npx hyperframes render --output renders/final.mp4
npx hyperframes render --quality draft --output renders/review.mp4
npx hyperframes render --fps 60 --output renders/final-60.mp4
npx hyperframes render --format webm --output renders/overlay.webm   # transparency (web)
npx hyperframes render --format mov  --output renders/overlay.mov    # ProRes 4444
npx hyperframes render --format gif --fps 15 --output renders/preview.gif
npx hyperframes render --composition compositions/intro.html --output renders/intro.mp4
npx hyperframes doctor                                 # environment checks
```

Formats: MP4 (share), MOV (ProRes 4444 / transparent intermediate), WebM
(transparent web), GIF (preview, no audio), PNG sequence, HLS.

Transparency: leave the background unpainted. To confirm VP9 alpha, select the
alpha-aware decoder *before* the input:

```bash
ffmpeg -c:v libvpx-vp9 -i overlay.webm -frames:v 1 -pix_fmt rgba frame.png
```

Rendered files carry `hyperframes_renderer` / `hyperframes_version` container tags;
strip with `ffmpeg -map_metadata -1 -c copy`. Not a watermark.

## Determinism reminders

Avoid: current clock, unseeded randomness, render-time network for state. Same
source + media + settings + timestamp => same state. Use a seeded PRNG (e.g. a
mulberry32 with a fixed seed) if you need organic variation.
