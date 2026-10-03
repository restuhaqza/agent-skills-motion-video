# Workflow: logo-sting

**Purpose.** A short animated logo reveal for intros, outros, and brand tags.
The movement carries the message; no narration.

**Use when.** The user wants an intro/outro, brand reveal, logo animation, or a
signed-off tag at the end of a promo. Default duration 3.0s. Output MP4, or a
transparent WebM/MOV overlay if it will sit over footage.

## Default beat map (3.0s)

| Beat | Time | Action |
|---|---|---|
| Build | 0.00-0.45 | Mark draws / masks in from a hard edge; subtle scale from 1.06 |
| Resolve | 0.45-0.85 | Wordmark reveals; accent underline draws under it |
| Hold | 0.85-2.40 | Lockup holds; a slow 1-2% scale drift keeps it alive |
| Exit | 2.40-3.00 | Either clear (overlay) or fade/scale out (standalone) |

For a "premium" personality, stretch build to 0.7s and hold to 2.6s. For
"energetic", compress build to 0.3s and use `back.out`.

## Skeleton

```html
<section id="sting" class="clip" data-start="0" data-duration="3" data-track-index="1">
  <div id="lockup">
    <div id="mark-wrap"><img id="mark" src="assets/logo.svg" alt="Acme" /></div>
    <div id="wordmark">ACME</div>
    <div id="underline"></div>
  </div>
</section>
```

```js
const tl = gsap.timeline({ paused: true });
tl.fromTo("#mark", { scale: 1.06, opacity: 0 },
  { scale: 1, opacity: 1, duration: 0.45, ease: "power3.out" }, 0);
tl.fromTo("#wordmark", { y: 24, opacity: 0 },
  { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0.42);
tl.fromTo("#underline", { scaleX: 0 },
  { scaleX: 1, duration: 0.4, ease: "power2.out" }, 0.62);
tl.to("#lockup", { scale: 1.015, duration: 1.6, ease: "sine.inOut" }, 0.85);
// overlay: clear at the end
tl.to("#lockup", { opacity: 0, duration: 0.25, ease: "power2.in" }, 2.6);
window.__timelines.main = tl;
```

Set `#underline` `transform-origin: left center` and full width of the wordmark.

## Motion recipe

- Mark: opacity + scale (never width/height). Mask-in via `clip-path` is fine but
  keep it a transform-friendly shape.
- Wordmark: `y` + opacity, or a per-line reveal. Keep it one move.
- Accent underline: `scaleX` 0 -> 1. This is the signature device; keep it.
- Hold: slow `sine.inOut` scale drift so it never fully stops.
- Overlay exit: fade to 0 and ensure the very first and last frames are empty.

## Output

- Standalone MP4: `npx hyperframes render --output renders/logo-sting.mp4`
- Overlay: `npx hyperframes render --format webm --output renders/logo-sting.webm`
  (background unpainted), or `--format mov` for ProRes 4444.

## Variables to expose

`brand` (logo src), `wordmark` (string), `tagline` (string, optional),
`personality` (motion). Expose with `data-composition-variables` if the sting is
reused across campaigns.

## QA

- Logo aspect ratio preserved; no stretching.
- Wordmark and mark are optically balanced, not mathematically centered by default.
- First and last frames clean for overlays.
- Holds long enough to register the name (>= 1.5s).
