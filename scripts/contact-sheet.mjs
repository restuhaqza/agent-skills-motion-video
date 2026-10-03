#!/usr/bin/env node
import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { run, log, die } from "./lib/common.mjs";

const USAGE = `promo-motion contact-sheet

Tile evenly-spaced frames from a rendered file into a PNG, so an agent or a
human can review the motion at a glance.

Usage:
  node scripts/contact-sheet.mjs <file> [--out sheet.png] [--cols 4] [--rows 3]

Flags:
  --out, -o <path>   output PNG (default <input-dir>/<name>-sheet.png)
  --cols <n>         columns (default 4)
  --rows <n>         rows (default 3)
  --width <px>       per-frame width (default 480)
  --help, -h`;

const options = {
  out: { type: "string", short: "o" }, cols: { type: "string" },
  rows: { type: "string" }, width: { type: "string" },
  help: { type: "boolean", short: "h" },
};
let values, positionals;
try { ({ values, positionals } = parseArgs({ options, allowPositionals: true })); }
catch { console.error(USAGE); process.exit(2); }
if (values.help) { console.log(USAGE); process.exit(0); }

const file = resolve(positionals[0] || "");
if (!file || !existsSync(file)) die("usage: node scripts/contact-sheet.mjs <file>");

const cols = Number(values.cols || 4);
const rows = Number(values.rows || 3);
const width = Number(values.width || 480);
const total = cols * rows;
const out = values.out
  ? resolve(values.out)
  : join(dirname(file), basename(file).replace(/\.[^.]+$/, "") + "-sheet.png");

const probed = run("ffprobe", ["-v", "error", "-select_streams", "v:0",
  "-show_entries", "stream=avg_frame_rate,nb_frames,duration",
  "-show_entries", "format=duration", "-of", "json", file], { pipe: true });
if (!probed.ok) die(`ffprobe failed: ${probed.stderr.trim() || "is ffprobe installed?"}`);

let dur = 1, fps = 30;
try {
  const j = JSON.parse(probed.stdout);
  dur = Number(j.format?.duration || j.streams?.[0]?.duration || 1);
  const fr = (j.streams?.[0]?.avg_frame_rate || "30/1").split("/").map(Number);
  fps = fr[1] ? fr[0] / fr[1] : 30;
} catch { /* fall back to defaults */ }

const frames = Math.max(1, Math.round(dur * fps));
const step = Math.max(1, Math.floor(frames / total));
const vf = `select=not(mod(n\\,${step})),scale=${width}:-1,tile=${cols}x${rows}`;

const r = run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", vf, "-frames:v", "1", out], { pipe: true });
if (!r.ok) die(`ffmpeg failed: ${r.stderr.trim()}`);
log(`Wrote ${out}  (${cols}x${rows} from ${frames} frames, step ${step})`);
