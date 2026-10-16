#!/usr/bin/env node
// promo-motion assemble — storyboard.json -> renderable multi-scene project.
//
// Separates *planning* (the storyboard, authored by the agent) from *build*
// (this deterministic assembler). One scene per nested composition, laid out on
// a single root timeline. Re-running on the same storyboard produces the same
// project, so multi-scene promos are diffable, reviewable, and batchable.
//
// Usage:
//   node scripts/assemble.mjs --storyboard storyboard.json --out ./out/roast
//   node scripts/assemble.mjs --storyboard storyboard.json --out ./out/roast --dry-run

import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { DEFAULTS, ASPECTS, brandCssVars, f, log, die, normalizeArgv } from "./lib/common.mjs";
import { ARCHETYPES, esc, buildArchetype, compositionHtml, rootHtml, idCollisions } from "./lib/archetypes.mjs";

const USAGE = `promo-motion assemble

Turn a storyboard into a renderable multi-scene HyperFrames project.

Usage:
  node scripts/assemble.mjs --storyboard storyboard.json --out ./out/<name>

Flags:
  --storyboard, -s <path>   storyboard.json (required)
  --out, -o <dir>           output project directory (required)
  --brand <path>            override storyboard brand with a brand.tokens.json
  --aspect <a>              16:9 | 9:16 | 1:1 (override)
  --no-vendor               do not vendor GSAP; use the CDN
  --dry-run                 print the resolved timeline, write nothing
  --help, -h

Storyboard shape:
  {
    "name": "roast-promo",
    "aspect": "16:9",
    "fps": 30,
    "overlay": false,
    "brand": "./brand.tokens.json",        // path (relative to the storyboard) or inline object
    "scenes": [
      { "id": "opening", "archetype": "title-card", "duration": 5,
        "eyebrow": "Introducing", "title": "Roast", "message": "Fresh roasted, delivered weekly." },
      { "id": "stat", "archetype": "stat-hit", "duration": 4.5,
        "label": "Brewing since 2019", "value": 12000, "suffix": "", "context": "12,000 subscribers" }
    ]
  }

Per scene: "start" (explicit film second) or "overlap" (seconds into the previous
scene). Without either, scenes are laid end to end.

Archetypes: ${ARCHETYPES.join(" | ")}`;

