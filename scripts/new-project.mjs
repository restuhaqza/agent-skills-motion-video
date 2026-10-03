#!/usr/bin/env node
import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { dirname, resolve, join, extname, basename } from "node:path";
import {
  DEFAULTS, ASPECTS, brandCssVars, hexToRgba, run, f, log, die,
} from "./lib/common.mjs";

const USAGE = `promo-motion new-project

Scaffold a renderable HyperFrames project for one promo archetype.

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
  ({ values } = parseArgs({ options, allowPositionals: false }));
} catch {
  console.error(USAGE);
  process.exit(2);
}
if (values.help || !values.archetype) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 2);
}

const ARCHETYPES = ["logo-sting", "lower-third", "title-card", "stat-hit", "kinetic-type", "transition-pack"];
if (!ARCHETYPES.includes(values.archetype)) die(`unknown archetype: ${values.archetype}`);
if (!values.out) die("--out is required");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
  const dest = join(outDir, "assets", "logo" + ext);
  copyFileSync(src, dest);
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
const wantVendor = values.vendor !== false;
if (wantVendor) {
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

// ---- archetype builders ---------------------------------------------------
function logoSting() {
  const D = Number(values.duration || 3), k = D / 3, T = (t) => f(t * k), U = (d) => f(d * k);
  const word = esc(values.title || brandName);
  const exit = f(Math.max(1.0, D - 0.35));
  return {
    overlay: !!values.overlay, duration: D,
    style: `
    #lockup { display: flex; flex-direction: column; align-items: center; gap: 26px; }
    #mark { width: 120px; height: 120px; display: block; }
    #wm-wrap { position: relative; }
    #wordmark { font-family: var(--font-display); font-weight: var(--display-weight);
      font-size: 96px; letter-spacing: var(--tracking); color: var(--fg); line-height: 1; }
    #underline { position: absolute; left: 0; bottom: -18px; height: 6px; width: 100%;
      background: var(--primary); transform-origin: left center; }`,
    body: `
      <section id="sting" class="clip center" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="lockup">
          <div id="mark-wrap"><img id="mark" src="${logoRel}" alt="${logoAlt}" /></div>
          <div id="wm-wrap"><div id="wordmark">${word}</div><div id="underline"></div></div>
        </div>
      </section>`,
    script: `
      tl.fromTo("#mark", { scale: 1.06, opacity: 0 }, { scale: 1, opacity: 1, duration: ${U(0.45)}, ease: "power3.out" }, 0);
      tl.fromTo("#wordmark", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.4)}, ease: "power3.out" }, ${T(0.42)});
      tl.fromTo("#underline", { scaleX: 0 }, { scaleX: 1, duration: ${U(0.4)}, ease: "power2.out" }, ${T(0.62)});
      tl.to("#lockup", { scale: 1.015, duration: ${U(1.6)}, ease: "sine.inOut" }, ${T(0.85)});
      tl.to("#lockup", { opacity: 0, duration: ${U(0.3)}, ease: "power2.in" }, ${exit});`,
  };
}

function lowerThird() {
  const D = Number(values.duration || 4), k = D / 4, T = (t) => f(t * k), U = (d) => f(d * k);
  return {
    overlay: true, duration: D,
    style: `
    #lt-anchor { position: absolute; left: 120px; bottom: 140px; display: flex; align-items: stretch; }
    #accent { width: 8px; background: var(--primary); transform-origin: bottom center; }
    #plate { background: var(--surface); padding: 26px 40px 26px 34px; border-radius: 0 12px 12px 0; }
    #name { font-family: var(--font-display); font-weight: 700; font-size: 52px;
      letter-spacing: var(--tracking); line-height: 1.05; }
    #role { font-family: var(--font-body); font-weight: 500; font-size: 30px;
      color: var(--muted); margin-top: 6px; }`,
    body: `
      <section id="lower-third" class="clip" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="lt-anchor">
          <div id="accent"></div>
          <div id="plate">
            <div id="name">${esc(values.name || "Jane Doe")}</div>
            <div id="role">${esc(values.role || "Founder, " + brandName)}</div>
          </div>
        </div>
      </section>`,
    script: `
      tl.fromTo("#accent", { scaleY: 0 }, { scaleY: 1, duration: ${U(0.4)}, ease: "power3.out" }, 0);
      tl.fromTo("#plate", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: ${U(0.45)}, ease: "power3.out" }, ${T(0.05)});
      tl.fromTo("#name", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.4)}, ease: "power3.out" }, ${T(0.18)});
      tl.fromTo("#role", { opacity: 0 }, { opacity: 1, duration: ${U(0.35)}, ease: "power2.out" }, ${T(0.34)});
      tl.to(["#name", "#role"], { opacity: 0, duration: ${U(0.2)}, ease: "power2.in" }, ${T(3.35)});
      tl.to(["#plate", "#accent"], { x: -30, opacity: 0, duration: ${U(0.3)}, ease: "power2.in" }, ${T(3.5)});`,
  };
}

function titleCard() {
  const D = Number(values.duration || 4), k = D / 4, T = (t) => f(t * k), U = (d) => f(d * k);
  const pr = hexToRgba(brand.colors.primary, 0.3);
  const exit = f(Math.max(1.2, D - 0.35));
  return {
    overlay: !!values.overlay, duration: D,
    style: `
    #ground { position: absolute; inset: 0;
      background: radial-gradient(120% 90% at 16% 10%, ${pr} 0%, rgba(0,0,0,0) 55%),
                  linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%); }
    #content { position: absolute; left: 120px; bottom: 150px; max-width: 1360px; }
    #eyebrow { font-family: var(--font-body); font-weight: 700; font-size: 30px;
      letter-spacing: 0.22em; color: var(--primary); text-transform: uppercase; }
    #title { font-family: var(--font-display); font-weight: var(--display-weight);
      font-size: 120px; letter-spacing: var(--tracking); line-height: 0.98; margin: 18px 0 0; }
    #support { font-family: var(--font-body); font-size: 38px; color: var(--muted);
      margin: 22px 0 0; max-width: 1040px; line-height: 1.3; }`,
    body: `
      <section id="card" class="clip" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="ground"></div>
        <div id="content">
          <div id="eyebrow">${esc(values.eyebrow || "Introducing")}</div>
          <h1 id="title">${esc(values.title || brandName)}</h1>
          <p id="support">${esc(values.message || values.subtitle || "Motion that ships on brand.")}</p>
        </div>
      </section>`,
    script: `
      tl.fromTo("#ground", { opacity: 0 }, { opacity: 1, duration: ${U(0.4)}, ease: "power2.out" }, 0);
      tl.fromTo("#eyebrow", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.35)}, ease: "power3.out" }, ${T(0.3)});
      tl.fromTo("#title", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.6)}, ease: "power3.out" }, ${T(0.45)});
      tl.fromTo("#support", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.45)}, ease: "power3.out" }, ${T(0.85)});
      tl.to("#content", { scale: 1.008, duration: ${U(2.1)}, ease: "sine.inOut" }, ${T(1.25)});
      tl.to("#card", { opacity: 0, duration: ${U(0.3)}, ease: "power2.in" }, ${exit});`,
  };
}

function statHit() {
  const D = Number(values.duration || 3.5), k = D / 3.5, T = (t) => f(t * k), U = (d) => f(d * k);
  const value = Number(values.value || 87);
  const exit = f(Math.max(1.3, D - 0.35));
  return {
    overlay: !!values.overlay, duration: D,
    style: `
    #stat-content { display: flex; flex-direction: column; align-items: center; gap: 34px; }
    #label { font-family: var(--font-body); font-weight: 700; font-size: 30px; line-height: 1;
      letter-spacing: 0.22em; color: var(--muted); text-transform: uppercase; }
    #value-row { display: flex; align-items: baseline; gap: 6px; line-height: 1; }
    #value, #suffix { font-family: var(--font-display); font-weight: 900; font-size: 180px;
      line-height: 0.9; letter-spacing: var(--tracking); font-variant-numeric: tabular-nums; }
    #suffix { color: var(--primary); }
    #progress { position: relative; width: 520px; height: 8px; background: var(--surface);
      border-radius: 99px; overflow: hidden; }
    #progress-fill { position: absolute; inset: 0; background: var(--primary);
      transform-origin: left center; }
    #context { font-family: var(--font-body); font-size: 30px; line-height: 1; color: var(--muted); }`,
    body: `
      <section id="stat" class="clip center" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="stat-content">
          <div id="label">${esc(values.label || "Faster deploys")}</div>
          <div id="value-row"><span id="value">0</span><span id="suffix">${esc(values.suffix || "%")}</span></div>
          <div id="progress"><div id="progress-fill"></div></div>
          <div id="context">${esc(values.context || "vs. last quarter")}</div>
        </div>
      </section>`,
    script: `
      const target = ${value};
      const obj = { n: 0 };
      tl.fromTo("#label", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.35)}, ease: "power3.out" }, 0);
      tl.to(obj, { n: target, duration: ${U(1.1)}, ease: "power2.out",
        onUpdate: function () { document.getElementById("value").textContent = Math.round(obj.n).toLocaleString("en-US"); } }, ${T(0.3)});
      tl.fromTo("#progress-fill", { scaleX: 0 }, { scaleX: 1, duration: ${U(1.1)}, ease: "power2.out" }, ${T(0.3)});
      tl.fromTo("#suffix", { opacity: 0 }, { opacity: 1, duration: ${U(0.25)}, ease: "power2.out" }, ${T(1.35)});
      tl.fromTo("#context", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.4)}, ease: "power3.out" }, ${T(1.55)});
      tl.to("#stat", { opacity: 0, duration: ${U(0.3)}, ease: "power2.in" }, ${exit});`,
  };
}

