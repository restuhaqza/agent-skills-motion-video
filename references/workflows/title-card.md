# Workflow: title-card

**Purpose.** A full-frame card that announces a section, product, launch, or
chapter. Often the backbone of a promo: a sequence of cards.

**Use when.** The user wants an announcement, section divider, launch card, or
the opening/closing frame of a promo. Default duration 4.0s. Output MP4.

## Default beat map (4.0s)

| Beat | Time | Action |
|---|---|---|
| Ground in | 0.00-0.40 | Background wash / gradient establishes |
| Eyebrow | 0.30-0.65 | Small kicker ("NEW", "INTRODUCING") fades up |
| Title | 0.45-1.05 | Title reveals (line mask or y+opacity) |
| Support | 0.85-1.25 | Subtitle / detail rises, staggered |
| Hold | 1.25-3.40 | Everything holds; subtle drift keeps it alive |
| Exit | 3.40-4.00 | Fade, or cut if the next card continues |

## Skeleton

```html
<section id="card" class="clip" data-start="0" data-duration="4" data-track-index="1">
  <div id="ground"></div>
  <div id="content">
    <div id="eyebrow">INTRODUCING</div>
    <h1 id="title">Acme Cloud</h1>
    <p id="support">Ship motion graphics without a motion team.</p>
  </div>
</section>
```

```js
const tl = gsap.timeline({ paused: true });
tl.fromTo("#ground", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, 0);
tl.fromTo("#eyebrow", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0.3);
tl.fromTo("#title", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.45);
tl.fromTo("#support", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }, 0.85);
tl.to("#content", { scale: 1.008, duration: 2.1, ease: "sine.inOut" }, 1.25);
tl.to("#card", { opacity: 0, duration: 0.3, ease: "power2.in" }, 3.6);
window.__timelines.main = tl;
```

## Motion recipe

- Ground establishes first so text never appears on a void.
- Eyebrow -> title -> support is a strict hierarchy; stagger each by ~200ms.
- The title is the hero: longest duration, largest move, most contrast.
- Hold with a slow scale drift (nothing fully stops).
- For a sequence of cards, overlap the next card's ground-in with the previous
  card's exit on a separate track.

## Multiple cards

Build each card as a nested composition (`compositions/card-1.html`, etc.) and
place them on the root timeline with `data-composition-src`. This keeps each card
independently checkable and reusable.

## Output

`npx hyperframes render --output renders/title-card.mp4`

## Variables

`eyebrow`, `title`, `support`. For a campaign, render one MP4 per record.

## QA

- Strict reading order: eyebrow, title, support.
- Title readable at full speed; support clears 4.5:1 on the ground.
- Copy is exact; no placeholder or invented claims.
- Card does not crowd the safe margin.