const options = {
  storyboard: { type: "string", short: "s" },
  out: { type: "string", short: "o" },
  brand: { type: "string" }, aspect: { type: "string" },
  vendor: { type: "boolean" }, "dry-run": { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

let values;
try {
  ({ values } = parseArgs({ options, args: normalizeArgv(process.argv.slice(2), options), allowPositionals: false }));
} catch (e) {
  console.error("promo-motion: " + e.message + "\n");
  console.error(USAGE);
  process.exit(2);
}
if (values.help) { console.log(USAGE); process.exit(0); }
if (!values.storyboard) { console.error(USAGE); process.exit(2); }
if (!values.out) die("--out is required");

// ---- load + validate storyboard -------------------------------------------
const sbPath = resolve(values.storyboard);
if (!existsSync(sbPath)) die(`storyboard not found: ${sbPath}`);
let sb;
try {
  sb = JSON.parse(readFileSync(sbPath, "utf8"));
} catch (e) {
  die(`storyboard is not valid JSON: ${e.message}`);
}
if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) die("storyboard needs a non-empty 'scenes' array");

const seen = new Set();
for (const [i, s] of sb.scenes.entries()) {
  const label = s.id || `scene[${i}]`;
  if (!s.id) die(`scene ${i} is missing "id"`);
  if (seen.has(s.id)) die(`duplicate scene id: ${s.id}`);
  seen.add(s.id);
  if (!ARCHETYPES.includes(s.archetype)) {
    die(`${label}: unknown archetype "${s.archetype}" (use one of ${ARCHETYPES.join(", ")})`);
  }
  if (s.duration != null && !(Number(s.duration) > 0)) die(`${label}: duration must be > 0`);
}

// ---- brand ----------------------------------------------------------------
let brand;
const brandSource = values.brand || sb.brand;
if (brandSource) {
  if (typeof brandSource === "object") {
    brand = brandSource;
  } else {
    const bp = resolve(dirname(sbPath), brandSource);
    if (!existsSync(bp)) die(`brand file not found: ${bp}`);
    brand = JSON.parse(readFileSync(bp, "utf8"));
  }
}
brand = brand || { name: sb.name || "Brand" };
brand.colors = { ...DEFAULTS.colors, ...(brand.colors || {}) };
brand.fonts = { ...DEFAULTS.fonts, ...(brand.fonts || {}) };
brand.motion = { ...DEFAULTS.motion, ...(brand.motion || {}) };
const brandName = brand.name || sb.name || "Brand";

const aspect = values.aspect && ASPECTS[values.aspect] ? values.aspect
  : (sb.aspect && ASPECTS[sb.aspect] ? sb.aspect : "16:9");
const { w, h } = ASPECTS[aspect];
const fps = Number(sb.fps || 30);

// ---- resolve the timeline -------------------------------------------------
const timeline = [];
let cursor = 0;
for (const s of sb.scenes) {
  const start = s.start != null ? Number(s.start) : f(Math.max(0, cursor - Number(s.overlap || 0)));
  const ctx = {
    brand, brandName, w, h,
    logoRel: sb.logo || brand.logo?.src || "assets/logo.svg",
    logoAlt: esc(brandName),
    overlay: s.overlay != null ? !!s.overlay : !!sb.overlay,
    duration: s.duration != null ? Number(s.duration) : undefined,
  };
  const spec = buildArchetype(s.archetype, { ...ctx, content: s });
  const collisions = idCollisions(s.id, spec);
  if (collisions.length) {
    die(`${s.id}: archetype "${s.archetype}" reuses the host id inside its own body — rename the scene id or the inner element`);
  }
  timeline.push({ ...s, start, end: f(start + spec.duration), duration: spec.duration, spec });
  cursor = Math.max(cursor, start + spec.duration);
}
const total = f(cursor);
const anyOverlay = timeline.some((t) => t.spec.overlay);

// ---- preview / emit -------------------------------------------------------
const rows = timeline.map((t) =>
  `  ${String(t.start).padStart(6)}s → ${String(t.end).padStart(6)}s  ${t.duration}s  ${t.id.padEnd(12)} ${t.archetype}`);
log(`Storyboard: ${sb.name || "(unnamed)"}  ·  ${aspect} ${w}x${h} @ ${fps}fps  ·  ${timeline.length} scene(s)  ·  ${total}s total`);
log(rows.join("\n"));

if (values["dry-run"]) {
  log(`\n(dry run — nothing written. Total duration ${total}s.)`);
  process.exit(0);
}

const outDir = resolve(values.out);
mkdirSync(outDir, { recursive: true });
for (const d of ["assets", "assets/vendor", "compositions", "renders"]) {
  mkdirSync(join(outDir, d), { recursive: true });
}

// ---- logo -----------------------------------------------------------------
let logoRel = sb.logo || brand.logo?.src || "assets/logo.svg";
if (sb.logo && existsSync(resolve(dirname(sbPath), sb.logo))) {
  const src = resolve(dirname(sbPath), sb.logo);
  const ext = src.slice(src.lastIndexOf(".")) || ".svg";
  copyFileSync(src, join(outDir, "assets", "logo" + ext));
  logoRel = "assets/logo" + ext;
} else if (!existsSync(join(outDir, logoRel))) {
  const initial = esc((brandName.match(/[A-Za-z0-9]/) || ["A"])[0].toUpperCase());
  writeFileSync(join(outDir, "assets", "logo.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" rx="56" fill="${brand.colors.primary}"/>
  <text x="120" y="158" font-family="system-ui, sans-serif" font-size="128" font-weight="800"
        fill="${brand.colors.contrast}" text-anchor="middle">${initial}</text>
</svg>
`);
  logoRel = "assets/logo.svg";
}

// ---- vendor GSAP ----------------------------------------------------------
let gsapSrc = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
if (values.vendor !== false && sb.gsap !== "cdn") {
  try {
    const res = await fetch("https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    if (text.length < 1000) throw new Error("unexpected payload");
    writeFileSync(join(outDir, "assets", "vendor", "gsap.min.js"), text);
    gsapSrc = "./assets/vendor/gsap.min.js";
    log("\nVendored GSAP -> assets/vendor/gsap.min.js");
  } catch (e) {
    log("\nCould not vendor GSAP (" + e.message + "); using CDN. Renders need network.");
  }
}

// ---- emit compositions + root --------------------------------------------
for (const t of timeline) {
  writeFileSync(join(outDir, "compositions", `${t.id}.html`), compositionHtml(t.spec, t.id, w, h));
}
writeFileSync(
  join(outDir, "index.html"),
  rootHtml({
    brandVars: brandCssVars(brand, w, h),
    w, h, fps, gsapSrc,
    duration: total,
    overlay: anyOverlay,
    hosts: timeline.map((t) => ({ id: t.id, start: t.start, duration: t.duration })),
  }),
);

// ---- project docs ---------------------------------------------------------
writeFileSync(join(outDir, "brand.tokens.json"), JSON.stringify(brand, null, 2) + "\n");
writeFileSync(join(outDir, "storyboard.json"), JSON.stringify(sb, null, 2) + "\n");

writeFileSync(join(outDir, "ASSEMBLY.md"), `# Assembly — ${brandName}

- Aspect: ${aspect} (${w}x${h}) @ ${fps}fps
- Duration: ${total}s across ${timeline.length} scene(s)
- Timeline: root \`index.html\` hosts one nested composition per scene.

| # | Scene | Archetype | Start | End | Dur |
|---|---|---|---|---|---|
${timeline.map((t, i) => `| ${i + 1} | \`${t.id}\` | ${t.archetype} | ${t.start}s | ${t.end}s | ${t.duration}s |`).join("\n")}

## Next
1. Refine each \`compositions/<id>.html\` against its archetype playbook.
2. Add audio with \`data-start\`/\`data-duration\` (see references/tooling.md).
3. node scripts/verify.mjs ${values.out} --quality draft
`);

writeFileSync(join(outDir, "frame.md"), `# Frame — ${brandName}

## Canvas
- Authored: ${w}x${h} @ ${fps}fps. ${timeline.length} scene(s), ${total}s total.
- Safe margin: ${aspect === "9:16" ? "120px sides / 220 top / 320 bottom" : "96-120px"}.

## Palette
- Ground: bg (${brand.colors.bg}) / surface (${brand.colors.surface})
- Text: fg (${brand.colors.fg}), muted (${brand.colors.muted})
- Accent: primary (${brand.colors.primary}), accent (${brand.colors.accent})

## Type
- Display: ${brand.fonts.display}
- Body: ${brand.fonts.body}

## Motion personality
- ${brand.motion.personality || "confident"} (energy ${brand.motion.energy ?? 0.6}).

## Do not
- Do not animate layout properties. Do not call play()/seek. Do not use unseeded randomness.
`);

log(`\nCreated multi-scene project at ${outDir}`);
log(`  index.html            root timeline (${total}s, ${timeline.length} scenes)`);
log(`  compositions/         ${timeline.map((t) => t.id).join(", ")}`);
log(`  storyboard.json / ASSEMBLY.md / frame.md / brand.tokens.json`);
log(`\nNext:`);
log(`  node scripts/verify.mjs ${values.out} --quality draft`);
log(`  cd ${values.out} && npx hyperframes preview`);