function kineticType() {
  const D = Number(values.duration || 5), k = D / 5, T = (t) => f(t * k), U = (d) => f(d * k);
  const exit = f(Math.max(1.6, D - 0.4));
  return {
    overlay: !!values.overlay, duration: D,
    style: `
    #phrase { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .line { font-family: var(--font-display); font-weight: var(--display-weight);
      font-size: 104px; letter-spacing: var(--tracking); line-height: 1.02; }
    #accent-word { color: var(--primary); display: inline-block; }`,
    body: `
      <section id="kinetic" class="clip center" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="phrase">
          <div id="l1" class="line">${esc(values.l1 || "Ship")}</div>
          <div id="l2" class="line">${esc(values.l2 || "motion")} <span id="accent-word">${esc(values["accent-word"] || "faster")}</span></div>
          <div id="l3" class="line">${esc(values.l3 || "than your team can brief.")}</div>
        </div>
      </section>`,
    script: `
      tl.fromTo("#l1", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.5)}, ease: "power3.out" }, 0);
      tl.fromTo("#l2", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.5)}, ease: "power3.out" }, ${T(0.55)});
      tl.fromTo("#accent-word", { color: "${brand.colors.fg}" }, { color: "${brand.colors.primary}", duration: ${U(0.35)}, ease: "power2.out" }, ${T(1.1)});
      tl.fromTo("#accent-word", { scale: 1 }, { scale: 1.12, duration: ${U(0.2)}, ease: "back.out(1.6)", immediateRender: false }, ${T(1.1)});
      tl.to("#accent-word", { scale: 1, duration: ${U(0.25)}, ease: "power2.out" }, ${T(1.32)});
      tl.fromTo("#l3", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.5)}, ease: "power3.out" }, ${T(1.6)});
      tl.to("#phrase", { scale: 1.006, duration: ${U(2.2)}, ease: "sine.inOut" }, ${T(2.1)});
      tl.to("#kinetic", { opacity: 0, duration: ${U(0.4)}, ease: "power2.in" }, ${exit});`,
  };
}

