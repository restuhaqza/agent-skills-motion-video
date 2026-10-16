#!/usr/bin/env node
// promo-motion deliver — render a delivery matrix and produce a manifest.
//
// One project in, a set of finished files out: the right container and
// resolution for each destination, probed, optionally metadata-stripped and
// published. Prints (and writes) a deliverables manifest so the hand-off is
// explicit rather than a folder of mystery files.
//
//   node scripts/deliver.mjs ./out/roast --preset web
//   node scripts/deliver.mjs ./out/roast --format mp4,webm --quality high --strip-metadata
//   node scripts/deliver.mjs ./out/roast --preset master --publish
//   node scripts/deliver.mjs ./out/roast --preset all --dry-run

import { parseArgs } from "node:util";
import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync, renameSync } from "node:fs";
import { resolve, join, basename, extname } from "node:path";
import { run, ASPECTS, log, die, normalizeArgv } from "./lib/common.mjs";

const USAGE = `promo-motion deliver

Render the delivery matrix for a project and write a manifest.

Usage:
  node scripts/deliver.mjs <project-dir> [flags]

Presets (format sets):
  master    mp4                         (single high-quality master)
  web       mp4, webm                   (share + web/alpha)
  overlay   webm, mov                   (transparent deliverables)
  social    mp4, gif                    (clip + preview)
  all       mp4, webm, mov, gif

Flags:
  --dir <path>            project directory (or first positional)
  --preset <name>         master | web | overlay | social | all (default web)
  --format <list>         override formats, e.g. mp4,webm,mov,gif
  --quality <q>           draft | standard | high (default high)
  --fps <n>               override frame rate
  --resolution <list>     landscape|portrait|square (+ -4k) — must match the
                          authored aspect; omit to render at the authored size
  --out-dir <dir>         output directory (default <project>/renders)
  --strip-metadata        strip container tags with ffmpeg -map_metadata -1
  --publish               run 'hyperframes publish -y' after rendering
  --dry-run               print the matrix and exit (renders nothing)
  --json                  machine-readable result
  --help, -h`;

const PRESETS = {
  master: ["mp4"],
  web: ["mp4", "webm"],
  overlay: ["webm", "mov"],
  social: ["mp4", "gif"],
  all: ["mp4", "webm", "mov", "gif"],
};

