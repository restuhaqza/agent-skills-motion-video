# Workflow: kinetic-type

**Purpose.** A word-by-word typographic message where motion and emphasis carry
the meaning. The purest "design-led, motion is the message" unit.

**Use when.** A promo wants a short, punchy statement animated in type: a
manifesto line, a tagline, a list of benefits. Default duration 5.0s. Output MP4.

## Default beat map (5.0s)

| Beat | Time | Action |
|---|---|---|
| Line 1 in | 0.00-0.50 | First word/line rises and settles |
| Line 2 in | 0.55-1.05 | Second line, overlapping the first's settle |
| Emphasis | 1.10-1.55 | Key word scales/colors; accent underline draws |
| Line 3 in | 1.60-2.10 | Final line |
| Hold | 2.10-4.30 | Full phrase holds, subtle drift |
| Exit | 4.30-5.00 | Clear / fade |

## Skeleton

```html
<section id="kinetic" class="clip" data-start="0" data-duration="5" data-track-index="1">
  <div id="phrase">
    <div id="l1" class="line">Ship</div>
    <div id="l2" class="line">motion <span id="accent-word">faster</span></div>
    <div id="l3" class="line">than your team can brief.</div>
  </div>
</section>
```

```js
const tl = gsap.timeline({ paused: true });
tl.fromTo("#l1", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0);
tl.fromTo("#l2", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.55);
tl.fromTo("#accent-word", { color: "var(--fg)" }, { color: "var(--primary)", duration: 0.35, ease: "power2.out" }, 1.1);
tl.fromTo("#accent-word", { scale: 1 }, { scale: 1.12, duration: 0.2, ease: "back.out(1.6)" }, 1.1);
tl.to("#accent-word", { scale: 1, duration: 0.25, ease: "power2.out" }, 1.32);
tl.fromTo("#l3", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 1.6);
tl.to("#phrase", { scale: 1.006, duration: 2.2, ease: "sine.inOut" }, 2.1);
tl.to("#kinetic", { opacity: 0, duration: 0.4, ease: "power2.in" }, 4.6);
window.__timelines.main = tl;
```

## Motion recipe

- Reveal by **line or word group**, not per character, for sentences. Per-character
  is reserved for one short punchy word (2-6 chars).
- Each line uses the same entrance (y+opacity) so the rhythm is legible; vary only
  timing and the emphasis device.
- Pick **one** emphasis device for the key word: color, scale, or underline. Not
  all three.
- Overlap: the next line starts before the previous fully settles (~50-100ms).
- Break copy so no line exceeds ~5 words at hero size.

## Copy handling

- Keep the user's exact wording. Re-breaking lines is allowed; changing words is not.
- If the phrase is long, extend duration or reduce to the essential line; do not
  shrink the type below readable.

## Output

`npx hyperframes render --output renders/kinetic-type.mp4`

## Variables

`l1`, `l2`, `l3`, `accentWord`, `accent` (color).

## QA

- Whole phrase reads at full speed.
- Emphasis word is clearly the emphasis; the rest is subordinate.
- Lines are balanced (no orphan word on its own line if avoidable).
- Exact wording preserved.
