#!/usr/bin/env node
// promo-motion verify — the QA gate for a HyperFrames project.
//
// Thin orchestrator over the HyperFrames CLI. It does not re-implement any
// check: it runs the native suite, in the right order, and reports one verdict.
//
// Steps (each can be switched off):
//   1. hyperframes check      lint + runtime + layout + motion + WCAG contrast
//   2. hyperframes keyframes  timeline/keyframe inventory (what actually moves)
//   3. hyperframes inspect    overflow pass (opt-in; deprecated in favour of check)
//   4. hyperframes snapshot   beat frames + contact sheet (optionally VLM-described)
//   5. hyperframes audio      where sound lands: onsets, loudness, silence (if audio)
//   6. hyperframes render     draft render (optional) + probe.mjs on the output
//
// Usage:
//   node scripts/verify.mjs <project-dir> [--quality draft] [--format mp4]
//   node scripts/verify.mjs <project-dir> --json     # machine-readable verdict

import { parseArgs } from "node:util";
import { existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { run, f, log, die, readDurationFromHtml } from "./lib/common.mjs";

const USAGE = `promo-motion verify

Run the full HyperFrames QA suite on a project and report one verdict.

Usage:
  node scripts/verify.mjs <project-dir> [flags]

Flags:
  --dir <path>            project directory (or first positional)
  --composition <path>    limit runtime checks / snapshot to one composition
  --times <list>          snapshot times, e.g. 0,1.2,3.4 (default: derived beats)
  --frames <n>            evenly-spaced snapshots when --times is absent (default 5)
  --format <fmt>          render format: mp4 | webm | mov | gif (default mp4)
  --quality <q>           render quality: draft | standard | high (default draft)
  --fps <n>               override render frame rate
  --out <path>            render output (default <dir>/renders/verify.<ext>)
  --describe [question]   ask Gemini vision about the snapshots (needs GEMINI_API_KEY)
  --strict                fail on warnings, not just errors
  --json                  print only the JSON verdict
  --inspect               also run the deprecated 'hyperframes inspect' overflow pass
  --no-check              skip 'hyperframes check'
  --no-keyframes          skip 'hyperframes keyframes'
  --no-snapshot           skip 'hyperframes snapshot'
  --no-audio              skip 'hyperframes audio'
  --no-render             stop after the checks (no render)
  --help, -h`;

const options = {
  dir: { type: "string" }, composition: { type: "string" },
  times: { type: "string" }, frames: { type: "string" },
  format: { type: "string" }, quality: { type: "string" }, fps: { type: "string" },
  out: { type: "string" }, describe: { type: "string" },
  strict: { type: "boolean" }, json: { type: "boolean" }, inspect: { type: "boolean" },
  "no-check": { type: "boolean" }, "no-keyframes": { type: "boolean" },
  "no-snapshot": { type: "boolean" },
  "no-audio": { type: "boolean" }, "no-render": { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

let values, positionals;
try {
  ({ values, positionals } = parseArgs({ options, allowPositionals: true }));
} catch {
  console.error(USAGE);
  process.exit(2);
}
if (values.help) { console.log(USAGE); process.exit(0); }

const say = (...a) => { if (!values.json) log(...a); };

const dir = resolve(values.dir || positionals[0] || ".");
if (!existsSync(join(dir, "index.html"))) die(`no index.html in ${dir}`);
if (!existsSync(join(dir, "renders"))) mkdirSync(join(dir, "renders"), { recursive: true });

const HF = ["npx", "--yes", "hyperframes"];
const hf = (args, opts = {}) => run(HF[0], [...HF.slice(1), ...args], { cwd: dir, pipe: true, ...opts });

const report = { dir, ok: true, steps: [] };
function step(name, res, { hard = true, note } = {}) {
  const ok = res.ok;
  report.steps.push({ name, ok, status: res.status, note });
  if (!ok && hard) report.ok = false;
  const mark = ok ? "PASS" : hard ? "FAIL" : "warn";
  say(`\n[${mark}] ${name}`);
  if (note) say(`  ${note}`);
  if (!ok) {
    const tail = (res.stderr || res.stdout || "").split("\n")
      .filter((l) => l && !/^npm notice/.test(l) && !/^\[INFO\]/.test(l) && !/^\[hyperframes\]/.test(l) && !/^@hf-progress/.test(l))
      .slice(-20).join("\n").trim();
    if (tail) say(tail);
  }
  return ok;
}

function tryJson(res) {
  const text = (res.stdout || "").trim();
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  const slice = text.slice(start);
  for (const candidate of [slice, slice.split("\n").slice(0, -3).join("\n")]) {
    try { return JSON.parse(candidate); } catch { /* keep trying */ }
  }
  return null;
}

// ---- toolchain ------------------------------------------------------------
{
  const v = hf(["--version"]);
  step("hyperframes available", v);
  const m = (v.stdout || "").match(/(\d+\.\d+\.\d+)/);
  if (m) report.hyperframes = m[1];
}

// ---- derive snapshot times ------------------------------------------------
let times = values.times;
if (!times) {
  const dur = readDurationFromHtml(readFileSync(join(dir, "index.html"), "utf8"), 4);
  if (values.frames) {
    times = null; // use --frames
  } else {
    times = [0, f(dur * 0.25), f(dur * 0.5), f(dur * 0.75), f(Math.max(0, dur - 0.1))].join(",");
  }
}

// ---- 1. check: lint + runtime + layout + motion + contrast ----------------
if (!values["no-check"]) {
  const args = ["check", "--json"];
  if (values.strict) args.push("--strict");
  const res = hf(args);
  const data = tryJson(res);
  const ok = step("hyperframes check (lint + runtime + layout + motion + contrast)", res);
  if (data) {
    report.check = data;
    report.ok = report.ok && data.ok !== false;
    const sections = ["lint", "runtime", "layout", "motion", "contrast"]
      .map((k) => [k, data[k]])
      .filter(([, v]) => v && typeof v === "object");
    const summary = {};
    for (const [k, v] of sections) {
      summary[k] = { ok: v.ok, errors: v.errorCount ?? 0, warnings: v.warningCount ?? 0 };
      if (v.ok === false) say(`  · ${k}: ${v.errorCount ?? 0} error(s), ${v.warningCount ?? 0} warning(s)`);
    }
    report.steps.at(-1).note = JSON.stringify(summary);
    report.steps.at(-1).ok = data.ok !== false;
  } else if (!ok) {
    report.ok = false;
  }
}

// ---- 2. keyframes: what actually moves ------------------------------------
if (!values["no-keyframes"]) {
  const res = hf(["keyframes", "--json"]);
  step("hyperframes keyframes (timeline inventory)", res, { hard: false });
  const data = tryJson(res);
  if (data) report.keyframes = data;
}

// ---- 3. inspect: overflow (opt-in; `check` already covers layout) ---------
if (values.inspect) {
  const res = hf(["inspect", "--json"]);
  step("hyperframes inspect (layout overflow — deprecated, use check)", res, { hard: false });
  const data = tryJson(res);
  if (data) report.inspect = data;
}

// ---- 4. snapshot: beat frames + contact sheet (+ optional VLM) ------------
if (!values["no-snapshot"]) {
  const args = ["snapshot"];
  if (times) args.push("--at", times);
  else if (values.frames) args.push("--frames", values.frames);
  if (values.composition) args.push("--composition", values.composition);
  const wantsDescribe = values.describe !== undefined;
  if (wantsDescribe) args.push("--describe", values.describe || "true");
  step(`hyperframes snapshot${times ? ` --at ${times}` : ""}`, hf(args), { hard: false });
  report.snapshotDir = "  .hyperframes/artifacts/snapshots/<id>/";
  say("  (a contact-sheet.jpg is written alongside the frames for AI review)");
}

// ---- 5. audio: where sound lands ------------------------------------------
if (!values["no-audio"]) {
  const hasAudio = projectHasAudio(dir);
  if (hasAudio) {
    const res = hf(["audio", "--json"]);
    step("hyperframes audio (onsets, loudness, silence)", res, { hard: false });
    const data = tryJson(res);
    if (data) report.audio = data;
  } else {
    report.steps.push({ name: "hyperframes audio", ok: true, skipped: "no audio in project" });
    say("\n[skip] hyperframes audio (no audio in project)");
  }
}

// ---- 6. render draft + probe ----------------------------------------------
if (!values["no-render"]) {
  const fmt = values.format || "mp4";
  const quality = values.quality || "draft";
  const out = values.out ? resolve(values.out) : join(dir, "renders", `verify.${fmt}`);
  const args = ["render", "--format", fmt, "--quality", quality, "--output", out];
  if (values.fps) args.push("--fps", values.fps);
  if (values.composition) args.push("--composition", values.composition);
  const ok = step(`hyperframes render (${quality}, ${fmt})`, hf(args));
  if (ok && existsSync(out)) {
    report.output = out;
    const p = run(process.execPath, [join(import.meta.dirname, "probe.mjs"), out], { pipe: true });
    report.probe = (p.stdout || p.stderr || "").trim();
    say("\n--- probe ---");
    say(report.probe);
  }
}

// ---- verdict --------------------------------------------------------------
if (values.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  log("\n" + (report.ok ? "VERIFY: ok" : "VERIFY: problems found"));
  log(JSON.stringify({ ok: report.ok, output: report.output || null, steps: report.steps }, null, 2));
}
process.exit(report.ok ? 0 : 1);

// ---- helpers --------------------------------------------------------------
function projectHasAudio(root) {
  const scan = (d, depth) => {
    if (depth > 2) return false;
    let entries = [];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return false; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".hyperframes" || e.name === "renders") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { if (scan(p, depth + 1)) return true; continue; }
      if (/\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i.test(e.name)) return true;
      if (/\.html$/i.test(e.name)) {
        const t = readFileSync(p, "utf8");
        if (/<audio\b|data-has-audio\s*=\s*"true"/i.test(t)) return true;
      }
    }
    return false;
  };
  return scan(root, 0);
}
