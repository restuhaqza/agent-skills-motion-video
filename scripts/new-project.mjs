#!/usr/bin/env node
// Offline fast-path scaffolder for a single promo unit.
//
// Writes a renderable HyperFrames project from an archetype + brand tokens,
// with no network access required (vendors GSAP locally when it can). For
// multi-scene pieces use `assemble.mjs` with a storyboard; for a
// framework-native scaffold use `npx hyperframes init`.
import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { DEFAULTS, ASPECTS, brandCssVars, run, log, die, normalizeArgv } from "./lib/common.mjs";
import {
  ARCHETYPES, TRANSITION_NAMES, esc, buildArchetype, buildTransition,
  compositionHtml, rootHtml, idCollisions,
} from "./lib/archetypes.mjs";

const USAGE = `promo-motion new-project

Scaffold one renderable HyperFrames promo unit (offline).

Usage:
  node scripts/new-project.mjs --archetype logo-sting --out ./out/acme-sting \\
    --title "Acme" --message "Build faster" --aspect 16:9 --duration 3

Archetypes:
  logo-sting | lower-third | title-card | stat-hit | kinetic-type | transition-pack

Common flags:
  --archetype <name>     required
  --brand <path>         brand.tokens.json (else neutral defaults)
  --out, -o <dir>        output project directory (required)
  --aspect <a>           16:9 | 9:16 | 1:1   (default 16:9)
  --duration <seconds>   default depends on archetype
  --overlay              transparent output (auto for lower-third/transition)
  --no-vendor            skip downloading GSAP; load from CDN instead
  --fps <n>              default 30

Content flags:
  --title --message --subtitle --name --role --label --value --suffix
  --context --eyebrow --l1 --l2 --accent-word --l3
  --logo <path>          copy this logo into assets/
  --transition <name>    accent-swipe | flash-through-white | whip-pan | zoom-blur | mask-wipe

  --help, -h`;

