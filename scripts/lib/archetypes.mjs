// Shared archetype builders + composition/root HTML shells.
//
// Used by both `new-project.mjs` (one unit) and `assemble.mjs` (multi-scene).
// Keep this the single source of truth for what each archetype looks like.
//
// A "spec" is { overlay, duration, style, body, script }:
//   overlay  - true if the composition must leave the background unpainted
//   duration - seconds (also used as the render length of the composition)
//   style    - CSS injected inside the composition's <style>
//   body     - HTML inside the composition's #root
//   script   - JS appended to the composition's paused timeline (uses `tl`)

import { f, hexToRgba } from "./common.mjs";

export const ARCHETYPES = [
  "logo-sting", "lower-third", "title-card", "stat-hit", "kinetic-type",
];

export const TRANSITION_NAMES = [
  "accent-swipe", "flash-through-white", "whip-pan", "zoom-blur", "mask-wipe",
];

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ctx: { brand, brandName, content, duration, overlay, w, h, logoRel, logoAlt }

function logoSting(ctx) {
  const { content: c, brandName, logoRel, logoAlt } = ctx;
  const D = Number(ctx.duration || 3), k = D / 3, T = (t) => f(t * k), U = (d) => f(d * k);
  const word = esc(c.title || brandName);
  const exit = f(Math.max(1.0, D - 0.35));
  return {
    overlay: !!ctx.overlay, duration: D,
    style: `
    #lockup { display: flex; flex-direction: column; align-items: center; gap: 26px; }
    #mark { width: 120px; height: 120px; display: block; }
    #wm-wrap { position: relative; }
    #wordmark { font-family: var(--font-display); font-weight: var(--display-weight);
      font-size: 96px; letter-spacing: var(--tracking); color: var(--fg); line-height: 1; }
    #underline { position: absolute; left: 0; bottom: -18px; height: 6px; width: 100%;
      background: var(--primary); transform-origin: left center; }`,
    body: `
      <section id="stage-sting" class="clip center" data-start="0" data-duration="${D}" data-track-index="1">
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

function lowerThird(ctx) {
  const { content: c, brandName } = ctx;
  const D = Number(ctx.duration || 4), k = D / 4, T = (t) => f(t * k), U = (d) => f(d * k);
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
      <section id="lt-stage" class="clip" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="lt-anchor">
          <div id="accent"></div>
          <div id="plate">
            <div id="name">${esc(c.name || "Jane Doe")}</div>
            <div id="role">${esc(c.role || "Founder, " + brandName)}</div>
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

function titleCard(ctx) {
  const { content: c, brand, brandName } = ctx;
  const D = Number(ctx.duration || 4), k = D / 4, T = (t) => f(t * k), U = (d) => f(d * k);
  const pr = hexToRgba(brand.colors.primary, 0.3);
  const exit = f(Math.max(1.2, D - 0.35));
  return {
    overlay: !!ctx.overlay, duration: D,
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
      <section id="stage-card" class="clip" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="ground"></div>
        <div id="content">
          <div id="eyebrow">${esc(c.eyebrow || "Introducing")}</div>
          <h1 id="title">${esc(c.title || brandName)}</h1>
          <p id="support">${esc(c.message || c.subtitle || "Motion that ships on brand.")}</p>
        </div>
      </section>`,
    script: `
      tl.fromTo("#ground", { opacity: 0 }, { opacity: 1, duration: ${U(0.4)}, ease: "power2.out" }, 0);
      tl.fromTo("#eyebrow", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.35)}, ease: "power3.out" }, ${T(0.3)});
      tl.fromTo("#title", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.6)}, ease: "power3.out" }, ${T(0.45)});
      tl.fromTo("#support", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: ${U(0.45)}, ease: "power3.out" }, ${T(0.85)});
      tl.to("#content", { scale: 1.008, duration: ${U(2.1)}, ease: "sine.inOut" }, ${T(1.25)});
      tl.to("#stage-card", { opacity: 0, duration: ${U(0.3)}, ease: "power2.in" }, ${exit});`,
  };
}

