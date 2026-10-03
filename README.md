# promo-motion

Branded promotional motion graphics for AI coding agents.

Give an agent a brief. It writes HTML/CSS/GSAP. HyperFrames renders a
**deterministic** MP4, or a transparent WebM/ProRes overlay you can drop on
footage. The same source always produces the same frames, so promotional copy,
logos, and numbers land exactly.

This repo *is* an [Agent Skill](https://agentskills.io). Point OpenCode,
Claude Code, Codex, or Cursor at it and it activates on promo/motion requests.

## What it makes

| Archetype | Use for | Output |
|---|---|---|
| `logo-sting` | Animated logo reveal for intros/outros | MP4 or transparent overlay |
| `lower-third` | Name/title/role bar over footage | Transparent overlay |
| `title-card` | Section or announcement card | MP4 |
| `stat-hit` | Count-up statistic / KPI | MP4 or overlay |
| `kinetic-type` | Word-by-word typographic message | MP4 |
| `transition-pack` | Reusable named transitions | Transparent overlay |

For promotion specifically, `logo-sting` + `title-card` + `stat-hit` +
`transition-pack` covers most brand motion needs. `lower-third` and
`transition-pack` are overlays; the rest work as standalone clips.

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

## Usage

The agent drives everything from `SKILL.md`. Humans can use the scripts directly:

```bash
# Scaffold a project from a brand kit
node scripts/new-project.mjs \
  --archetype logo-sting \
  --brand examples/acme/brand.tokens.json \
  --out ./out/acme-sting \
  --aspect 16:9 --duration 3 --overlay

# Check, snapshot, render a draft, and probe the result
node scripts/verify.mjs ./out/acme-sting --quality draft

# Build a visual contact sheet from any rendered file
node scripts/contact-sheet.mjs ./out/acme-sting/renders/*.webm --out sheet.png

# Inspect a render (duration, codec, pixel format, alpha)
node scripts/probe.mjs ./out/acme-sting/renders/logo-sting.webm
```

## Layout

```
├── SKILL.md                     # agent router + pipeline
├── references/
│   ├── hyperframes-contract.md  # the exact HTML/render contract
│   ├── motion-craft.md          # easing, timing, safe areas, type scale
│   ├── brand-spec.md            # brand tokens -> CSS variables, frame.md
│   └── workflows/*.md           # one playbook per archetype
├── scripts/                     # scaffold, verify, contact sheet, probe
├── templates/                   # brand tokens + frame.md starters
└── examples/                    # a real, rendered example
```

## How it works

1. **Brief** — message, brand, aspect, duration, opaque vs overlay.
2. **Brand** — tokens become CSS variables and a `frame.md` (a design system
   inverted for the camera: type scale, safe areas, motion personality).
3. **Route** — pick an archetype playbook.
4. **Author** — generate `index.html` with timed clips (`data-start`,
   `data-duration`) and a paused, seekable GSAP timeline.
5. **Audio (optional)** — ElevenLabs skills for voice/music/SFX, mixed via
   HyperFrames `data-volume` / fades, or `media-use`.
6. **Verify & package** — `lint` + `check` + `snapshot` at beat frames, render
   draft, watch, render final, probe. Overlays get an alpha check.

## Design rules

- Deterministic: no wall-clock, no unseeded randomness, no infinite repeats.
- Movement uses transforms/opacity, not layout properties.
- Exact copy and exact numbers. Never let the model invent a stat.
- Overlays leave the background unpainted so alpha survives.
- The message must be readable at speed, first and last frames deliberate.

## License

MIT. HyperFrames is Apache-2.0 and is called as an external CLI, not vendored.
