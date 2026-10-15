# Full-stack motion video — tooling landscape

Research for iterating `promo-motion` from a *short motion-unit generator* into a
**full-stack motion video pipeline an AI agent can operate end to end**.

- Date: 2026-10-16
- Scope: tooling that can be integrated with this skill (CLI + APIs + MCP).
- Method: read this repo top to bottom; fetched the current HyperFrames docs
  (`llms.txt`, quickstart, MCP, authentication, media-and-audio, catalog) and the
  real CLI on this machine (`hyperframes v0.8.162`, `doctor`, `auth status`);
  checked Replicate model pages, ElevenLabs MCP, Pexels API; inspected the MCP
  servers available in this agent environment.

---

## 0. TL;DR

1. **HyperFrames is no longer "just a renderer".** At v0.8.162 it ships a full
   stack: 21 agent skills, a hosted MCP connector, a 448-item block/component
   catalog, `capture` (website footage), `beats`/`audio` (music + sound
   analysis), `transcribe`, `tts`, `remove-background`, color grading,
   `normalize-audio`, cloud + AWS Lambda + Cloud Run rendering, `publish`, and a
   headless editing SDK.
2. **This skill now overlaps HyperFrames' own `/motion-graphics` skill** and
   re-implements a slice of it (archetypes, scaffold, TTS, verify). It is *behind*
   on almost every axis, and it explicitly disclaims the multi-scene/narrated work
   that "full-stack" implies.
3. **The winning move is not to re-build the stack — it is to orchestrate it.**
   Reposition `promo-motion` as the **brand-taste + orchestration layer** over the
   HyperFrames stack, and add the layers HyperFrames deliberately leaves open:
   generative footage (Replicate/fal), stock (Pexels), and a delivery step.
4. Everything that matters is **already agent-operable** (non-interactive CLI +
   MCP + JSON), so "operated by an AI agent" is a wiring problem, not a research
   problem. The real design work is *determinism boundaries* and *provider
   fallback*, sections 9–10.

---

## 1. Where the skill is today vs. what "full-stack" needs

| Stage | Full-stack needs | `promo-motion` today | Gap |
|---|---|---|---|
| Brief / script | Message, arc, narration script, storyboard | `BRIEF.md`, single-message intake | No script/storyboard/beats planning |
| Brand | Tokens → CSS vars + `frame.md` | ✅ `brand-scaffold.mjs`, `frame.md` | Fine; merge with HF `frame.md`/`design.md` |
| Assets | Logo, images, footage, cutouts, icons | logo copy only | **No image/video sourcing, no cutout** |
| Authoring | HTML/CSS/seekable animation | ✅ scaffold + 6 archetypes | Redundant vs HF catalog; no adapters (Lottie/Three/WAAPI) |
| Multi-scene | Assemble scenes on one root timeline | ad-hoc (`vibefromcafe` example) | No assembler, no beats, no storyboard→timeline |
| Voice | Plan → VO → timings | `qwen-tts.mjs` (local only) | No provider order, no word-level timings, no caption sync |
| Music/SFX | Sourced + mixed | Replicate helper (example only) | No beat grid, no ducking pipeline, no library |
| QA | Static + runtime + visual | `lint`/`check`/snapshot/probe | No `keyframes`/`inspect`/`audio`/VLM review |
| Render | Local, cloud, batch | local `hyperframes render` | No cloud/Lambda/batch, no 4K/HDR |
| Deliver | File formats, publish, upload | file paths only | No publish/upload/delivery |

---

## 2. Layer A — Authoring & render core (HyperFrames)

**Authoritative, install on demand, no global install:** `npx --yes hyperframes`.

CLI surface verified on this machine (`hyperframes --help`, v0.8.162):

- **Getting started:** `init`, `add`, `capture`, `catalog`, `preview`, `present`,
  `publish`, `render`, `open`, `catch-up`