function transition(name) {
  const D = Number(values.duration || 0.6), k = D / 0.6, T = (t) => f(t * k), U = (d) => f(d * k);
  const band = `<div id="band"></div>`;
  let style = `#band { position: absolute; inset: 0; }`;
  let script = "";
  if (name === "flash-through-white") {
    style = `#band { position: absolute; inset: 0; background: #FFFFFF; opacity: 0; }`;
    script = `
      tl.fromTo("#band", { opacity: 0 }, { opacity: 0.92, duration: ${U(0.18)}, ease: "power2.in" }, 0);
      tl.to("#band", { opacity: 0, duration: ${U(0.32)}, ease: "power2.out" }, ${U(0.18)});`;
  } else if (name === "zoom-blur") {
    style = `#band { position: absolute; inset: -10%; background: radial-gradient(circle at 50% 50%, var(--primary) 0%, rgba(0,0,0,0) 60%); opacity: 0; }`;
    script = `
      tl.fromTo("#band", { scale: 1, opacity: 0 }, { scale: 14, opacity: 0.9, duration: ${U(0.6)}, ease: "power2.inOut" }, 0);`;
  } else if (name === "mask-wipe") {
    style = `#band { position: absolute; inset: 0; background: var(--primary); clip-path: inset(0 100% 0 0); }`;
    script = `
      tl.fromTo("#band", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${U(0.35)}, ease: "power3.inOut" }, 0);
      tl.to("#band", { clipPath: "inset(0 0 0 100%)", duration: ${U(0.35)}, ease: "power3.inOut" }, ${U(0.35)});`;
  } else if (name === "whip-pan") {
    style = `#band { position: absolute; top: 0; bottom: 0; width: 36%; background: linear-gradient(90deg, rgba(0,0,0,0), var(--primary), rgba(0,0,0,0)); filter: blur(6px); }`;
    script = `
      tl.fromTo("#band", { x: -600 }, { x: 2520, duration: ${U(0.6)}, ease: "power3.inOut" }, 0);`;
  } else {
    // accent-swipe
    style = `#band { position: absolute; inset: 0; background: var(--primary); }`;
    script = `
      tl.fromTo("#band", { xPercent: -120 }, { xPercent: 0, duration: ${U(0.28)}, ease: "power3.in" }, 0);
      tl.to("#band", { xPercent: 120, duration: ${U(0.3)}, ease: "power3.out" }, ${U(0.3)});`;
  }
  return { overlay: true, duration: D, style, body: `\n      <section id="tr" class="clip" data-start="0" data-duration="${D}" data-track-index="0">${band}</section>`, script };
}

