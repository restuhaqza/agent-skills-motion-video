# Brief — Vibe From Cafe promo

- Archetype: multi-scene promo (opening title + kinetic message + stat + logo close)
- Aspect: 16:9 (1920x1080) @ 30fps
- Duration: 22.0s
- Output: opaque MP4
- Language: English (site copy is bilingual ID/EN)
- Message: Navigate the AI shift together; a community for tech workers.

## Scenes
1. Opening (0-5.5s): white plate logo, kicker "A community for tech workers",
   title "Vibe From Cafe", support "Navigate the AI shift — together."
2. Message (5.5-11s): "Learn together. / Build side projects. / Grow your career. /
   All over good coffee."
3. Stat (11-15.5s): "COMMUNITY CAFÉ MAP — 66 cafés — mapped in the Jogja chapter."
4. Close (15.5-22s): logo, wordmark, tagline, vibefromcafe.id, pillars, footer.

## Facts and sources
- 66 cafés: app/data/cafes.json @ HEAD (all in the Jogja chapter). Verify before a
  public release; the list syncs from a sheet.
- Tagline from og:title "Navigate the AI Shift Together" at vibefromcafe.id.
- Palette and font from the site CSS: vfc-yellow #f5c400, vfc-surface #111,
  vfc-muted #999, Inter.
- Footer line "Made with warmth from Indonesia." is taken from the site.

## Audio (assets/audio/)
All audio is generated; none is licensed third-party material.
- music.wav — Replicate `meta/musicgen` (stereo-large), warm lo-fi bed, 24s trimmed to 22s.
- vo-1..4.mp3 — Replicate `minimax/speech-02-hd`, voice English_Wiselady, synced per scene.
- ambi-coffee.wav — Replicate `haoheliu/audio-ldm` (text-to-audio), café ambience under the opening.
- ui-whoosh.wav / ui-pop.wav / ui-chime.wav — synthesized deterministically with FFmpeg
  (AudioLDM accents were timing-unreliable, so these are generated from shaped noise/tones).
- Mixed in the composition with data-volume / data-fade-in / data-fade-out; music sits
  ~-18 dB under the voiceover. Master: mean -23.8 dB, max -2.7 dB.

VO script (English):
1. "Vibe From Cafe. Navigate the AI shift, together."
2. "Learn together. Build side projects. Grow your career. All over good coffee."
3. "Sixty-six cafés, mapped in the Jogja chapter."
4. "Find your seat at vibefromcafe dot I D."

## Outputs
- renders/vibefromcafe-promo-audio-hq.mp4 — high quality, with audio (primary)
- renders/vibefromcafe-promo-audio.mp4 — standard, with audio
- renders/vibefromcafe-promo-hq.mp4 / vibefromcafe-promo.mp4 — silent versions

