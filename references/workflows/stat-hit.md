# Workflow: stat-hit

**Purpose.** One number, counted or revealed, that lands a metric. The motion
makes the number the message.

**Use when.** A promo needs a KPI: growth, savings, users, speed, a percentage.
Default duration 3.5s. Output MP4, or a transparent overlay for a dashboard-style
insert.

## Default beat map (3.5s)

| Beat | Time | Action |
|---|---|---|
| Label | 0.00-0.40 | Small label fades up ("FASTER DEPLOYS") |
| Count | 0.30-1.40 | Number counts up; accent bar tracks progress |
| Settle | 1.40-1.70 | Number lands, tiny overshoot then lock |
| Context | 1.55-1.95 | Support line rises ("vs. last quarter") |
| Hold | 1.95-3.10 | Readable hold |
| Exit | 3.10-3.50 | Clear / fade |

## Skeleton

```html
<section id="stat" class="clip" data-start="0" data-duration="3.5" data-track-index="1">
  <div id="stat-content">
    <div id="label">FASTER DEPLOYS</div>
    <div id="value-row"><span id="value">0</span><span id="suffix">%</span></div>
    <div id="progress"></div>
    <div id="context">vs. last quarter</div>
  </div>
</section>
```

```js
const obj = { n: 0 };
const tl = gsap.timeline({ paused: true });
tl.fromTo("#label", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0);
tl.fromTo("#suffix", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" }, 1.35);
tl.to(obj, {
  n: 87, duration: 1.1, ease: "power2.out",
  onUpdate: () => { document.getElementById("value").textContent = Math.round(obj.n); }
}, 0.3);
tl.fromTo("#progress", { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: "power2.out" }, 0.3);
tl.fromTo("#context", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 1.55);
tl.to("#stat", { opacity: 0, duration: 0.3, ease: "power2.in" }, 3.1);
window.__timelines.main = tl;
```

`#progress` has `transform-origin: left center`. The count uses tabular figures so
the width does not jump.

## Motion recipe

- Count ease: `power2.out` (fast then decelerate). Never linear for a count-up.
- The progress bar and the count share the same duration and start; they read as
  one gesture.
- Optional small overshoot at settle: count to 88 then snap to 87 (`back.out`).
- Suffix (%, +, x) fades in on settle, not at the start.
- Context line is a supporting actor; smaller, muted, later.

## Number integrity

- Use the **exact** target the user gave. If none was given, ask; do not invent.
- Thousands separators: format with `toLocaleString`.
- Keep decimals if the source has them; match precision.
- State the number and its source in your report so it can be verified.

## Output

```bash
npx hyperframes render --output renders/stat-hit.mp4
npx hyperframes render --format webm --output renders/stat-hit.webm   # overlay
```

## Variables

`label`, `value` (number), `suffix`, `context`, `accent`.

## QA

- Final displayed number equals the requested number exactly.
- Tabular figures; no width jitter during the count.
- Count reaches target before the context line appears.
- Contrast on the number clears 4.5:1.
