# Workflow: transition-pack

**Purpose.** A set of reusable, named seam transitions to cut between promo
scenes or footage. Each is a short transparent overlay.

**Use when.** A promo or edit needs consistent motion seams: a wipe, a flash, a
whip-pan, a zoom-blur, a mask reveal. Build once, reuse across a campaign.

## The pack

Each transition is its own composition, ~0.5-0.8s, transparent. Recommended set:

| Name | Motion | Duration |
|---|---|---|
| `flash-through-white` | Full-frame white flash ramps in/out | 0.5s |
| `whip-pan` | Fast horizontal blur sweep with a leading edge | 0.6s |
| `zoom-blur` | Rapid scale + blur from center | 0.6s |
| `mask-wipe` | Diagonal/vertical wipe via `clip-path` | 0.7s |
| `accent-swipe` | Brand-colored bar sweeps through frame | 0.5s |

Deliver as `compositions/transition-<name>.html`. A host template renders the one
you ask for.

## Skeleton (host, per transition)

```html
<section id="tr" class="clip" data-start="0" data-duration="0.6" data-track-index="0">
  <div id="band"></div>
</section>
```

```js
const tl = gsap.timeline({ paused: true });
// accent-swipe: a colored bar enters, expands to cover, clears
tl.fromTo("#band",
  { xPercent: -120 },
  { xPercent: 0, duration: 0.28, ease: "power3.in" }, 0);
tl.fromTo("#band",
  { scaleY: 1 },
  { scaleY: 1, duration: 0, ease: "none" }, 0.28);
tl.to("#band", { xPercent: 120, duration: 0.3, ease: "power3.out" }, 0.3);
window.__timelines.main = tl;
```

`#band` is an accent-colored full-height bar. The background stays unpainted.

### flash-through-white

```js
tl.fromTo("#band", { opacity: 0 }, { opacity: 0.92, duration: 0.18, ease: "power2.in" }, 0);
tl.to("#band", { opacity: 0, duration: 0.32, ease: "power2.out" }, 0.18);
```

### whip-pan

Animate a wrapper with `x` + `filter: blur()` + `skewX`. Do not animate layout.
Provide a leading edge element so the direction reads.

### zoom-blur

```js
tl.fromTo("#band", { scale: 1, opacity: 0 }, { scale: 14, opacity: 0.85, duration: 0.6, ease: "power2.inOut" }, 0);
```

Combine with a radial-gradient `#band` for a soft zoom, or `filter: blur(20px)` on
a wrapper.

### mask-wipe

```js
tl.fromTo("#band", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.35, ease: "power3.inOut" }, 0);
tl.to("#band", { clipPath: "inset(0 0 0 100%)", duration: 0.35, ease: "power3.inOut" }, 0.35);
```

## Motion recipe

- A transition has an **in** and an **out**; it must fully clear at both ends.
- Transitions are fast: 0.5-0.8s total. Anything slower reads as a scene, not a seam.
- Match energy to the cut: `flash` for hard cuts, `whip-pan` for direction changes,
  `zoom-blur` for scale changes, `mask-wipe` for graphic wipes.
- Keep the seam short enough that the underlying footage stays the star.

## Output

```bash
npx hyperframes render --format webm --output renders/transition-wipe.webm
npx hyperframes render --composition compositions/transition-wipe.html \
  --format webm --output renders/transition-wipe.webm
```

## QA

- Alpha verified; first and last frames fully transparent.
- Duration <= 0.8s.
- Direction and energy match the intended cut.
- Reused across scenes without visual fatigue (do not repeat the same seam every
  cut).
