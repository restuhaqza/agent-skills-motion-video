# Tooling & integrations

The exact tools this skill orchestrates, in fallback order, with the keys and
endpoints that unlock each one. Everything here is **non-interactive** (CLI flags
or MCP calls), so an agent can drive it.

Rule of thumb: **the HyperFrames CLI + its media pipeline are the default.** Reach
for an external provider only for what HyperFrames deliberately leaves open —
generative footage, stock, and delivery.

- HyperFrames CLI reference: `npx --yes hyperframes <cmd> --help`
- Full research write-up: `docs/research/tooling-landscape.md`

---

## 0. Preflight

```bash
npx --yes hyperframes doctor        # node, ffmpeg, chrome, docker, local models
npx --yes hyperframes auth status   # HeyGen signed in? which offline engines?
```

`doctor` flags the optional local engines (whisper-cpp, Kokoro, MusicGen). Only
FFmpeg/ffprobe + Chrome are required to render. `auth status --json` returns
`{ configured, recommended_action, offline_engines }` for scripts.

---

## 1. Render / authoring core — required

| Need | Command |
|---|---|
| Scaffold | `hyperframes init <name> --example <blank\|swiss-grid\|warm-grain> --non-interactive --resolution landscape\|portrait\|square` |
| Scaffold from footage | `hyperframes init <name> --video <file> --audio <file>` (auto-transcribes) |
| Catalog search | `hyperframes catalog --query "<need>"` |
| Install a block | `hyperframes add <name>` |
| Gate | `hyperframes check --json` (lint + runtime + layout + motion + contrast) |
| Lint only | `hyperframes lint` |
| Visual stills | `hyperframes snapshot --at 0,1.2,3 --describe [q]` |
| Keyframes | `hyperframes keyframes --json [--shot out.png]` |
| Timeline | `hyperframes timeline` / `hyperframes compositions` / `hyperframes info` |
| Render | `hyperframes render --format mp4\|webm\|mov\|gif --quality draft\|standard\|high --output …` |
| Batch/variables | `hyperframes render --variables '{"title":"X"}'` or `--batch rows.json` |
| Scale | `hyperframes cloud` · `hyperframes lambda` · `hyperframes cloudrun` |
| Publish | `hyperframes publish [--update] [--space <s>]` |

Adapters beyond GSAP: CSS `@keyframes`, WAAPI, Anime.js, Lottie, Three.js,
TypeGPU; per-pixel effects via `data-vfx-chain`; speed ramps via
`data-automation`. Prefer the catalog over hand-building named looks.

---

## 2. Voice (TTS) — fallback order

Pick the first available; **state which one you used.**

| Order | Provider | Unlock | Notes |
|---|---|---|---|
| 1 | **HeyGen Starfish** | `HEYGEN_API_KEY`, or `hyperframes auth login` → `~/.heygen/credentials` | Hosted; also gives music library + cloud render |
| 2 | **ElevenLabs** | `ELEVENLABS_API_KEY` (CLI `@elevenlabs/cli`, skills `npx skills add elevenlabs/skills`, MCP below) | Eleven v4 |
| 3 | **Qwen3-TTS (local)** | Apple Silicon + `uv`; `scripts/qwen-tts.mjs` | **This skill's specialty: `voicedesign` + `clone`** |
| 4 | **Kokoro-82M (local)** | `pip install kokoro-onnx soundfile`; `hyperframes tts` | 54 voices, zero keys |
| 5 | Gemini TTS | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Explicit choice; descriptive delivery |
| 5b | MiniMax speech-02-hd | Replicate | Cloud alternative |

EightLabs/Gemini details and mix levels live in `references/audio-voiceover.md`.
Narration always comes back with a **transcription pass** → word timings for
captions and VO-paced reveals.

---

## 3. Music & SFX — fallback order

| Order | Provider | Unlock |
|---|---|---|
| 1 | HeyGen music/SFX library | HeyGen credential |
| 2 | Lyria | `GEMINI_API_KEY` / `GOOGLE_API_KEY` |
| 3 | MusicGen (local) | `pip install transformers torch soundfile numpy` |
| 4 | Replicate `meta/musicgen`, ElevenLabs Music | `REPLICATE_API_TOKEN` / ElevenLabs |
| SFX | bundled 19-file library; ElevenLabs SFX; Replicate `haoheliu/audio-ldm` | — |

Always name a **loudness target** ("ducked under the voice", "under −18 dB"), then
match with `hyperframes normalize-audio`. Keep the `vibefromcafe` lesson: for
short UI hits, deterministic FFmpeg synthesis beats an unpredictable model.

Beat grid: `hyperframes beats` → `beats/<audio>.json`. Measure with
`hyperframes audio --json` (onsets, hits, loudness, silence, in film time).

---

## 4. Images

| Provider | Unlock | Use for |
|---|---|---|
| Code (CSS/SVG/WebGL) | — | UI, type, geometry, charts — **default** |
| OpenRouter `generate-image` | OpenRouter MCP | Illustration/photo when a model is right |
| Replicate (FLUX, SDXL, Ideogram, Recraft) | `REPLICATE_API_TOKEN` | Higher-fidelity art |
| fal.ai | fal MCP | Fast hosted image/video |

---

## 5. Generative footage (video)

