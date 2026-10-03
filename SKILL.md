---
name: promo-motion
description: >-
  Create branded promotional motion graphics with HyperFrames (HTML, CSS, GSAP ->
  deterministic video): logo stings, lower thirds, title cards, stat/KPI count-ups,
  kinetic typography, and reusable transitions. Use when the user asks for a promo,
  ad creative, social clip, brand motion, animated logo, lower third, overlay, title
  card, count-up statistic, kinetic type, intro/outro, or a reusable on-brand motion
  template; also use when rendering transparent overlays (WebM/ProRes 4444) to layer
  over footage. Orchestrates brand intake, archetype selection, authoring, optional
  audio, verification, and multi-aspect export.
---

# Promo Motion

A deterministic pipeline for **branded promotional motion graphics**. You author
HTML/CSS/GSAP; [HyperFrames](https://hyperframes.heygen.com) seeks each frame and
renders the video. The same source always produces the same frames, so promo copy,
logos, and numbers are exact.

This skill builds short, design-led motion units (usually under 10s): logo stings,
lower thirds, title cards, stat hits, kinetic type, and transitions. For narrated
multi-scene films or AI footage, this is the wrong tool; say so and point the user
to a general video workflow.

## Non-negotiable rules

These keep renders correct and deterministic. Violating them produces flaky video.

1. **Deterministic only.** No `Date.now()`, no `Math.random()` without a seed, no
   infinite repeats, no render-time network fetches for composition state.
2. **One paused timeline per composition**, registered synchronously:
   `window.__timelines[compositionId] = gsap.timeline({ paused: true })`. The key
   must equal `data-composition-id`.
3. **Timing lives in HTML**, not JS: `data-start`, `data-duration`,
   `data-track-index`. `data-track-index` is a Studio lane only; paint order is CSS
   `z-index`.
4. **Animate transforms and opacity**, never layout (`top`, `left`, `width`,
   `height`). Prefer `fromTo()` so backward seeks stay correct.
5. **Exact copy.** Never invent a statistic, price, name, or claim. If a number is
   missing, ask.
6. **Overlays leave the background unpainted.** An opaque `html`, `body`, or
   full-frame background will encode as visible pixels and destroy alpha.
7. **Read `references/hyperframes-contract.md`** before writing a composition. It is
   the authoritative local copy of the schema.

## Repo map

```
SKILL.md                       you are here (router)
references/
  hyperframes-contract.md      exact HTML schema + render/verify commands
  motion-craft.md              easing, timing, holds, safe areas, type scale
  brand-spec.md                brand tokens -> CSS vars, frame.md
  workflows/logo-sting.md      one playbook per archetype
  workflows/lower-third.md
  workflows/title-card.md
  workflows/stat-hit.md
  workflows/kinetic-type.md
  workflows/transition-pack.md
scripts/
  brand-scaffold.mjs           write a brand.tokens.json from flags
  new-project.mjs              scaffold a renderable HyperFrames project
  verify.mjs                   lint + check + snapshot + render + probe
  contact-sheet.mjs            tile frames from a render into a PNG
  probe.mjs                    ffprobe summary + alpha check
templates/
  brand.tokens.json            starter brand kit
  frame.md                     starter frame.md
```

All script paths below are relative to this skill folder. Determine the absolute
root once (usually `~/.config/opencode/skills/promo-motion`, or wherever the repo
is cloned) and use it for every command.

## Pipeline

Run these steps in order. Confirm brief details that change the output; do not
guess brand colors, copy, or numbers.

### 0. Preflight

```bash
node --version        # need 22+
ffmpeg -version | head -1
ffprobe -version | head -1
npx --yes hyperframes --version
```

If FFmpeg/ffprobe are missing, stop and say so. Without them nothing renders.

### 1. Intake

Collect a compact brief. Ask only for what is missing:

| Field | Why it matters | Default |
|---|---|---|
| `message` | The exact words/numbers on screen | required |
| `archetype` | Which playbook to build | infer from request |
| `brand` | Colors, fonts, logo, tone | offer `brand-scaffold.mjs` |
| `aspect` | 16:9 / 9:16 / 1:1 | match platform, else 16:9 |
| `duration` | Total length in seconds | archetype default |
| `output` | opaque clip vs transparent overlay | overlay for lower-third/transition |
| `audio` | silent vs voice/music/SFX | silent |

Restate the brief in one or two lines and get a go-ahead before writing files.

### 2. Brand

If no `brand.tokens.json` exists, create one (from a supplied kit, a website, or by
asking) and write a `frame.md`. Read `references/brand-spec.md`. Colors become CSS
custom properties; fonts become a display/body pair; the logo becomes an asset.

If the user has no brand, generate a deliberate, restrained default (one dominant
color, one accent, neutral type) rather than asking them to invent one. State the
assumption so it can be corrected.

### 3. Route

Pick one archetype and read its playbook before authoring:

- **Animated logo / intro / outro** -> `references/workflows/logo-sting.md`
- **Name/title bar over footage** -> `references/workflows/lower-third.md`
- **Announcement / section card** -> `references/workflows/title-card.md`
- **Count-up KPI / metric** -> `references/workflows/stat-hit.md`
- **Word-by-word message** -> `references/workflows/kinetic-type.md`
- **Reusable seam transitions** -> `references/workflows/transition-pack.md`

If several units are needed, build them as separate compositions under one
project and assemble them on the root timeline (see the contract's nested
composition section).

### 4. Scaffold

```bash
node scripts/new-project.mjs \
  --archetype logo-sting \
  --brand /path/to/brand.tokens.json \
  --out /path/to/out/<project> \
  --aspect 16:9 --duration 3 \
  --title "Acme" --message "Build faster"
```

Add `--overlay` for transparent output. The script writes a runnable
`index.html`, `brand.tokens.json`, `BRIEF.md`, `frame.md`, `assets/`, and
`compositions/`, and vendors GSAP locally into `assets/vendor/` when it can.

### 5. Author

Open the generated `index.html` and refine it against the archetype playbook and
`references/motion-craft.md`. This is where taste enters: spacing, easing, holds,
emphasis, timing. Keep the non-negotiable rules intact.

If the user provides a logo or media, place it in `assets/` and reference it by a
stable ID. Keep element IDs unique across nested compositions.

### 6. Audio (optional)

For voice, music, or SFX, use the ElevenLabs agent skills if available
(`npx skills add elevenlabs/skills`), or HyperFrames `/media-use`. Place audio with
`data-start`, `data-duration`, `data-volume`, and `data-fade-in` / `data-fade-out`.
Do not call `play()` from JS. Keep a music bed 12-18 dB under any voice.

If no audio tooling is installed, deliver silent and say so.

### 7. Verify and package

```bash
node scripts/verify.mjs /path/to/out/<project> --quality draft
```

This runs `hyperframes lint`, `check`, snapshots the beat frames, renders a draft,
and probes the file. Read the report. Fix anything lint/check flags before a final
render. Then produce the deliverables:

```bash
npx hyperframes render --output renders/<name>.mp4            # opaque
npx hyperframes render --format webm --output renders/<name>.webm   # overlay (web)
npx hyperframes render --format mov  --output renders/<name>.mov    # ProRes 4444
```

For overlays, confirm alpha with `scripts/probe.mjs` and by viewing a frame over a
checkerboard. For a multi-aspect campaign, re-render per aspect by re-authoring the
frame size (do not stretch).

## Definition of done

- `hyperframes lint` and `check` are clean (or every warning is explained).
- Snapshots at each beat frame look deliberate; first and last frames are clean.
- The exact message/copy/number is on screen and readable at full speed.
- The final render was watched, not just previewed.
- Overlays have verified transparency.
- Deliverable paths and the chosen formats are reported to the user.

## Reporting

End with a short summary: archetype, aspect, duration, output format(s), file
paths, and any assumption you made about brand or copy. Keep it to a few lines.

## Attribution

HyperFrames is an Apache-2.0 project by HeyGen, invoked as an external CLI. Motion
craft here is distilled from HyperFrames' own prompting guides and the wider
deliver-and-verify pattern used by agent motion skills.
