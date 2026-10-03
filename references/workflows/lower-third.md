# Workflow: lower-third

**Purpose.** A name / title / role bar that identifies a speaker over footage.
Always a transparent overlay.

**Use when.** A talking-head, interview, webinar, or podcast needs on-screen
identification. Default duration 4.0s (0.5 in, 3.0 hold, 0.5 out). Output WebM
(web) or MOV/ProRes 4444 (editing).

## Default beat map (4.0s)

| Beat | Time | Action |
|---|---|---|
| In | 0.00-0.50 | Plate wipes/slides from the left; accent bar leads |
| Name | 0.15-0.55 | Name rises in, overlapping the plate |
| Role | 0.30-0.70 | Role fades in, staggered after the name |
| Hold | 0.70-3.40 | Static, readable |
| Out | 3.40-4.00 | Everything clears left, accent bar trails |

## Skeleton

```html
<section id="lower-third" class="clip" data-start="0" data-duration="4" data-track-index="1">
  <div id="lt-anchor"><!-- positioned lower-left via CSS -->
    <div id="accent"></div>
    <div id="plate">
      <div id="name">Dr. Amara Okafor</div>
      <div id="role">Head of Research, Acme Labs</div>
    </div>
  </div>
</section>
```

Position via CSS (e.g. `position:absolute; left:120px; bottom:140px;`), keep the
element full-frame transparent. Do **not** paint a background on `#root`, `body`,
or `html`.

```js
const tl = gsap.timeline({ paused: true });
tl.fromTo("#accent", { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "power3.out" }, 0);
tl.fromTo("#plate", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" }, 0.05);
tl.fromTo("#name", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0.18);
tl.fromTo("#role", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" }, 0.34);
tl.to(["#name", "#role"], { opacity: 0, duration: 0.2, ease: "power2.in" }, 3.35);
tl.to(["#plate", "#accent"], { x: -30, opacity: 0, duration: 0.3, ease: "power2.in" }, 3.5);
window.__timelines.main = tl;
```

## Motion recipe

- The accent bar leads; the plate follows 50ms later (action overlap).
- Name and role stagger by ~150ms. Never simultaneous.
- Exit mirrors the entrance direction for a clean, professional read.
- Everything must be fully transparent at frame 0 and at the end.

## Safe area

Lower-left, above the 16:9 bottom safe margin (~140px). For vertical 9:16, keep it
above the bottom 320px platform UI zone. Never let it collide with captions.

## Output

```bash
npx hyperframes render --format webm --output renders/lower-third.webm
npx hyperframes render --format mov  --output renders/lower-third.mov
```

## Variables

`name`, `role`, `accent` (color). Expose so the same template produces one output
per speaker.

## QA

- Alpha verified (probe + a frame over a checkerboard).
- First and last frames fully empty.
- Text stays inside the safe area; no clipping.
- Contrast: name clears 4.5:1 over the plate, plate separates from busy footage.