Access via **Replicate** (`replicate` MCP: `search_models` → `create_predictions`
→ `get_predictions` → `download_files`) or **fal.ai**. Resolve the model by search
each time — names churn quarterly.

| Use case | Model |
|---|---|
| Best realism/physics | `runwayml/gen-4.5` |
| Overall + native audio | `google/veo-3.1` (+ `-fast`, `-lite`) |
| Multi-shot narrative (≤6 scenes) | `kwaivgi/kling-v3-video` |
| Reference consistency / video edit | `kwaivgi/kling-v3-omni-video` |
| Many refs (9 img/3 vid/3 audio), continuation | `bytedance/seedance-2.0` (+ `-fast`) |
| Reasoning + HDR/EXR | `luma/ray-3.2` |
| Fast social, all aspect ratios | `xai/grok-imagine-video` |
| Start→end frame control | `vidu/q3-pro` |
| Cost/quality balance | `minimax/hailuo-2.3`, `pixverse/pixverse-v6` |
| Open/self-host | `wan-video/wan-2.7-t2v`, `alibaba/wan-3` |
| Fast draft iteration | `prunaai/p-video` (draft mode) |

Clips are 5–15 s; chain with extension models for longer runs. ⚠️ **Sora is
sunsetting** (web/app 2026-04-26, API 2026-09-24) — do not depend on it.

**Freeze rule:** download every generated clip to `assets/` and record
model+version+prompt+seed in the asset ledger *before* referencing it in HTML.

---

## 6. Stock & capture

| Source | Unlock | Notes |
|---|---|---|
| `hyperframes capture <url>` | — | Website → footage; zero licensing friction |
| Pexels API | `PEXELS_API_KEY` (free) | `/v1/videos/search` + `/v1/search`; HD/4K; 200 req/h, 20k/mo; **attribution required** |
| Unsplash / Pixabay | API key | Images |
| Storyblocks / Envato | paid | B-roll library |

---

## 7. Cutouts, upscale, interpolation, grade

| Need | Tool |
|---|---|
| Person cutout | `hyperframes remove-background` (→ transparent WebM / PNG) |
| Object/product cutout | RVM / BiRefNet / MODNet / SAM 2 video (e.g. Replicate `arielreplicate/robust_video_matting`, `meta/sam-2-video`) |
| Upscale/restore | Real-ESRGAN, Topaz Video AI |
| Frame interpolation | RIFE, FILM |
| Grade | HyperFrames grading (`grade-compare`, `media-treatment`, LUTs) |

`remove-background` notes:

- **Person subjects only** (built-in `u2net_human_seg`). Products/animals/objects
  return an empty mask — route those to a different matter.
- **Output type follows the input**: image input → `.png`; video input →
  `.webm`/`.mov`. Mismatched extensions are rejected.
- It needs a **one-time `onnxruntime-node` install** on first use. If npm's
  `allowScripts` policy blocks the postinstall (error `EALLOWSCRIPTS`), install it
  manually, then retry:
  ```bash
  npm install onnxruntime-node@1.21.1 --prefix ~/.cache/hyperframes/optional/onnxruntime-node@1.21.1
  ```
- Run it through `scripts/assets.mjs resolve --type cutout …` to get the guard,
  the ledger record, and the alpha check for free.

`scripts/assets.mjs` is the operational front-end for §2–§7: one `resolve` verb per
need, `--dry-run` on every path, idempotent re-use of frozen files, and a provenance
ledger.

---

## 8. MCP servers

Already available in this environment: `replicate`, `openrouter` (image / speech /
transcription / vision), `brave-search`, `context7`.

| Server | Endpoint / install | Unlocks |
|---|---|---|
| HyperFrames (hosted, beta) | `https://mcp.heygen.com/mcp/hyperframes/` | Create + render without local CLI |
| HeyGen | HeyGen account / `heygen` CLI | Avatars, Starfish TTS, music, cloud render |
| ElevenLabs | `https://api.elevenlabs.io/v1/mcp` | Voice, music, SFX, image, video |
| fal.ai | hosted MCP | Fast image/video |
| Pexels | community MCP / REST | Stock |

When shelling out, set `HF_TOOL_CONTEXT` so the CLI adapts to the harness.

---

## 9. Delivery

- `scripts/deliver.mjs` renders the delivery matrix (presets `master` / `web` /
  `overlay` / `social` / `all`), probes each file, writes
  `renders/deliverables.json`, can strip the renderer tags
  (`ffmpeg -map_metadata -1`) and can `publish`. It refuses a resolution whose
  aspect differs from the composition — re-author for a new aspect instead.
- `hyperframes publish` → stable URL (works signed out; claim token; `--update`).
- Upload (not in HF): YouTube Data API v3, TikTok Content Posting API,
  Instagram/LinkedIn Graph, X; S3/R2/GCS; Mux/Cloudflare Stream.

---

## 10. Determinism, cost, secrets

- **Generate, then freeze.** Generative assets are non-deterministic; HyperFrames
  renders are deterministic. Materialise each asset to a file first; record
  provenance in the ledger.
- **Iterate cheap, then final.** Draft resolution/quality first; generate video at
  low res; only then render `high` / 4K / HDR.
- **Secrets** live in env or `~/.heygen/credentials` (0600). Never in
  compositions or committed files.
- **Degrade loudly.** Voice/music/SFX have offline fallbacks; if none is
  available, deliver silent and say so.