const options = {
  dir: { type: "string" },
  preset: { type: "string" }, format: { type: "string" },
  quality: { type: "string" }, fps: { type: "string" },
  resolution: { type: "string" }, "out-dir": { type: "string" },
  "strip-metadata": { type: "boolean" }, publish: { type: "boolean" },
  "dry-run": { type: "boolean" }, json: { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

let values, positionals;
try {
  ({ values, positionals } = parseArgs({ options, args: normalizeArgv(process.argv.slice(2), options), allowPositionals: true }));
} catch (e) {
  console.error("promo-motion: " + e.message + "\n");
  console.error(USAGE);
  process.exit(2);
}
if (values.help) { console.log(USAGE); process.exit(0); }
const say = (...a) => { if (!values.json) log(...a); };

const dir = resolve(values.dir || positionals[0] || ".");
if (!existsSync(join(dir, "index.html"))) die(`no index.html in ${dir}`);

// ---- authored size / aspect ----------------------------------------------
const html = readFileSync(join(dir, "index.html"), "utf8");
const wm = html.match(/data-width="(\d+)"/);
const hm = html.match(/data-height="(\d+)"/);
const aw = wm ? Number(wm[1]) : 1920;
const ah = hm ? Number(hm[1]) : 1080;
const authoredAspect = aspectName(aw, ah);

function aspectName(w, h) {
  const r = w / h;
  const near = (a, b) => Math.abs(a - b) < 0.01;
  if (near(r, 16 / 9)) return "16:9";
  if (near(r, 9 / 16)) return "9:16";
  if (near(r, 1)) return "1:1";
  return `${w}:${h}`;
}
function resAspect(name) {
  const base = name.replace(/-4k$/, "");
  const map = { landscape: "16:9", portrait: "9:16", square: "1:1" };
  return map[base] || null;
}

// ---- matrix --------------------------------------------------------------
const formats = (values.format ? values.format.split(",") : (PRESETS[values.preset] || PRESETS.web))
  .map((s) => s.trim()).filter(Boolean);
const UNSUPPORTED = formats.filter((f) => !["mp4", "webm", "mov", "gif"].includes(f));
if (UNSUPPORTED.length) die(`unsupported format(s): ${UNSUPPORTED.join(", ")}`);

const requestedRes = values.resolution ? values.resolution.split(",").map((s) => s.trim()).filter(Boolean) : [null];
const resolutions = [];
for (const r of requestedRes) {
  if (r === null) { resolutions.push(null); continue; }
  const a = resAspect(r);
  if (!a) die(`unknown resolution: ${r} (landscape | portrait | square, optional -4k)`);
  if (a !== authoredAspect) {
    say(`skip ${r}: authored aspect is ${authoredAspect}. Re-author with 'assemble.mjs --aspect ${a}' (or a new frame size) to deliver ${a}.`);
    continue;
  }
  resolutions.push(r);
}
if (!resolutions.length) die(`no usable resolution for authored aspect ${authoredAspect}`);

const quality = values.quality || "high";
const outDir = resolve(values["out-dir"] || join(dir, "renders"));
mkdirSync(outDir, { recursive: true });
const name = basename(dir);

// A transparent deliverable can only be transparent if the composition left the
// background unpainted. Warn instead of silently handing back an opaque "overlay".
const paintsBackground = !/background:\s*transparent/.test(html);
const wantsAlpha = formats.some((fm) => fm === "webm" || fm === "mov");
if (paintsBackground && wantsAlpha) {
  say(`note: this composition paints its background, so the WebM/MOV output will be opaque.\n` +
      `      For a real overlay, author it with the background unpainted (see references/hyperframes-contract.md).`);
}

const jobs = [];
for (const fmt of formats) for (const res of resolutions) {
  const stem = [name, res ? res.replace(/-4k$/, "") : null, fmt].filter(Boolean).join("-");
  jobs.push({ fmt, res, file: join(outDir, `${stem}.${fmt === "mov" ? "mov" : fmt}`) });
}

say(`${name} — authored ${aw}x${ah} (${authoredAspect}), quality ${quality}`);
for (const j of jobs) say(`  ${j.fmt.padEnd(5)} ${j.res || "authored"}  -> ${basename(j.file)}`);
if (values["strip-metadata"]) say("  (strip-metadata: ffmpeg -map_metadata -1 after each render)");

if (values["dry-run"]) { say("\n(dry run — nothing rendered)"); process.exit(0); }

// ---- render --------------------------------------------------------------
const manifest = { project: dir, name, authored: `${aw}x${ah}`, aspect: authoredAspect, quality, created: new Date().toISOString(), deliverables: [] };
let failed = 0;

for (const j of jobs) {
  const args = ["--yes", "hyperframes", "render", "--format", j.fmt, "--quality", quality, "--output", j.file];
  if (values.fps) args.push("--fps", values.fps);
  if (j.res) args.push("--resolution", j.res);
  if (j.fmt === "gif") args.push("--fps", values.fps || "15");
  say(`\nrender ${j.fmt}${j.res ? " " + j.res : ""} …`);
  const r = run("npx", args, { cwd: dir, pipe: true });
  if (!r.ok || !existsSync(j.file)) {
    failed++;
    const msg = (r.stderr || r.stdout || "").split("\n").filter((l) => l && !/^npm notice/.test(l)).slice(-6).join("\n");
    say(`  FAILED\n${msg}`);
    manifest.deliverables.push({ ...j, ok: false });
    continue;
  }

  if (values["strip-metadata"] && ["mp4", "mov", "webm"].includes(j.fmt)) {
    const tmp = j.file.replace(extname(j.file), ".stripped" + extname(j.file));
    const s = run("ffmpeg", ["-y", "-v", "error", "-i", j.file, "-map_metadata", "-1", "-c", "copy", tmp], { pipe: true });
    if (s.ok) { renameSync(tmp, j.file); say("  stripped container metadata"); }
    else say("  metadata strip skipped (ffmpeg refused)");
  }

  const probe = run(process.execPath, [join(import.meta.dirname, "probe.mjs"), j.file], { pipe: true });
  const entry = {
    format: j.fmt, resolution: j.res || "authored", file: j.file,
    relative: basename(j.file), bytes: statSync(j.file).size, ok: true,
    probe: (probe.stdout || "").trim(),
  };
  manifest.deliverables.push(entry);
  say(`  ok  ${basename(j.file)}  (${(entry.bytes / 1024 / 1024).toFixed(2)} MB)`);
}

// ---- publish -------------------------------------------------------------
if (values.publish) {
  say("\npublish …");
  const r = run("npx", ["--yes", "hyperframes", "publish", "-y"], { cwd: dir, pipe: true });
  const out = (r.stdout || "").split("\n").filter((l) => l && !/^npm notice/.test(l)).join("\n").trim();
  manifest.publish = { ok: r.ok, output: out || (r.stderr || "").trim() };
  say(r.ok ? `  published\n${out}` : `  publish failed\n${(r.stderr || "").slice(-300)}`);
}

// ---- manifest ------------------------------------------------------------
const manifestPath = join(outDir, "deliverables.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

if (values.json) {
  console.log(JSON.stringify(manifest, null, 2));
} else {
  say(`\n${manifest.deliverables.filter((d) => d.ok).length}/${jobs.length} deliverable(s) rendered`);
  say(`manifest: ${manifestPath}`);
  if (manifest.publish) say(`published: ${manifest.publish.ok ? "yes" : "no"}`);
}
process.exit(failed ? 1 : 0);
