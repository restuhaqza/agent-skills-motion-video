# Example: Vibe From Cafe promo

A real 22s, 16:9 promo built with this skill, to show the whole pipeline:
brand intake -> multi-scene authoring -> audio -> verify -> render.

- `index.html` — root composition, hosts four sub-compositions and the audio bed
- `compositions/opening.html`, `message.html`, `stat.html`, `close.html`
- `brand.tokens.json`, `frame.md`, `BRIEF.md` — brand kit, design frame, brief
- `renders/` — output (not committed)

Read `BRIEF.md` for the scene breakdown, copy, facts, and audio sources.

## Assets are not committed

`assets/` binaries are intentionally gitignored:

- `assets/logo.jpg` — the Vibe From Cafe brand mark. It belongs to its owner; do
  not redistribute. Supply your own logo here to run the demo.
- `assets/audio/*` — generated audio (large; model licenses vary). Regenerate as
  below.
- `assets/vendor/gsap.min.js` — vendored GSAP, fetched on demand.

The compositions fall back to the GSAP CDN if `assets/vendor/` is missing.

## Regenerate the audio

Requires a `REPLICATE_API_TOKEN` (the helper also reads it from
`~/.config/opencode/opencode.json`).

```bash
# music bed (24s)
node scripts/replicate-audio.mjs gen meta musicgen assets/audio/music.wav \
  '{"prompt":"warm optimistic lo-fi hip hop instrumental, soft jazz piano, mellow beat, vinyl crackle, no vocals","model_version":"stereo-large","duration":24}'

# voiceover (four lines)
node scripts/replicate-audio.mjs gen minimax speech-02-hd assets/audio/vo-1.mp3 \
  '{"text":"Vibe From Cafe. Navigate the AI shift, together.","voice_id":"English_Wiselady","audio_format":"mp3","sample_rate":44100}'
# ...repeat for vo-2..vo-4 (see BRIEF.md for the script)

# cafe ambience
node scripts/replicate-audio.mjs gen haoheliu audio-ldm assets/audio/ambi-coffee.wav \
  '{"text":"cozy coffee shop ambience, quiet murmur, no music","duration":"5.0"}'
```

The whoosh/pop/chime accents are synthesized deterministically with FFmpeg (see
`BRIEF.md` for the exact commands).

## Render

```bash
cd examples/vibefromcafe
npx hyperframes lint
npx hyperframes check
npx hyperframes render --quality high --output renders/promo.mp4
```
