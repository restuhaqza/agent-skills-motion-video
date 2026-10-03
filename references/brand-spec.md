# Brand spec: tokens and frame.md

Two artifacts turn "make it on-brand" into something exact:

1. `brand.tokens.json` — machine-readable values the scripts inject as CSS
   custom properties.
2. `frame.md` — a design system **inverted for the camera**: the same tokens, but
   rewritten with a type scale, safe areas, and motion personality an agent can
   compose from without guessing.

## brand.tokens.json

```json
{
  "name": "Acme",
  "colors": {
    "bg": "#0B0B0E",
    "surface": "#15151A",
    "fg": "#F5F5F7",
    "muted": "#9A9AA5",
    "primary": "#FF5A1F",
    "accent": "#FFB020",
    "contrast": "#FFFFFF"
  },
  "fonts": {
    "display": "\"Space Grotesk\", system-ui, sans-serif",
    "body": "\"Inter\", system-ui, sans-serif",
    "displayWeight": 800,
    "tracking": "-0.02em"
  },
  "logo": { "src": "assets/logo.svg", "alt": "Acme" },
  "motion": { "personality": "confident", "energy": 0.6 },
  "notes": "Bold geometric sans, warm orange accent on near-black."
}
```

Rules:

- One dominant color, one accent. Do not add more without a reason.
- `fg` must clear ~4.5:1 on `bg`; `muted` is for secondary text only.
- `display` is for hero/title/stat; `body` is for support/legal.
- `logo.src` is relative to the project root.
- `motion.personality`: `premium` (slow, expo.out, small overshoot),
  `confident` (medium, power3.out), `energetic` (fast, back.out, bigger moves),
  `playful` (elastic, bouncy).

### Color tokens -> CSS variables

`new-project.mjs` injects:

```css
:root {
  --bg: #0B0B0E; --surface: #15151A; --fg: #F5F5F7; --muted: #9A9AA5;
  --primary: #FF5A1F; --accent: #FFB020; --contrast: #FFFFFF;
  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --display-weight: 800; --tracking: -0.02em;
  --w: 1920px; --h: 1080px;
}
```

Use `var(--primary)` etc. in compositions. Never hard-code a hex that is in the
kit.

## frame.md

`frame.md` is the design system for video. It answers: what is the type scale, how
much margin, how does this brand move, what is the accent's job. Template:

```markdown
# Frame — <Brand>

## Canvas
- Default: 1920x1080 @ 30fps. Vertical: 1080x1920.
- Safe margin: 96-120px (16:9); 120px sides / 220 top / 320 bottom (9:16).

## Palette
- Ground: bg (#…) / surface (#…)
- Text: fg (#…) primary, muted (#…) secondary
- Accent: primary (#…) for action/emphasis; accent (#…) sparingly
- Text over media: add a 60-85% scrim, never an outline.

## Type
- Hero: display, 150px, 800, tracking -2%
- Title: display, 84px, 700
- Stat: display, 180px, 900, tabular-nums
- Support: body, 36px, 500, muted
- Legal: body, 22px, 400, muted

## Motion personality
- <premium|confident|energetic|playful>: entrance <ease>, exits <ease>,
  overshoot <amount>, micro duration <n>, hero duration <n>.
- Nothing fully stops; action overlaps by ~100ms.

## Signature devices
- <e.g. accent underline that draws under the wordmark>
- <e.g. logo mark that masks in from a hard edge>

## Do not
- Do not recolor the logo. Do not animate tracking. Do not put text in the
  bottom 320px of vertical.
```

## Deriving a frame.md with no brand kit

When the user has no brand, make deliberate choices and state them:

- Pick a ground (near-black or warm off-white) and one accent with contrast on
  that ground.
- Use a widely available pairing (a geometric display + a neutral body).
- Choose a motion personality that matches the message (`premium` for finance,
  `confident` for B2B, `energetic` for consumer/social).
- Say in one line: "Assumed near-black ground, orange accent, confident motion;
  correct me if wrong."

## Logo handling

- Prefer SVG. Keep aspect ratio; never stretch.
- If the logo is raster, render at >=2x the display size to avoid softness.
- Recoloring: only if the logo has a monochrome variant. Otherwise place on a
  contrasting plate.
- Animate a wrapper, not the `<img>` element, if you need movement.