function statHit(ctx) {
  const { content: c } = ctx;
  const D = Number(ctx.duration || 3.5), k = D / 3.5, T = (t) => f(t * k), U = (d) => f(d * k);
  const value = Number(c.value ?? 87);
  const exit = f(Math.max(1.3, D - 0.35));
  return {
    overlay: !!ctx.overlay, duration: D,
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
      <section id="stage-stat" class="clip center" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="stat-content">
          <div id="label">${esc(c.label || "Faster deploys")}</div>
          <div id="value-row"><span id="value">0</span><span id="suffix">${esc(c.suffix || "%")}</span></div>
          <div id="progress"><div id="progress-fill"></div></div>
          <div id="context">${esc(c.context || "vs. last quarter")}</div>
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
      tl.to("#stage-stat", { opacity: 0, duration: ${U(0.3)}, ease: "power2.in" }, ${exit});`,
  };
}

function kineticType(ctx) {
  const { content: c, brand } = ctx;
  const D = Number(ctx.duration || 5), k = D / 5, T = (t) => f(t * k), U = (d) => f(d * k);
  const exit = f(Math.max(1.6, D - 0.4));
  return {
    overlay: !!ctx.overlay, duration: D,
    style: `
    #phrase { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .line { font-family: var(--font-display); font-weight: var(--display-weight);
      font-size: 104px; letter-spacing: var(--tracking); line-height: 1.02; }
    #accent-word { color: var(--primary); display: inline-block; }`,
    body: `
      <section id="stage-kinetic" class="clip center" data-start="0" data-duration="${D}" data-track-index="1">
        <div id="phrase">
          <div id="l1" class="line">${esc(c.l1 || "Ship")}</div>
          <div id="l2" class="line">${esc(c.l2 || "motion")} <span id="accent-word">${esc(c["accent-word"] || c.accentWord || "faster")}</span></div>
          <div id="l3" class="line">${esc(c.l3 || "than your team can brief.")}</div>
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
      tl.to("#stage-kinetic", { opacity: 0, duration: ${U(0.4)}, ease: "power2.in" }, ${exit});`,
  };
}

export function buildTransition(name, ctx) {
  const D = Number(ctx.duration || 0.6), k = D / 0.6, T = (t) => f(t * k), U = (d) => f(d * k);
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
    style = `#band { position: absolute; inset: 0; background: var(--primary); }`;
    script = `
      tl.fromTo("#band", { xPercent: -120 }, { xPercent: 0, duration: ${U(0.28)}, ease: "power3.in" }, 0);
      tl.to("#band", { xPercent: 120, duration: ${U(0.3)}, ease: "power3.out" }, ${U(0.3)});`;
  }
  return { overlay: true, duration: D, style, body: `\n      <section id="stage-tr" class="clip" data-start="0" data-duration="${D}" data-track-index="0">${band}</section>`, script };
}

export function buildArchetype(archetype, ctx) {
  switch (archetype) {
    case "logo-sting": return logoSting(ctx);
    case "lower-third": return lowerThird(ctx);
    case "title-card": return titleCard(ctx);
    case "stat-hit": return statHit(ctx);
    case "kinetic-type": return kineticType(ctx);
    default: throw new Error(`unknown archetype: ${archetype}`);
  }
}

/**
 * The composition *host* id must differ from any element id inside the body.
 * When they collide (e.g. host `lower-third` hosting `<section id="lower-third">`)
 * the document gets two elements with the same id, which confuses Studio
 * selection and any `#id` selector. Returns the colliding ids, if any.
 */
export function idCollisions(compId, spec) {
  const ids = [...String(spec.body).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  return ids.filter((id) => id === compId);
}

// ---- HTML shells ----------------------------------------------------------

export function compositionHtml(spec, compId, w, h) {
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

/**
 * Root HTML that hosts one or more nested compositions.
 * hosts: [{ id, start, duration, src? }]
 */
export function rootHtml({ brandVars, w, h, fps, gsapSrc, duration, overlay, hosts }) {
  const hostHtml = hosts.map((hd) => `      <div
        id="${hd.id}"
        data-composition-id="${hd.id}"
        data-composition-src="${hd.src || `compositions/${hd.id}.html`}"
        data-start="${hd.start}"
        data-duration="${hd.duration}"
        data-width="${w}"
        data-height="${h}"
      ></div>`).join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${w}, height=${h}" />
    <script src="${gsapSrc}"></script>
    <style>
      :root {
      ${brandVars}
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: ${overlay ? "transparent" : "var(--bg)"};
      }
      #root {
        position: relative;
        width: var(--w);
        height: var(--h);
        overflow: hidden;
        background: ${overlay ? "transparent" : "var(--bg)"};
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
      data-duration="${duration}"
      data-width="${w}"
      data-height="${h}"
      data-fps="${fps}"
    >
${hostHtml}
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