const BUILDERS = {
  "logo-sting": logoSting,
  "lower-third": lowerThird,
  "title-card": titleCard,
  "stat-hit": statHit,
  "kinetic-type": kineticType,
};

const transitionNames = ["accent-swipe", "flash-through-white", "whip-pan", "zoom-blur", "mask-wipe"];

// ---- HTML shells ----------------------------------------------------------
// Each graphic is a sub-composition (compositions/<id>.html) mounted by a host
// on the root timeline. This is HyperFrames' intended pattern: it keeps lint
// clean, gives each graphic its own timeline, and lets several units be
// assembled onto one root later.

function compositionFile(spec, compId) {
  return `<template>
  <style>
    #root {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: ${spec.overlay ? "transparent" : "var(--bg)"};
      color: var(--fg);
      font-family: var(--font-body);
      -webkit-font-smoothing: antialiased;
    }
    .clip { position: absolute; inset: 0; }
    .center { display: grid; place-items: center; }
    ${spec.style}
  </style>

  <div id="root" data-composition-id="${compId}" data-width="${w}" data-height="${h}">${spec.body}
  </div>

  <script>
    window.__timelines = window.__timelines || {};
    (function () {
      const tl = gsap.timeline({ paused: true });
      ${spec.script}
      window.__timelines["${compId}"] = tl;
    })();
  </script>
</template>
`;
}

function rootFile(spec, compId) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${w}, height=${h}" />
    <script src="${gsapSrc}"></script>
    <style>
      :root {
      ${brandCssVars(brand, w, h)}
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: ${spec.overlay ? "transparent" : "var(--bg)"};
      }
      #root {
        position: relative;
        width: var(--w);
        height: var(--h);
        overflow: hidden;
        background: ${spec.overlay ? "transparent" : "var(--bg)"};
        color: var(--fg);
        font-family: var(--font-body);
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${spec.duration}"
      data-width="${w}"
      data-height="${h}"
      data-fps="${fps}"
    >
      <div
        id="${compId}"
        data-composition-id="${compId}"
        data-composition-src="compositions/${compId}.html"
        data-start="0"
        data-duration="${spec.duration}"
        data-width="${w}"
        data-height="${h}"
      ></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      // The root only hosts sub-compositions; its own timeline is intentionally empty.
      window.__timelines.main = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
}

function emit(compId, spec) {
  writeFileSync(join(outDir, "compositions", `${compId}.html`), compositionFile(spec, compId));
  writeFileSync(join(outDir, "index.html"), rootFile(spec, compId));
}

// ---- emit -----------------------------------------------------------------
let chosenName = values.transition || "accent-swipe";
if (!transitionNames.includes(chosenName)) chosenName = "accent-swipe";

if (values.archetype === "transition-pack") {
  for (const name of transitionNames) {
    const compId = `transition-${name}`;
    writeFileSync(join(outDir, "compositions", `${compId}.html`), compositionFile(transition(name), compId));
  }
  const compId = `transition-${chosenName}`;
  writeFileSync(join(outDir, "index.html"), rootFile(transition(chosenName), compId));
} else {
  const spec = BUILDERS[values.archetype]();
  if (spec.overlay) values.overlay = true;
  emit(values.archetype, spec);
}

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
if (values.archetype === "transition-pack") log(`  compositions/    ${transitionNames.length} transitions (default: ${chosenName})`);
log(`\nNext:`);
log(`  node scripts/verify.mjs ${values.out} --quality draft`);
log(`  cd ${values.out} && npx hyperframes preview`);
