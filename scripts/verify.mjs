#!/usr/bin/env node
import { parseArgs } from "node:util";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { run, f, log, die, readDurationFromHtml } from "./lib/common.mjs";

const USAGE = `promo-motion verify

Check, snapshot, render, and probe a HyperFrames project.

Usage:
  node scripts/verify.mjs <project-dir> [--quality draft] [--format mp4]

Flags:
  --dir <path>            project directory (or first positional)
  --composition <path>    render a specific composition (relative)
  --format <fmt>          mp4 | webm | mov | gif   (default mp4)
  --quality <q>           draft | standard | high  (default draft)
  --fps <n>               override frame rate
  --out <path>            output file (default <dir>/renders/verify.<ext>)
  --times <list>          snapshot times, e.g. 0,0.6,2.9 (default derived)
  --no-check              skip the runtime 'check' pass (faster)
  --no-render             stop after snapshots
  --help, -h`;

const options = {
  dir: { type: "string" }, composition: { type: "string" },
  format: { type: "string" }, quality: { type: "string" }, fps: { type: "string" },
  out: { type: "string" }, times: { type: "string" },
  "no-check": { type: "boolean" }, "no-render": { type: "boolean" },
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

const dir = resolve(values.dir || positionals[0] || ".");
if (!existsSync(join(dir, "index.html"))) die(`no index.html in ${dir}`);
if (!existsSync(join(dir, "renders"))) mkdirSync(join(dir, "renders"), { recursive: true });

const hf = ["npx", "--yes", "hyperframes"];
const fmt = values.format || "mp4";
const quality = values.quality || "draft";
const out = values.out ? resolve(values.out) : join(dir, "renders", `verify.${fmt}`);

const report = { dir, steps: [], ok: true };
function step(name, res, hard = true) {
  const ok = res.ok;
  report.steps.push({ name, ok, status: res.status });
  if (!ok && hard) report.ok = false;
  const mark = ok ? "PASS" : hard ? "FAIL" : "warn";
  log(`\n[${mark}] ${name}`);
  if (!ok) {
    const tail = (res.stderr || res.stdout || "").split("\n").slice(-25).join("\n").trim();
    if (tail) log(tail);
  }
  return ok;
}

// 0. toolchain
{
  const v = run(hf[0], [...hf.slice(1), "--version"], { pipe: true });
  step("hyperframes available", v);
}

// derive snapshot times from the authored duration
let times = values.times;
if (!times) {
  const dur = readDurationFromHtml(readFileSync(join(dir, "index.html"), "utf8"), 4);
  times = [0, f(dur * 0.5), f(Math.max(0, dur - 0.1))].join(",");
}

// 1. static contract
step("hyperframes lint", run(hf[0], [...hf.slice(1), "lint"], { cwd: dir, pipe: true }));

// 2. runtime behaviour
if (!values["no-check"]) {
  step("hyperframes check", run(hf[0], [...hf.slice(1), "check"], { cwd: dir, pipe: true }));
}

// 3. snapshots at the beats
{
  const args = [...hf.slice(1), "snapshot", "--at", times];
  if (values.composition) args.push("--composition", values.composition);
  step(`hyperframes snapshot --at ${times}`, run(hf[0], args, { cwd: dir, pipe: true }), false);
}

// 4. render
if (!values["no-render"]) {
  const args = [...hf.slice(1), "render", "--format", fmt, "--quality", quality, "--output", out];
  if (values.fps) args.push("--fps", values.fps);
  if (values.composition) args.push("--composition", values.composition);
  const ok = step(`hyperframes render (${quality}, ${fmt})`, run(hf[0], args, { cwd: dir, pipe: true }));
  if (ok && existsSync(out)) {
    report.output = out;
    const p = run(process.execPath, [join(import.meta.dirname, "probe.mjs"), out], { pipe: true });
    log("\n--- probe ---");
    log((p.stdout || p.stderr || "").trim());
  }
}

log("\n" + (report.ok ? "VERIFY: ok" : "VERIFY: problems found"));
log(JSON.stringify({ output: report.output || null, steps: report.steps }, null, 2));
process.exit(report.ok ? 0 : 1);