const str = (t) => ({ type: t });
const options = {
  archetype: str("string"), brand: str("string"),
  out: { type: "string", short: "o" },
  aspect: str("string"), duration: str("string"),
  overlay: { type: "boolean" }, vendor: { type: "boolean" },
  fps: str("string"),
  title: str("string"), message: str("string"), subtitle: str("string"),
  name: str("string"), role: str("string"),
  label: str("string"), value: str("string"), suffix: str("string"), context: str("string"),
  eyebrow: str("string"),
  l1: str("string"), l2: str("string"), "accent-word": str("string"), l3: str("string"),
  logo: str("string"), transition: str("string"),
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
if (values.help || !values.archetype) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

const ALL_ARCHETYPES = [...ARCHETYPES, "transition-pack"];
if (!ALL_ARCHETYPES.includes(values.archetype)) die(`unknown archetype: ${values.archetype}`);
if (!values.out) die("--out is required");

const aspect = values.aspect && ASPECTS[values.aspect] ? values.aspect : "16:9";
const { w, h } = ASPECTS[aspect];
const fps = Number(values.fps || 30);

// ---- brand ----------------------------------------------------------------
let brand;
if (values.brand) {
  const p = resolve(values.brand);
  if (!existsSync(p)) die(`brand file not found: ${p}`);
  brand = JSON.parse(readFileSync(p, "utf8"));
} else {
  brand = { name: values.title || values.name || "Brand" };
}
brand.colors = { ...DEFAULTS.colors, ...(brand.colors || {}) };
brand.fonts = { ...DEFAULTS.fonts, ...(brand.fonts || {}) };
brand.motion = { ...DEFAULTS.motion, ...(brand.motion || {}) };
const brandName = brand.name || "Brand";

const outDir = resolve(values.out);
mkdirSync(outDir, { recursive: true });
for (const d of ["assets", "assets/vendor", "compositions", "renders"]) {
  mkdirSync(join(outDir, d), { recursive: true });
}

// ---- logo -----------------------------------------------------------------
let logoRel = "assets/logo.svg";
const logoAlt = esc(brandName);
if (values.logo) {
  const src = resolve(values.logo);
  if (!existsSync(src)) die(`logo not found: ${src}`);
  const ext = extname(src) || ".svg";
  copyFileSync(src, join(outDir, "assets", "logo" + ext));
  logoRel = "assets/logo" + ext;
} else if (brand.logo && brand.logo.src && existsSync(join(outDir, brand.logo.src))) {
  logoRel = brand.logo.src;
} else {
  const initial = esc((brandName.match(/[A-Za-z0-9]/) || ["A"])[0].toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" rx="56" fill="${brand.colors.primary}"/>
  <text x="120" y="158" font-family="system-ui, sans-serif" font-size="128" font-weight="800"
        fill="${brand.colors.contrast}" text-anchor="middle">${initial}</text>
</svg>
`;
  writeFileSync(join(outDir, "assets", "logo.svg"), svg);
}

// ---- vendor GSAP ----------------------------------------------------------
let gsapSrc = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
if (values.vendor !== false) {
  const dest = join(outDir, "assets", "vendor", "gsap.min.js");
  try {
    const res = await fetch("https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    if (text.length < 1000) throw new Error("unexpected payload");
    writeFileSync(dest, text);
    gsapSrc = "./assets/vendor/gsap.min.js";
    log("Vendored GSAP ->", "assets/vendor/gsap.min.js");
  } catch (e) {
    log("Could not vendor GSAP (" + e.message + "); using CDN. Renders need network.");
  }
}

// ---- context --------------------------------------------------------------
const content = {
  title: values.title, message: values.message, subtitle: values.subtitle,
  name: values.name, role: values.role,
  label: values.label, value: values.value, suffix: values.suffix, context: values.context,
  eyebrow: values.eyebrow,
  l1: values.l1, l2: values.l2, l3: values.l3,
  "accent-word": values["accent-word"], accentWord: values["accent-word"],
};
const ctx = {
  brand, brandName, content, w, h, logoRel, logoAlt,
  overlay: !!values.overlay,
  duration: values.duration ? Number(values.duration) : undefined,
};

function emit(compId, spec) {
  writeFileSync(join(outDir, "compositions", `${compId}.html`), compositionHtml(spec, compId, w, h));
}

const brandVars = brandCssVars(brand, w, h);

// ---- emit -----------------------------------------------------------------
let chosenName = values.transition || "accent-swipe";
if (!TRANSITION_NAMES.includes(chosenName)) chosenName = "accent-swipe";

let spec;
let compId;
if (values.archetype === "transition-pack") {
  for (const name of TRANSITION_NAMES) {
    emit(`transition-${name}`, buildTransition(name, ctx));
  }
  compId = `transition-${chosenName}`;
  spec = buildTransition(chosenName, ctx);
} else {
  compId = values.archetype;
  spec = buildArchetype(values.archetype, ctx);
}
if (spec.overlay) values.overlay = true;

const collisions = idCollisions(compId, spec);
if (collisions.length) {
  die(`archetype "${values.archetype}" reuses the host id ${collisions.join(", ")} inside its own body — give the inner element a distinct id`);
}

emit(compId, spec);

writeFileSync(
  join(outDir, "index.html"),
  rootHtml({
    brandVars, w, h, fps, gsapSrc,
    duration: spec.duration, overlay: spec.overlay,
    hosts: [{ id: compId, start: 0, duration: spec.duration }],
  }),
);

// ---- project docs ---------------------------------------------------------
writeFileSync(join(outDir, "brand.tokens.json"), JSON.stringify(brand, null, 2) + "\n");

const frameMd = `# Frame — ${brandName}

## Canvas
- Authored: ${w}x${h} @ ${fps}fps. Safe margin: ${aspect === "9:16" ? "120px sides / 220 top / 320 bottom" : "96-120px"}.

## Palette
- Ground: bg (${brand.colors.bg}) / surface (${brand.colors.surface})
- Text: fg (${brand.colors.fg}), muted (${brand.colors.muted})
- Accent: primary (${brand.colors.primary}), accent (${brand.colors.accent})
- Text over media: add a 60-85% scrim.

## Type
- Display: ${brand.fonts.display}
- Body: ${brand.fonts.body}
- Scale: hero 120-200 / title 84-120 / stat 140-200 / support 32-44 / legal 20-26.

## Motion personality
- ${brand.motion.personality || "confident"} (energy ${brand.motion.energy ?? 0.6}).
- Entrances decelerate, exits accelerate. Nothing fully stops; actions overlap ~100ms.

## Do not
- Do not animate layout properties. Do not call play()/seek. Do not use unseeded randomness.
`;
writeFileSync(join(outDir, "frame.md"), frameMd);

const briefMd = `# Brief

- Archetype: ${values.archetype}
- Aspect: ${aspect} (${w}x${h})
- Duration: see index.html
- Output: ${values.overlay ? "transparent overlay (WebM/MOV)" : "opaque (MP4)"}
- Message: ${values.message || values.title || "(set on screen)"}

## Next
1. Edit index.html against references/workflows/${values.archetype}.md
2. node scripts/verify.mjs ${values.out} --quality draft
`;
writeFileSync(join(outDir, "BRIEF.md"), briefMd);

log(`\nCreated ${values.archetype} project at ${outDir}`);
log(`  index.html       main composition`);
log(`  brand.tokens.json / frame.md / BRIEF.md`);
if (values.archetype === "transition-pack") log(`  compositions/    ${TRANSITION_NAMES.length} transitions (default: ${chosenName})`);
else log(`  compositions/${compId}.html`);
log(`\nNext:`);
log(`  node scripts/verify.mjs ${values.out} --quality draft`);
log(`  cd ${values.out} && npx hyperframes preview`);