- **Project/verify:** `lint`, `check`, `validate`, **`beats`**, **`audio`**,
  `inspect`, **`keyframes`**, `snapshot`, `media-treatment`,
  **`normalize-audio`**, **`grade-compare`**, **`compare`**, `info`,
  `compositions`, `timeline`, `history`, `docs`
- **Tooling:** `benchmark`, `browser`, `doctor`, `clean`, `upgrade`
- **Deploy:** **`cloud`** (HeyGen), **`lambda`** (AWS), **`cloudrun`** (GCP)
- **AI & integrations:** `skills`, **`transcribe`**, **`models`**, **`tts`**
  (Kokoro-82M local), **`remove-background`**
- **Account:** `auth` (OAuth or `--api-key`); `feedback`, `telemetry`

Why each matters here:

- `capture` — turns a **website into footage** (product-launch / site-tour).
  This is the missing "real footage" path with zero licensing friction.
- `beats` / `audio` — writes `beats/<audio>.json` and measures onsets, hits,
  loudness, silence **in film time**. This is the music-to-video sync engine the
  skill has no equivalent for.
- `transcribe` — word-level timestamps for captions and for VO-paced reveals;
  `models install parakeet` for the on-device path (whisper-cpp is the fallback).
- `tts` — local Kokoro (no key); the agent workflows add HeyGen/ElevenLabs on top.
- `remove-background` — mattes a **person** out of video/image → transparent WebM
  for PiP / text-behind-subject. **Person-only** (`u2net_human_seg`); non-human
  subjects need another matter (see §3.7).
- `keyframes` / `inspect` / `grade-compare` / `compare` / `benchmark` — the
  visual + performance QA the skill currently approximates with `probe` + a
  contact sheet.
- `cloud` / `lambda` / `cloudrun` — scale-out rendering, same source.
- `history` — recorded changes; useful for agent-safe edits.

**Catalog / registry:** `hyperframes catalog --query` (on-device semantic search,
local index) and `hyperframes add <name>`. The catalog is **448 items** across
3D (11), carousels (25), text & captions (74), code (12), transitions (31),
data & charts (18), scenes & demos (93), cursors (14), motion & effects (96),
surfaces (26), blocks (47). This subsumes the skill's `workflows/*` archetypes and
its hand-rolled `transition-pack`.

**SDK / libraries** (for non-CLI integration):
`@hyperframes/sdk` (headless composition editing for agents), `@hyperframes/producer`
(render from Node), `@hyperframes/engine` (capture/encode primitives),
`@hyperframes/player` (embed `<hyperframes-player>`), `@hyperframes/lint`
(standalone linter), `@hyperframes/shader-transitions`, `@hyperframes/aws-lambda`.

**Contract to keep:** composition HTML + `data-*` timing, one paused timeline per
composition keyed by `data-composition-id`, seek-safe `fromTo()` tweens,
determinism. The skill's `references/hyperframes-contract.md` is accurate but now
duplicated by HF's own `/hyperframes-core` skill — keep it only as an offline
mirror and version-stamp it.

---

## 3. Layer B — Asset generation & sourcing

> Design principle: **generate anything, then freeze it.** Generative assets must
> be materialized to a local file *before* the composition references them, so the
> render stays deterministic. Never fetch at render time.

### 3.1 Voice / TTS

