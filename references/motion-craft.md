# Motion craft

The difference between "AI motion" and work that reads professional is timing,
easing, and restraint. This is the taste layer. The archetype playbooks give beat
maps; this file gives the rules that make them land.

## The eight rules for motion that reads premium

Distilled from HyperFrames' prompting guide and standard motion practice.

1. **Nothing fully stops.** End states settle with a tiny residual, or the next
   beat overlaps before the previous leaves. A hard stop reads as a slideshow.
2. **One dominant action per beat.** If two things move at equal energy, the eye
   has nowhere to go. Make one the lead and subordinate the rest.
3. **Action overlaps.** Start the next element before the last finishes
   (80-120ms overlap) so the whole reads as continuous, not stitched.
4. **Ease like a camera, not a switch.** Entrances decelerate (`power3.out`,
   `expo.out`); exits accelerate (`power2.in`). Reserved `power1.inOut` for
   loops/idle.
5. **Motion has weight.** Bigger distance/element => slightly longer duration.
   0.4-0.8s for a title, 0.25-0.4s for a small chip, 0.15-0.25s for a tick.
6. **Hold long enough to read.** On-screen copy needs time. A two-to-three word
   line wants ~0.8-1.4s of stillness. Numbers want a beat after they settle.
7. **Imperfection stays reproducible.** Slight offsets, a 1-2 degree tilt, a
   non-round overshoot feel human. Get it from fixed values or a seeded PRNG, never
   `Math.random()`.
8. **Contrast carries hierarchy.** Size, weight, color, and speed. Pick one
   primary device per frame; do not make everything bold and fast.

## Easing vocabulary

| Intent | Ease | Notes |
|---|---|---|
| Entrance, settle | `power3.out` | Workhorse. Decelerate into place |
| Strong entrance | `expo.out` | Fast then snap; use sparingly |
| Soft, floaty entrance | `power2.out` | Gentle |
| Exit | `power2.in` / `power3.in` | Accelerate away |
| Overshoot / pop | `back.out(1.4-2)` | Character; keep overshoot small |
| Elastic (logo) | `elastic.out(1, 0.55)` | Only for playful brands |
| Idle/loop | `sine.inOut` | Breathing, not stopping |
| Constant | `none` | Mechanical sweeps, marquees |

Default duration ladder: `0.15s` micro, `0.3s` small, `0.5s` medium, `0.7s` hero.

## Beat maps (general)

A motion unit is beats, not a continuous curve:

```
enter (0.3-0.7s)  ->  establish (0.3-0.6s)  ->  hold (0.8-2.0s)  ->  exit (0.3-0.6s)
```

Tailor per archetype (see `workflows/`). Overlays must clear completely on the
first and last frames.

## Typography at speed

- **One idea per line.** Break long copy into successive lines or word groups.
- **Line reveal** reads faster than per-character for sentences; per-character is
  for short, punchy words (2-6 chars) or a single word.
- **Count-up numbers** should be tabular/lining figures (`font-variant-numeric:
  tabular-nums`) so width does not jitter.
- **Avoid animating tracking/letter-spacing** frame by frame; it is layout-heavy
  and can shimmer. Animate `opacity`/`y` instead, or set tracking statically.

## Type scale

Authored at 1920x1080 (scale proportionally for other widths):

| Role | Size | Weight | Notes |
|---|---|---|---|
| Hero / logo lockup | 120-200px | 700-900 | Tracking -1% to -3% |
| Title | 72-100px | 700-800 | |
| Statistic | 140-240px | 800-900 | Tabular figures |
| Subtitle / support | 32-44px | 400-600 | |
| Lower-third name | 44-56px | 700 | |
| Lower-third role | 26-34px | 500 | Muted color |
| Caption/legal | 20-26px | 400-500 | Minimum for legibility |

For 1080x1920 (vertical), keep the same absolute sizes; composition just reflows.

## Safe areas

| Format | Safe margin | Extra |
|---|---|---|
| 16:9 (1920x1080) | 96-120px all sides | Title-safe ~5% |
| 9:16 (1080x1920) | 120px sides, 220px top, 320px bottom | Keep clear of platform UI |
| 1:1 (1080x1080) | 96px all sides | |

Lower thirds sit in the lower-left, above the 16:9 bottom safe margin, clear of
platform captions. Logo stings and title cards center or use a deliberate
asymmetric anchor; never crowd the edge.

## Color and contrast

- Text must clear ~4.5:1 against its immediate backdrop. `hyperframes check`
  inspects contrast.
- Put a scrim/plate behind text over busy imagery (a soft gradient or a solid at
  60-85% opacity), not a hard-outlined text hack.
- Let the brand accent be an accent. If everything is accent, nothing is.

## Determinism in motion

- No `Date.now()`, no unseeded `Math.random()`.
- If you need scatter/organic timing, seeded PRNG:

```js
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261003);
```

## Self-review questions

Before declaring motion done:

- Does the message read at full speed without pausing?
- Is the first frame a clean, intentional start? Is the last frame a clean end?
- Is exactly one thing leading the eye at each moment?
- Do transitions overlap, or do things stop-and-start?
- Would an editor be able to drop this on a timeline without fixing anything?
