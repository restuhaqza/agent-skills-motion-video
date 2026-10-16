---
name: promo-motion
description: >-
  Full-stack promotional motion video an agent can operate end to end: brief to
  script, brand, assets, composition, audio, QA, render, and delivery. Authors
  deterministic HTML/CSS/GSAP compositions that HyperFrames renders (MP4, or
  transparent WebM/ProRes overlays) and orchestrates the HyperFrames CLI + media
  pipeline plus generative footage, stock, and voice. Use when the user asks for a
  promo, ad creative, social clip, product/site video, explainer, logo sting,
  lower third, title card, stat/KPI count-up, kinetic type, intro/outro, overlay,
  multi-scene promo, or a reusable on-brand motion template; also when rendering
  transparent overlays to layer over footage. Covers archetype selection, brand
  tokens, local voice-over (Qwen3-TTS), music/SFX, verification, and multi-aspect
  export.
---

# Promo Motion

A **thin, opinionated orchestration and brand-taste layer** on top of
[HyperFrames](https://hyperframes.heygen.com). You author HTML/CSS/GSAP;
HyperFrames seeks each frame and renders the video. The same source always
produces the same frames, so promo copy, logos, and numbers are exact.

This skill does not re-implement the HyperFrames stack — it drives it. It adds
what the stack leaves open: a brand/motion point of view, a brief-to-plan step,
generative footage and stock, and a delivery step.

It covers both **single motion units** (usually under 10s: logo stings, lower
thirds, title cards, stat hits, kinetic type, transitions) and **multi-scene
promos** (one root timeline hosting nested compositions, voiced and music-synced).

### Relationship to the HyperFrames skills

HyperFrames ships its own skills (`/hyperframes` router, `/motion-graphics`,
`/product-launch-video`, `/media-use`, `/hyperframes-core`, `/hyperframes-audio`,
…). **This skill is a specialty layer, not a replacement.** When the request is a
general video, a long narrated film, an explainer, a PR walkthrough, a deck, or a
site tour, route through `/hyperframes` and use the matching workflow skill — then
come back here for the brand tokens, `frame.md`, deterministic promo motion, and the
QA/delivery gate. When the request is a **promo / brand motion unit** — or an
orchestrated end-to-end promo — drive it from here.

**Read `references/tooling.md` first** — it is the command/key/MCP map. The
authoritative local copy of the composition contract is
`references/hyperframes-contract.md`.

## Non-negotiable rules

These keep renders correct and deterministic. Violating them produces flaky video.

1. **Deterministic renders only.** No `Date.now()`, no `Math.random()` without a
   seed, no infinite repeats, no render-time network fetches for composition state.
2. **Generate, then freeze.** Every asset (voice, music, image, footage, stock) is
   materialised to a local file *before* a composition references it, with its
   provenance recorded. Only asset *creation* is non-deterministic; the render is not.
3. **One paused timeline per composition**, registered synchronously:
   `window.__timelines[compositionId] = gsap.timeline({ paused: true })`. The key
   must equal `data-composition-id`.
4. **Timing lives in HTML**, not JS: `data-start`, `data-duration`,
   `data-track-index`. `data-track-index` is a Studio lane only; paint order is CSS
   `z-index`.
5. **Animate transforms and opacity**, never layout (`top`, `left`, `width`,
   `height`). Prefer `fromTo()` so backward seeks stay correct.
6. **Exact copy.** Never invent a statistic, price, name, or claim. If a number is
   missing, ask.
7. **Overlays leave the background unpainted.** An opaque `html`, `body`, or
   full-frame background will encode as visible pixels and destroy alpha.
8. **Say which path you used.** State the voice/music/rendering provider chosen and
   any fallback, so the result is reproducible.

## Repo map

```
SKILL.md                       you are here (router)
references/
  tooling.md                   command + provider + MCP map (read first)
  hyperframes-contract.md      exact HTML schema + render/verify commands
  motion-craft.md              easing, timing, holds, safe areas, type scale
  brand-spec.md                brand tokens -> CSS vars, frame.md
  audio-voiceover.md           voice-over providers, Qwen3-TTS, mix levels
  workflows/                   one playbook per archetype
    logo-sting.md  lower-third.md  title-card.md
    stat-hit.md    kinetic-type.md transition-pack.md
scripts/
  verify.mjs                   full QA gate: check + keyframes + snapshot + audio + render
  assemble.mjs                 storyboard.json -> multi-scene project
  assets.mjs                   resolve media -> frozen local file + asset ledger
  deliver.mjs                  render the delivery matrix + manifest + publish
  new-project.mjs              offline fast-path scaffold for one unit (no network)
  brand-scaffold.mjs           write a brand.tokens.json from flags
  qwen-tts.mjs                 local voice-over (Qwen3-TTS via mlx-audio)
  contact-sheet.mjs            tile frames from a render into a PNG
  probe.mjs                    ffprobe summary + alpha check
  lib/archetypes.mjs           shared archetype builders + HTML shells
  lib/providers.mjs            provider clients (Replicate, ElevenLabs, Pexels)
templates/                     brand.tokens.json + frame.md + storyboard.example.json
docs/research/                 tooling-landscape.md (the research behind this)
```

All script paths below are relative to this skill folder. Determine the absolute
root once (usually `~/.config/opencode/skills/promo-motion`, or wherever the repo
is cloned) and use it for every command.

## Pipeline

Run these steps in order. Confirm brief details that change the output; do not
guess brand colors, copy, or numbers.

### 0. Preflight

```bash
npx --yes hyperframes doctor       # node/ffmpeg/chrome/docker + optional local models
npx --yes hyperframes auth status  # HeyGen signed in? which offline engines?
ffmpeg -version | head -1
uv --version                        # only for local voice-over (Qwen3-TTS)
```

Also check HyperFrames itself: `npx --yes hyperframes --version`. If FFmpeg/ffprobe
are missing, stop and say so — without them nothing renders.

### 1. Intake

Collect a compact brief. Ask only for what is missing:

| Field | Why it matters | Default |
|---|---|---|
| `message` | The exact words/numbers on screen | required |
| `scope` | Single unit vs multi-scene promo | infer from request |
| `archetype` | Which playbook to build | infer from request |
| `brand` | Colors, fonts, logo, tone | offer `brand-scaffold.mjs` |
| `aspect` | 16:9 / 9:16 / 1:1 | match platform, else 16:9 |
| `duration` | Total length in seconds | archetype default |
| `output` | opaque clip vs transparent overlay | overlay for lower-third/transition |
| `audio` | silent, local voice-over (Qwen3-TTS), and/or music/SFX | silent |

Restate the brief in one or two lines and get a go-ahead before writing files.

**Write the copy contract first.** List every string that must appear on screen
verbatim — names, roles, prices, numbers, URLs, taglines — exactly as the user
wrote them, and quote them. Do not paraphrase, re-capitalise, or tidy them: a role
that reads `VP of Engineering` when the user said `VP of Engineering at Helios` is
a defect, not a style choice. Every on-screen string comes from that list, and the
list goes into `BRIEF.md`. This is the single most common way a promo ships wrong,
and it is checked mechanically at step 8.

### 2. Brand

If no `brand.tokens.json` exists, create one (from a supplied kit, a website, or by
asking) and write a `frame.md`. Read `references/brand-spec.md`. Colors become CSS
custom properties; fonts become a display/body pair; the logo becomes an asset.

If the user has no brand, generate a deliberate, restrained default (one dominant
color, one accent, neutral type) rather than asking them to invent one. State the
assumption so it can be corrected.

### 3. Route

**First, look in the HyperFrames catalog** — it holds 400+ production blocks and
components (transitions, captions, charts, 3D, effects) that beat hand-building a
named look:

```bash
npx --yes hyperframes catalog --query "kinetic stat count-up"
npx --yes hyperframes add <name>
```

Only build a named look by hand when the catalog misses it. Then pick the archetype
playbook and read it before authoring:

- **Animated logo / intro / outro** -> `references/workflows/logo-sting.md`
- **Name/title bar over footage** -> `references/workflows/lower-third.md`
- **Announcement / section card** -> `references/workflows/title-card.md`
- **Count-up KPI / metric** -> `references/workflows/stat-hit.md`
- **Word-by-word message** -> `references/workflows/kinetic-type.md`
- **Reusable seam transitions** -> `references/workflows/transition-pack.md`

If several units are needed, build them as separate compositions under one project
and assemble them on the root timeline (see the contract's nested composition
section).

### 4. Scaffold

**Default: the HyperFrames CLI.** It writes a valid project, AI-skills files, and
scripts, and stays in sync with the framework.

```bash
npx --yes hyperframes init <project> \
  --example blank --non-interactive \
  --resolution landscape --skill promo-motion
```

`--resolution` accepts `landscape` (1920x1080), `portrait` (1080x1920), `square`
(1080x1080) and their `-4k` variants. Add `--video <file> [--audio <file>]` to
scaffold from footage (auto-transcribes).

**Offline fast path.** When there is no network, or you want a specific archetype
with brand tokens already applied, use the bundled scaffolder — it shares the same
contract and vendors GSAP locally:

```bash
node scripts/new-project.mjs \
  --archetype logo-sting \
  --brand /path/to/brand.tokens.json \
  --out /path/to/out/<project> \
  --aspect 16:9 --duration 3 \
  --title "Acme" --message "Build faster"
```

Add `--overlay` for transparent output.

**Multi-scene.** For a piece with several scenes, separate *planning* from *build*:
author a `storyboard.json` (one object per scene), then assemble it deterministically.
This keeps the promo diffable, reviewable, and batchable — start from
`templates/storyboard.example.json`.

```bash
node scripts/assemble.mjs \
  --storyboard storyboard.json \
  --out /path/to/out/<project>
```

Add `--dry-run` to print the resolved timeline without writing. The storyboard
declares `name`, `aspect`, `fps`, `brand` (path or inline), and `scenes[]`; each
scene has `id`, `archetype`, optional `duration`, and that archetype's content
fields. Scenes lay end to end unless a scene sets `start` (explicit film second)
or `overlap` (seconds into the previous scene). The assembler writes one nested
composition per scene plus a root `index.html` holding them on a single timeline,
and an `ASSEMBLY.md` with the computed timeline.

### 5. Assets (optional)

Resolve every media need to a **frozen local file** with provenance, before the
composition references it. `scripts/assets.mjs` is the operational front-end for
the provider map in `references/tooling.md`:

```bash
node scripts/assets.mjs check                                   # what is configured here
node scripts/assets.mjs resolve --type voice --text "Roast. Fresh, weekly." \
  --out out/<project>/assets/audio/vo-1.mp3                      # prints a paste-ready <audio>
node scripts/assets.mjs resolve --type stock --query "coffee beans roasting" \
  --out out/<project>/assets/footage/beans.mp4                   # Pexels; records attribution
node scripts/assets.mjs resolve --type image --prompt "…" --model black-forest-labs/flux-schnell \
  --out out/<project>/assets/img/hero.png
node scripts/assets.mjs resolve --type video --prompt "…" --model google/veo-3.1 \
  --out out/<project>/assets/footage/shot1.mp4
node scripts/assets.mjs resolve --type cutout --in assets/talk.mp4 \
  --out out/<project>/assets/footage/presenter.webm
node scripts/assets.mjs resolve --type import --in supplied/logo.png --out <project>/assets/logo.png
node scripts/assets.mjs ledger --project out/<project>
```

Types: `import`, `stock`, `cutout`, `voice`, `music`, `sfx`, `image`, `video`.
Every resolve takes `--dry-run` (prints the request, spends nothing). Re-running
the same request **reuses the frozen file** instead of regenerating, so a build is
reproducible; pass `--force` to deliberately re-roll. Each asset gets a ledger
record (provider, model, prompt, attribution, licensing) in
`assets/asset-ledger.json`.

`voice` picks the first available provider (ElevenLabs → Qwen3-TTS → Kokoro →
Replicate) unless `--provider` is set. Generative `image`/`video` require an
explicit `--model`, and Pexels is free but needs `PEXELS_API_KEY`; both are
deliberate, because model names and attribution are not guessable.

### 6. Author

Open the generated composition and refine it against the archetype playbook and
`references/motion-craft.md`. This is where taste enters: spacing, easing, holds,
emphasis, timing. Keep the non-negotiable rules intact.

If the user provides a logo or media, place it in `assets/` and reference it by a
stable ID. Keep element IDs unique across nested compositions. For anything beyond
GSAP (Lottie, Three.js, WAAPI, CSS), pick a frame adapter rather than hand-rolling
seek logic.

### 7. Audio (optional)

Read `references/tooling.md` (§2–3) for the full provider map. Pick the first
available provider and **state which one you used**. `scripts/assets.mjs resolve
--type voice|music|sfx` does this end to end and returns a paste-ready tag.

**Voice-over.**

1. **HeyGen** if signed in (`hyperframes auth login`) — best quality, word timings.
2. **ElevenLabs** if `ELEVENLABS_API_KEY` is set.
3. **Qwen3-TTS, local (Apple Silicon)** — this skill's specialty for voice *design*
   and *clone*. Read `references/audio-voiceover.md`, then:

   ```bash
   node scripts/qwen-tts.mjs --check                 # uv + ffmpeg present?
   node scripts/qwen-tts.mjs --mode voicedesign \
     --instruct "warm confident male narrator" \
     --text "Acme. Ship the future, faster." \
     --out out/<project>/assets/audio/vo-1.wav --normalize
   ```

   Modes: `voicedesign` (describe the voice in words), `customvoice` (preset speaker
   + emotion), `clone` (match a brand sample). One line per scene, normalised.

4. **Kokoro, local** — `hyperframes tts` (no keys).

**Music and SFX.** `hyperframes`/HeyGen library → Lyria → MusicGen; or ElevenLabs.
Always name a loudness target ("ducked under the voice", "under −18 dB"), then
match it with `hyperframes normalize-audio`.

**Beat sync, timings, mix.** If the piece is music-driven, build the beat grid with
`hyperframes beats` and drive cuts/reveals from `beats/<audio>.json`. Transcribe
narration (`hyperframes transcribe`) to get word timings for captions and for
**VO-paced reveals** — elements land on the spoken cue, not on an eyeballed time.

Place every audio clip with `data-start`, `data-duration`, `data-volume`, and
`data-fade-in` / `data-fade-out`. Do not call `play()` from JS. Keep a music bed
12-18 dB under any voice (see the mix-level table in `references/audio-voiceover.md`).

If no audio tooling is available, deliver silent and say so.

### 8. Verify

One gate covers the whole native suite:

```bash
node scripts/verify.mjs /path/to/out/<project> --quality draft
```

This runs `hyperframes check` (lint + runtime + layout + **motion** + **WCAG
contrast**), `keyframes` (what actually moves), `snapshot` at the beat frames (with
a `contact-sheet.jpg` for visual review), `audio` when the project has sound, then a
draft render and `probe.mjs`. Pass `--json` for a machine-readable verdict,
`--strict` to fail on warnings, and `--describe` to ask a vision model about the
frames (needs `GEMINI_API_KEY`).

**Assert the copy contract.** Pass every exact string from the brief; drift then
fails the gate instead of reaching the client:

```bash
node scripts/verify.mjs out/<project> --quality draft \
  --expect-copy "Dr. Lena Ortiz" --expect-copy "VP of Engineering at Helios"
```

A literal match in the source is the ideal. The gate also passes — but says so —
when the string is only present case-insensitively (CSS `text-transform`) or
non-literally (word-by-word animation splits the text across elements, or a
count-up binds the number at runtime). A non-literal pass is weaker evidence:
adding an `aria-label` with the exact string makes it literal *and* accessible,
which is worth doing for anything a screen reader should announce.

Fix everything `check` flags before a final render.

### 9. Deliver

Render the delivery matrix and write a manifest with `scripts/deliver.mjs` (it
picks the right container per destination, probes each file, optionally strips the
renderer tags and publishes):

```bash
node scripts/deliver.mjs out/<project> --preset web                    # mp4 + webm
node scripts/deliver.mjs out/<project> --preset overlay                # transparent webm + mov
node scripts/deliver.mjs out/<project> --preset master --strip-metadata
node scripts/deliver.mjs out/<project> --preset all --resolution landscape,4k --publish
```

Presets: `master` (mp4), `web` (mp4+webm), `overlay` (webm+mov), `social` (mp4+gif),
`all`. It writes `renders/deliverables.json`.

Or render directly:

```bash
npx --yes hyperframes render --output renders/<name>.mp4                  # opaque
npx --yes hyperframes render --format webm --output renders/<name>.webm  # overlay (web)
npx --yes hyperframes render --format mov  --output renders/<name>.mov   # ProRes 4444
```

For a multi-aspect campaign, re-render per aspect (`--resolution portrait`) or
re-author the frame size (`assemble.mjs --aspect 9:16`) — do not stretch; `deliver`
refuses a resolution whose aspect differs from the composition. For scale, use
`hyperframes cloud`, `lambda`, or `cloudrun`. For a shareable link,
`hyperframes publish`.

For overlays, confirm alpha with `scripts/probe.mjs` and by viewing a frame over a
checkerboard. Strip renderer tags when delivering:
`ffmpeg -map_metadata -1 -c copy`.

## Definition of done

- `hyperframes check` is clean (errors and, ideally, warnings) — or every warning is
  explained.
- `keyframes` shows only motion you intended; snapshots at each beat look
  deliberate; first and last frames are clean.
- The exact message/copy/number is on screen and readable at full speed, and
  `verify.mjs --expect-copy` passes for every string in the copy contract.
- The final render was watched, not just previewed.
- Overlays have verified transparency.
- Every asset is a frozen local file with recorded provenance; the provider path used
  is stated.
- `hyperframes audio` shows the voice clear over the bed (if there is audio).
- Deliverable paths and the chosen formats are reported to the user.

## Reporting

End with a short summary: scope (unit vs multi-scene), archetype(s), aspect,
duration, output format(s), the provider path(s) used, file paths, and any
assumption you made about brand or copy. Keep it to a few lines.

## Attribution

HyperFrames is an Apache-2.0 project by HeyGen, invoked as an external CLI. Motion
craft here is distilled from HyperFrames' own prompting guides and the wider
deliver-and-verify pattern used by agent motion skills.