| Provider | Access | Where it fits | Notes |
|---|---|---|---|
| **Kokoro-82M** | Local (`hyperframes tts`, `pip install kokoro-onnx soundfile`) | Default offline voice | 54 voices, no key |
| **HeyGen Starfish** | `HEYGEN_API_KEY` / OAuth (`hyperframes auth login`) | First choice in HF provider order | Hosted |
| **ElevenLabs** | `ELEVENLABS_API_KEY`; hosted **MCP** at `https://api.elevenlabs.io/v1/mcp`; companion skills `npx skills add elevenlabs/skills`; CLI `@elevenlabs/cli` | Voice + music + image + video, one connector | Eleven v4 model |
| **Gemini TTS** | `GEMINI_API_KEY`/`GOOGLE_API_KEY`; explicit choice | Descriptive delivery ("warm, unhurried") | 3.8 Flash / Flash-Lite / 3.1 / 2.5 |
| **Qwen3-TTS** | Local MLX (`mlx-audio`, this repo's `qwen-tts.mjs`) | Apple-Silicon voice design/clone | **Redundant with Kokoro**; niche win = voice design + clone |
| **MiniMax speech-02-hd** | Replicate | Cloud alternative | Used in repo's `vibefromcafe` example |

HF's own provider resolution order is **HeyGen → ElevenLabs → Kokoro**. The skill
should stop hand-rolling this and just *ask for what it wants*; the orchestration
is: (1) if `HEYGEN_API_KEY`/signed-in → HeyGen; (2) elif `ELEVENLABS_API_KEY` →
ElevenLabs; (3) else local Kokoro; Qwen3-TTS stays as an optional Apple-Silicon
"voice design/clone" specialty.

### 3.2 Music

- **HeyGen library → Lyria (Gemini `GEMINI_API_KEY`) → MusicGen** (local,
  `facebook/musicgen-small`) is HF's order.
- **ElevenLabs Music** via MCP.
- **Replicate** `meta/musicgen` (already used in the `vibefromcafe` example).
- Always state a **loudness target** ("under −18 dB / ducked under the voice");
  `hyperframes normalize-audio` matches integrated LUFS.

### 3.3 Sound effects

- HF **bundled 19-file library** + catalog cues.
- **ElevenLabs SFX**, Replicate `haoheliu/audio-ldm` (used in the example; the
  example notes it was *timing-unreliable*, so deterministic FFmpeg synthesis was
  used for UI hits — keep that lesson).

### 3.4 Image generation

- **OpenRouter** MCP `generate-image` (already in this environment) — inline image
  from a prompt; model selection via `list-models`.
- **Replicate** — FLUX family, SDXL, Ideogram, Recraft, etc. (`search_models`,
  `create_predictions`).
- **fal.ai** — fast hosted image/video endpoints (MCP available).
- Use for illustration-led hero art / backgrounds; **prefer code-drawn**
  (CSS/SVG/WebGL) for UI, type, geometry — matches HF's `generated-artwork` guide.

### 3.5 Video generation (footage)

From Replicate's text-to-video collection (current as of this research):

| Model | Strength | Length |
|---|---|---|
| **Runway Gen-4.5** (`runwayml/gen-4.5`) | #1 realism/physics | 5–10s |
| **Google Veo 3.1** / Fast / Lite (`google/veo-3.1*`) | Native audio, top overall | ~8s |
| **Kling Video 3.0** (`kwaivgi/kling-v3-video`) | Multi-shot (≤6 scenes), native audio | ≤15s |
| **Kling 3.0 Omni** | Reference images, video edit, consistency | ≤15s |
| **Seedance 2.0** (`bytedance/seedance-2.0`) | Multimodal refs (9 img/3 vid/3 audio), continuation | ≤15s |
| **Luma Ray 3.2** (`luma/ray-3.2`) | Reasoning, native HDR/EXR | 5/10s |
| **Grok Imagine Video** (`xai/grok-imagine-video`) | ~30s with audio, all aspect ratios | short |
| **Vidu Q3 Pro** | start→end frame control | ≤16s |
| **Hailuo 2.3** / **PixVerse v6** | cost/quality balance | 6–10s |
| **Wan 2.7 / Wan 3.0** (open) | cheapest, self-hostable | ≤30s |
| **PrunaAI p-video** | draft mode 4× faster | ≤1080p48 |

⚠️ **Sora web/app discontinued 2026-04-26; Sora API 2026-09-24** — do not build a
pipeline on it.

Access to all of the above in one place: **Replicate MCP** (already connected:
`search_models`, `create_predictions`, `get_predictions`, `create_files`,
`download_files`), or **fal.ai**.

### 3.6 Stock footage & capture

- **Pexels API** — free, REST, photos + **videos** (`/v1/videos/search`), HD/4K
  files, 200 req/h & 20k req/mo free, attribution required ("Photos provided by
  Pexels"). Good default for B-roll.
- **HyperFrames `capture`** — record a website; the zero-licensing footage path.
- Other: Unsplash (images), Pixabay, Storyblocks/Envato (paid), Getty/Shutterstock
  (enterprise).

### 3.7 Cutouts, upscale, interpolation, grade

- **Background removal:** `hyperframes remove-background` (person-only). For
  objects/products: **Robust Video Matting (RVM)**, **BiRefNet**, **MODNet**,
  **SAM 2 video** — e.g. Replicate `arielreplicate/robust_video_matting`,
  `meta/sam-2-video`. **Hair-fine** mattes need the higher-quality path.
- **Upscale / restore:** Real-ESRGAN, Topaz Video AI, Replicate super-res models.
- **Frame interpolation:** RIFE / FILM (24→60fps, slow-mo).
- **Color grade:** HyperFrames built-in grading (`grade-compare`, `media-treatment`,
  LUTs); a fixed order (tonal → hue keys → print/analogue).

---

## 4. Layer C — Assembly & audio

- **Multi-scene:** nested compositions (`data-composition-src`) hosted on one root
  timeline — already in the contract; the skill needs an *assembler* that turns a
  storyboard into that root.
- **Beat sync:** `hyperframes beats` → `beats/<audio>.json`; drive cuts/reveals from
  it. `hyperframes audio` measures hits/onsets/loudness in film time for QA.
- **Mix:** `normalize-audio` (integrated LUFS match), `data-volume` +
  `data-fade-*`, and HF's audio-effect chain + voiceover carve
  (`hyperframes-audio` skill).
- **Speed ramps:** `data-automation` rate lane (`reference/speed-ramps`).
- **VFX:** `data-vfx-chain` (WebGL2 kernel chain, deterministic per seek).
- **Batch/templating:** `data-composition-variables` + `variables` guide → one
  composition, many records (Lambda `templates-on-lambda`).

---

## 5. Layer D — QA & verification

| Check | Tool | Catches |
|---|---|---|
| Static contract | `hyperframes lint` | schema, `video_missing_muted`, `missing_data_no_timeline`, `hevc_preview_codec` |
| Runtime | `hyperframes check` / `validate` | JS errors, missing assets, contrast |
| Visual | `snapshot`, `inspect`, `compare`, `grade-compare`, `keyframes` | layout, motion, onion-skins |
| Audio | `hyperframes audio` | where sounds land, loudness, silence |
| Perf | `benchmark`, HF performance guide | slow preview/render |
| Metadata | `probe.mjs`, `ffmpeg -c:v libvpx-vp9 ... rgba` | alpha, codec, duration |
| **Semantic** | **VLM review** via OpenRouter `send-message` (multimodal) on snapshot PNGs | "is the copy correct / on brand / readable?" |

The **VLM-review layer is missing today** and is high leverage: render beat frames
with `snapshot`, then ask a vision model a fixed rubric (copy exact? contrast?
on-brand? safe areas? artifacts?). That closes the loop the skill's
"definition of done" currently leaves to the human eye.

---

## 6. Layer E — Orchestration (agent-operable surface)

**Available in this environment now:** `replicate` (35 tools), `openrouter`
(image, speech, transcription, chat/vision, model catalog), `brave-search`,
`context7`, plus the host's own tools.

**External MCP servers worth wiring:**

| Server | Endpoint / install | Unlocks |
|---|---|---|
| **HyperFrames (hosted)** | `https://mcp.heygen.com/mcp/hyperframes/` (beta) | Create + render without local CLI (HeyGen account) |
| **HeyGen** | via HeyGen account / CLI `heygen` | Avatars, Starfish TTS, music library, cloud render |
| **ElevenLabs** | `https://api.elevenlabs.io/v1/mcp` | Voice, music, SFX, image, video agents |
| **fal.ai** | hosted MCP | Fast image/video generation |
| **Replicate** | connected here | Any model incl. video/music/matte |
| **OpenRouter** | connected here | Image, speech, transcription, VLM review |
| **Pexels** | community MCP / REST | Stock photos + video |
| **FFmpeg / filesystem** | community | Local compositing, delivery |

**Harness contract:** HyperFrames CLI reads `HF_TOOL_CONTEXT` so an agent harness
can declare what it supports and get accurate guidance back
(`developers/harness-tool-context`). Worth setting when the skill shells out.

**Ops discipline for the skill:** a per-project **asset ledger** (what was
generated, by which model/version, seed/prompt, and where frozen) so re-renders
and license/attribution are auditable — HF `media-use` already models this.

---

## 7. Layer F — Render at scale & delivery

- **Local:** `hyperframes render` (MP4/MOV ProRes 4444/WebM alpha/GIF/PNG seq).
- **Cloud:** `hyperframes cloud` (HeyGen, no local Chrome/FFmpeg).
- **Distributed:** `hyperframes lambda` / `cloudrun`; batch templates via JSONL.
- **Quality:** 4K (author or supersample), HDR (BT.2020 PQ/HLG → 10-bit H.265).
- **Publish:** `hyperframes publish` (stable URL; works signed-out with a claim
  token; `--update`, `--space`).
- **Upload/deliver (not in HF):** YouTube Data API v3, TikTok Content Posting API,
  Instagram/LinkedIn Graph, X; object storage S3/R2/GCS; Mux/Cloudflare Stream for
  hosting. Metadata hygiene: `ffmpeg -map_metadata -1 -c copy` strips HF tags.

---

## 8. Integration matrix (priority)

| P | Integration | Why | Effort | Depends on |
|---|---|---|---|---|
| **P0** | Replace bespoke scaffold with `hyperframes init` + `catalog`/`add` | Stop maintaining a stale duplicate | M | — |
| **P0** | Adopt HF media pipeline: `tts`, `transcribe`, music/SFX, provider order | Removes `qwen-tts.mjs` maintenance; adds word timings | S | — |
| **P0** | `beats` + `audio` + `normalize-audio` | Beat-synced cuts; real mix QA | S | audio file |
| **P0** | `keyframes` / `inspect` / `compare` / `benchmark` in `verify.mjs` | Better QA than probe | S | — |
| **P1** | VLM frame review (OpenRouter vision) | Automated "is it right?" gate | M | snapshots |
| **P1** | Storyboard → multi-scene assembler (root timeline + nested comps) | The "full-stack" core; generalizes `vibefromcafe` | L | P0 |
| **P1** | Generative footage via Replicate (codex of models above) + freeze-to-file | B-roll/AI shots | M | Replicate MCP |
| **P1** | Stock via Pexels + `capture` | Real footage without licensing pain | S | API key |
| **P1** | Cutout (RVM/BiRefNet/SAM2) for non-human subjects | PiP / text-behind-subject for products | M | — |
| **P2** | Cloud/Lambda render + variables batch | Scale, one-output-per-record | M | HF auth |
| **P2** | Delivery: `publish` + YouTube/storage upload | Close the loop past "file path" | M | P0 |
| **P2** | ElevenLabs / HeyGen / fal MCP connectors | Hosted quality, one connector | S | accounts |
| **P2** | HDR / 4K paths | Premium deliverables | M | — |

---

## 9. Proposed architecture for the iterated skill

Keep the skill's *identity* (brand taste, deterministic promo motion, exact copy)
but make it a **thin, opinionated orchestrator** over the stack:

```
promo-motion/
├── SKILL.md                     # router: brief → plan → assets → compose → QA → render → deliver
├── references/
│   ├── hyperframes-contract.md  # keep as version-stamped offline mirror
│   ├── tooling.md               # NEW: provider orders, fallbacks, keys, MCP endpoints (this doc, distilled)
│   ├── brand-spec.md
│   ├── motion-craft.md
│   ├── script-and-beats.md      # NEW: script → storyboard → beat grid
│   ├── audio-voiceover.md       # rewrite around HF provider order
│   └── workflows/*.md           # keep only where the skill adds taste beyond the catalog
├── scripts/
│   ├── plan.mjs                 # NEW: brief → script + storyboard.json + timeline skeleton
│   ├── assets.mjs               # NEW: unified asset resolver (VO/music/SFX/image/video/stock/cutout) → frozen files + ledger
│   ├── assemble.mjs             # NEW: storyboard.json → root index.html + nested compositions
│   ├── verify.mjs               # extend: keyframes/inspect/audio/compare + VLM rubric
│   ├── snapshot.mjs / probe.mjs / contact-sheet.mjs
│   └── deliver.mjs              # NEW: render matrix + publish/upload + metadata strip
└── docs/research/tooling-landscape.md
```

**Pipeline (agent-operable, non-interactive at every step):**

0. `hyperframes doctor` + `auth status` → decide hosted vs local paths.
1. **Brief → plan:** script, storyboard (scene, beats, copy, exact numbers), aspect,
   duration, output (opaque vs overlay).
2. **Brand:** `brand.tokens.json` → CSS vars + `frame.md`.
3. **Assets (freeze):** resolve each need to a local file with a ledger record —
   VO (`tts`/hosted), music+SFX, images, generative footage (Replicate/fal),
   stock (Pexels), `capture`, cutouts (`remove-background`/RVM).
4. **Assemble:** storyboard → nested compositions on one root timeline;
   `beats` drives cuts; exact copy only.
5. **Audio:** place with `data-start/duration/volume/fade`; `normalize-audio`,
   voiceover carve.
6. **QA:** `lint` → `check` → `snapshot`/`keyframes` → `audio` → VLM rubric →
   `benchmark` (if slow).
7. **Render:** draft → watch → final; MP4 / WebM alpha / ProRes; 4K/HDR if asked;
   cloud/Lambda for scale.
8. **Deliver:** `publish` + optional upload; report paths + assumptions.

---

## 10. Risks & constraints

- **Determinism vs. generative assets.** Generative is non-deterministic; freeze
  every asset to a local file *before* it enters a composition, and record
  model+version+prompt+seed in the ledger. Renders stay reproducible; only asset
  *creation* is not.
- **Licensing/attribution.** Pexels requires visible attribution; open video
  models (Wan) have per-model licenses; third-party logos come from a logo cascade
  and must never be hand-redrawn.
- **Cost & rate limits.** Video gen is expensive and slow; always iterate at draft
  quality/resolution, then final. Mind Pexels 200/h.
- **Secrets.** Keys live in env or `~/.heygen/credentials` (mode 0600); never in
  compositions or committed files. This environment already carries Replicate +
  OpenRouter credentials.
- **Provider fallback.** Voice/music/sound have offline fallbacks (Kokoro /
  MusicGen / bundled SFX) — the skill must degrade gracefully and *say which path
  it used*.
- **Platform reality.** Sora is sunsetting; Veo/Kling/Runway/Seedance/Wan are the
  safe bets. Model names churn fast — always resolve via `search_models`/catalog
  rather than hard-coding.
- **Local machine (this env).** M1 Pro / 16 GB: fine for local HyperFrames render
  and Kokoro; heavy local video diffusion is not viable — route footage generation
  to hosted APIs. `whisper-cpp`, Kokoro, MusicGen are **not installed**; only
  ffmpeg + Chrome + Docker are ready. `hyperframes doctor` will flag the rest.

---

## 11. Sources

- HyperFrames docs index & pages: `llms.txt`, `quickstart`, `guides/mcp`,
  `guides/authentication`, `prompting/media-and-audio`, `catalog`; GitHub
  `heygen-com/hyperframes` README (21 skills, stack, catalog, Lambda).
- Local CLI: `hyperframes v0.8.162` (`--help`, `doctor`, `auth status`).
- Replicate: text-to-video collection (model names/specs above).
- ElevenLabs MCP (`elevenlabs.io/mcp`), Pexels API docs.
- This repo: `SKILL.md`, `references/*`, `scripts/*`, `examples/vibefromcafe`.
