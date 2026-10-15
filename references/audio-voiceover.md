# Voice-over with local Qwen3-TTS

Local, open-source voice-over for promos. No cloud, no API keys, no per-character
cost. Text-to-speech runs on the machine with
[Qwen3-TTS](https://github.com/QwenLM) through
[mlx-audio](https://github.com/Blaizzy/mlx-audio) on Apple Silicon.

Use this when the brief includes narration: a logo sting tagline, a lower-third
intro, a stat voice, or a kinetic-type read. For music beds and SFX, HyperFrames
`/media-use` or the ElevenLabs skills still apply.

## Which voice engine (fallback order)

Pick the **first available** provider and **state which one you used**. This skill
prefers Qwen3-TTS for voice *design* and *clone* on Apple Silicon; the hosted
providers win on quality and give word timings for free.

| # | Provider | Unlock | Notes |
|---|---|---|---|
| 1 | HeyGen Starfish | `HEYGEN_API_KEY` or `hyperframes auth login` | Hosted; also music library + cloud render |
| 2 | ElevenLabs | `ELEVENLABS_API_KEY` | Hosted; Eleven v4 |
| 3 | **Qwen3-TTS (local)** | Apple Silicon + `uv` (this doc) | Voice design + clone |
| 4 | Kokoro-82M (local) | `pip install kokoro-onnx soundfile`; `hyperframes tts` | 54 voices, zero keys |
| 5 | Gemini TTS | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Explicit choice; descriptive delivery |

`npx hyperframes auth status` reports which path will be used. Every narration pass
should be followed by transcription (`hyperframes transcribe`) so captions and
on-screen reveals can be paced to the spoken words.

The rest of this page is the **Qwen3-TTS** reference — the local path where the
skill adds something the hosted providers don't: inventing a voice from a
description, or cloning a brand voice from a sample.

## Requirements

- Apple Silicon Mac (MLX acceleration). Intel Macs are not supported by this path.
- `uv` on `PATH` (`brew install uv`). This skill runs mlx-audio through `uv`, so
  nothing is installed permanently.
- `ffmpeg` + `ffprobe` on `PATH` (already required by the skill).
- Disk/network for the first run: the chosen model downloads from Hugging Face once
  (roughly 1.5-5 GB depending on model).

Check everything in one shot:

```bash
node scripts/qwen-tts.mjs --check
node scripts/qwen-tts.mjs --list      # models + preset speakers
```

## Modes

| Mode | What it does | Needs | Default model |
|---|---|---|---|
| `voicedesign` | Describe a voice in words; it is invented for you | `--instruct` | `Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16` |
| `customvoice` | A preset speaker, optional emotion/style | `--voice`, optional `--instruct` | `Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16` |
| `clone` | Reproduce a voice from a reference sample | `--ref-audio`, `--ref-text` recommended | `Qwen3-TTS-12Hz-1.7B-Base-bf16` |

Preset speakers: **English** `Ryan`, `Aiden`; **Chinese** `Vivian`, `Serena`,
`Uncle_Fu`, `Dylan`, `Eric`.

`voicedesign` is the most flexible for brand work. Use `clone` when the brand has
a fixed voice you must match exactly.

## Commands

```bash
# 1. VoiceDesign — invent a voice from a description (best default for promos)
node scripts/qwen-tts.mjs \
  --mode voicedesign \
  --instruct "warm confident male narrator, mid tempo, clean broadcast tone" \
  --text "Acme. Ship the future, faster." \
  --out out/acme-sting/assets/audio/vo-1.wav \
  --normalize

# 2. CustomVoice — a preset speaker with an emotion
node scripts/qwen-tts.mjs \
  --mode customvoice --voice Aiden --instruct "excited, upbeat" \
  --text "Three times faster. Zero compromise." \
  --out out/acme-sting/assets/audio/vo-2.wav

# 3. Clone — a fixed brand voice from a clean sample
node scripts/qwen-tts.mjs \
  --mode clone \
  --ref-audio assets/brand/voice-sample.wav --ref-text "This is our brand voice." \
  --text "Fresh roasted, every morning." \
  --out out/vibe/assets/audio/vo-1.mp3 --format mp3
```

Each successful run prints the output path, duration, and a paste-ready `<audio>`
tag. Useful flags:

- `--normalize` — loudness-normalise to **-16 LUFS** (EBU R128). Recommended for
  any line that will sit under a music bed.
- `--gain -3` — coarse level trim in dB before normalising.
- `--speed 1.05` — nudge pacing to hit a beat without re-recording.
- `--lang <code>` — language hint (`en` default). English is the safest; other
  languages work but audition the result.
- `--format mp3|flac` — convert after generation (wav is the native output).
- `--dry-run` — print the exact command without running or downloading anything.
- `--model <hf-id>` — override the model (e.g. a 0.6B variant for speed).

## Placing the voice-over

HyperFrames owns playback. Add the `<audio>` element with timing in HTML; never
call `play()`, `pause()`, or set `currentTime` from JS.

```html
<audio id="a-vo1" src="assets/audio/vo-1.wav" data-start="0.6" data-duration="3.8"
       data-track-index="1" data-volume="1.0" data-fade-in="0.05" data-fade-out="0.12"></audio>
```

- `data-start` / `data-duration` come from the probe; keep the voice inside the
  composition length.
- `data-volume` is linear (`1` = 0 dB). Keep voice at `1.0`.
- `data-fade-in` / `data-fade-out` at ~0.05 / ~0.12 s remove clicks.
- Trim dead air by regenerating with tighter text rather than editing the file,
  unless a `--gain` / trim is genuinely needed.

### Mix levels

| Layer | `data-volume` | Notes |
|---|---|---|
| Voice-over | `1.0` | normalize to -16 LUFS first |
| Music bed | `0.13`-`0.25` | 12-18 dB under the voice |
| Ambience | `0.4`-`0.8` | duck under speech if busy |
| UI SFX | `0.3`-`0.6` | hits land on the beat, keep short |

## Working with beats

1. Decide where the voice lands on the timeline (usually one line per scene).
2. Generate each line to its own file (`vo-1.wav`, `vo-2.wav`, ...).
3. Read the printed duration and set `data-start` so the line ends on or just
   before the scene's key beat. Losing a trailing word is worse than a small gap.
4. `--speed` is the pacing knob. 1.0 is natural; 0.95-1.05 covers most fixes.
5. Normalise every line so a batch sounds consistent.

## Brand voice (clone)

- Record 5-15 s of clean speech: quiet room, one speaker, no music, steady level.
- Provide the exact transcript via `--ref-text`. Without it, mlx-audio
  auto-transcribes with Whisper (an extra one-time download) and may mishear names.
- Save the pair once (e.g. `assets/brand/voice-sample.wav` + a note of the text)
  and reuse the same reference for every line so the brand voice stays identical.

## Verification

- `ffprobe` the file (the script already prints duration) and confirm it fits the
  scene window.
- Render a draft and **listen** — check intelligibility at full speed, no clipped
  endings, and that the music bed does not fight the words.
- The render is deterministic; the audio is a supplied asset, so re-renders do not
  change the voice.

## Notes and limits

- First run per model is slow: it resolves mlx-audio via `uv` and downloads the
  model. Later runs are fast and offline.
- Keep a line under ~500 characters. Split long scripts into per-scene files so you
  can time each one and re-roll a single line without touching the others.
- If `uv` or Apple Silicon is unavailable, fall back to the ElevenLabs skills or
  HyperFrames `/media-use`, or deliver silent and say so.
