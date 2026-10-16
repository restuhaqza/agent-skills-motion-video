# agent-skills-motion-video

A **full-stack promotional motion video** skill for AI coding agents.

Give an agent a brief. It plans the piece, resolves the brand, sources or generates
the assets, writes HTML/CSS/GSAP, and drives the HyperFrames CLI to produce a
**deterministic** MP4 — or a transparent WebM/ProRes overlay you can drop on
footage. The same source always produces the same frames, so promotional copy,
logos, and numbers land exactly.

It is a thin, opinionated layer *on top of* the [HyperFrames](https://hyperframes.heygen.com)
stack: it does not re-implement the renderer, catalog, or media pipeline — it
orchestrates them, and adds what they leave open (a brand/motion point of view,
brief-to-plan, generative footage, stock, and delivery).

Works for a single motion unit (under ~10s) **and** for multi-scene promos: one root
timeline hosting nested compositions, voiced and music-synced. For a long narrated
film, deck, or explainer, route to the matching HyperFrames workflow skill and use
this one for the brand layer.

This repo *is* an [Agent Skill](https://agentskills.io). Point OpenCode,
Claude Code, Codex, or Cursor at it and it activates on promo/motion requests.

## What it makes

| Scope | Archetype | Use for | Output |
|---|---|---|---|
| Unit | `logo-sting` | Animated logo reveal for intros/outros | MP4 or transparent overlay |
| Unit | `lower-third` | Name/title/role bar over footage | Transparent overlay |
| Unit | `title-card` | Section or announcement card | MP4 |
| Unit | `stat-hit` | Count-up statistic / KPI | MP4 or overlay |
| Unit | `kinetic-type` | Word-by-word typographic message | MP4 |
| Unit | `transition-pack` | Reusable named transitions | Transparent overlay |
| Multi-scene | — | Several units on one root timeline, voiced and music-synced | MP4 |

For promotion specifically, `logo-sting` + `title-card` + `stat-hit` +
`transition-pack` covers most brand motion needs. `lower-third` and
`transition-pack` are overlays; the rest work as standalone clips.

It also **orchestrates the wider HyperFrames surface**: the 400+ item block
catalog (`hyperframes catalog` / `add`), website capture (`hyperframes capture`),
generative footage (Replicate/fal), stock (Pexels), beat-grid music sync
(`hyperframes beats`), transcription for word-timed captions (`hyperframes
transcribe`), and cloud/Lambda rendering. See `references/tooling.md`.

## Install

```bash
# 1. Put the repo somewhere stable
git clone <your-remote> ~/promo-motion   # or keep it where it is

# 2. Make it discoverable
ln -sfn ~/promo-motion ~/.config/opencode/skills/promo-motion
# Claude Code:   ln -sfn ~/promo-motion ~/.claude/skills/promo-motion
# Codex:         ln -sfn ~/promo-motion ~/.codex/skills/promo-motion
```

Restart the agent. Verify it appears, then try:

> Using promo-motion, make a 3-second logo sting for Acme. Primary #111111,
> accent #FF5A1F, bold geometric sans. Transparent overlay for a YouTube intro.

## Requirements

- Node.js 22+
- FFmpeg + ffprobe on `PATH`
- `npx hyperframes` (HyperFrames CLI; runs on demand, no global install needed)

The pipeline vendors GSAP locally when it can, so renders do not depend on a CDN.
Run `npx hyperframes doctor` and `npx hyperframes auth status` to see what is
available locally.

**Optional providers.** Voice, music, images, footage, and rendering scale add on
top, each unlocked by a key — HeyGen (voice/music/cloud render), ElevenLabs, Gemini
(Lyria/TTS), Replicate, fal.ai, Pexels. Full fallback order in
`references/tooling.md`. Voice and music have offline fallbacks, so nothing is
required to render silent.

**Voice-over (optional).** On Apple Silicon, narration is generated locally with
Qwen3-TTS through `mlx-audio` — no cloud, no API keys. It needs `uv` on `PATH`
(`brew install uv`); the model downloads from Hugging Face on first use. Every line
is normalised to -16 LUFS and turned into a paste-ready `<audio>` tag.

## Usage

The agent drives everything from `SKILL.md`. Humans can use the scripts directly:

```bash
# Scaffold with the HyperFrames CLI (default path)
npx hyperframes init acme-sting --example blank --non-interactive --resolution landscape
npx hyperframes catalog --query "logo reveal"     # browse reusable blocks

# …or scaffold offline from a brand kit with the bundled helper
node scripts/new-project.mjs \
  --archetype logo-sting \
  --brand examples/acme/brand.tokens.json \
  --out ./out/acme-sting \
  --aspect 16:9 --duration 3 --overlay

# Multi-scene: storyboard -> project (root timeline + nested compositions)
node scripts/assemble.mjs \
  --storyboard templates/storyboard.example.json \
  --out ./out/roast
node scripts/assemble.mjs -s storyboard.json -o ./out/roast --dry-run   # preview timeline

# Assets: resolve a media need to a frozen local file + ledger record
node scripts/assets.mjs check
node scripts/assets.mjs resolve --type voice --text "Roast. Fresh, weekly." \
  --out ./out/roast/assets/audio/vo-1.mp3
node scripts/assets.mjs resolve --type stock --query "coffee beans roasting" \
  --out ./out/roast/assets/footage/beans.mp4
node scripts/assets.mjs resolve --type cutout --in assets/talk.mp4 \
  --out ./out/roast/assets/footage/presenter.webm
node scripts/assets.mjs ledger --project ./out/roast

# Deliver: render the matrix, probe it, write a manifest (optional publish)
node scripts/deliver.mjs ./out/roast --preset web
node scripts/deliver.mjs ./out/roast --preset overlay --strip-metadata
node scripts/deliver.mjs ./out/roast --preset all --resolution landscape,4k

# Full QA gate: check + keyframes + snapshot + audio + copy fidelity + render
node scripts/verify.mjs ./out/acme-sting --quality draft
node scripts/verify.mjs ./out/acme-sting \
  --expect-copy "Dr. Lena Ortiz" --expect-copy "VP of Engineering at Helios"
node scripts/verify.mjs ./out/acme-sting --json     # machine-readable verdict

# Inspect transparency for real (VP9/ProRes alpha is measured, not guessed)
node scripts/probe.mjs ./out/acme-sting/renders/overlay.webm

# Build a visual contact sheet from any rendered file
node scripts/contact-sheet.mjs ./out/acme-sting/renders/*.webm --out sheet.png

# Inspect a render (duration, codec, pixel format, alpha)
node scripts/probe.mjs ./out/acme-sting/renders/logo-sting.webm

# Local voice-over with Qwen3-TTS (Apple Silicon, no API keys)
node scripts/qwen-tts.mjs --check
node scripts/qwen-tts.mjs --mode voicedesign \
  --instruct "warm confident male narrator" \
  --text "Acme. Ship the future, faster." \
  --out ./out/acme-sting/assets/audio/vo-1.wav --normalize
```

## Layout

```
├── SKILL.md                     # agent router + pipeline
├── references/
│   ├── tooling.md               # command + provider + MCP map
│   ├── hyperframes-contract.md  # the exact HTML/render contract
│   ├── motion-craft.md          # easing, timing, safe areas, type scale
│   ├── brand-spec.md            # brand tokens -> CSS variables, frame.md
│   ├── audio-voiceover.md       # voice-over providers, Qwen3-TTS, mix levels
│   └── workflows/*.md           # one playbook per archetype
├── scripts/                     # scaffold, assemble, assets, deliver, voice-over, verify
├── templates/                   # brand tokens, frame.md, storyboard example
├── examples/                    # a real, rendered example
└── docs/research/               # tooling-landscape.md (research behind this)
```

## How it works

1. **Preflight** — `hyperframes doctor` + `auth status`: which providers and local
   engines are actually available on this machine.
2. **Brief → plan** — message, scope (unit vs multi-scene), brand, aspect, duration,
   opaque vs overlay, audio.
3. **Brand** — tokens become CSS variables and a `frame.md` (a design system
   inverted for the camera: type scale, safe areas, motion personality).
4. **Route** — search the HyperFrames catalog first, then pick an archetype playbook.
5. **Scaffold & author** — `hyperframes init` (or the offline helper) then write
   `index.html` with timed clips (`data-start`, `data-duration`) and a paused,
   seekable timeline. For multi-scene pieces, author a `storyboard.json` and run
   `assemble.mjs`, which writes one nested composition per scene plus the root
   timeline.
6. **Audio (optional)** — voice via HeyGen/ElevenLabs/local Qwen3-TTS/Kokoro; music
   and SFX with a stated loudness target. Beat grid from `hyperframes beats`; word
   timings from `hyperframes transcribe`. Mixed with `data-volume` and fades; music
   bed 12-18 dB under the voice.
7. **Verify** — `node scripts/verify.mjs`: `check` (lint + runtime + layout + motion
   + WCAG contrast), `keyframes`, `snapshot` beat frames, `audio`, draft render +
   probe. Fix everything it flags.
8. **Deliver** — `deliver.mjs` renders the matrix (MP4 / WebM alpha / ProRes / GIF),
   probes each file, writes a manifest, optionally strips the renderer tags and
   publishes; cloud/Lambda for scale. Multi-aspect = re-author, never stretch.

## Design rules

- Deterministic: no wall-clock, no unseeded randomness, no infinite repeats.
- Generate, then freeze: materialise every asset before a composition references
  it, and record its provenance.
- Movement uses transforms/opacity, not layout properties.
- Exact copy and exact numbers. Never let the model invent a stat.
- Overlays leave the background unpainted so alpha survives.
- The message must be readable at speed, first and last frames deliberate.
- Say which provider path produced the voice, music, and render.

## License

MIT. HyperFrames is Apache-2.0 and is called as an external CLI, not vendored.
