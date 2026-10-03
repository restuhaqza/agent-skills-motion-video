#!/usr/bin/env node
import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { run, log, die } from "./lib/common.mjs";

const USAGE = `promo-motion probe

Summarise a rendered file (duration, codec, resolution, fps, pixel format,
audio) and flag whether transparency may be present.

Usage:
  node scripts/probe.mjs <file>`;

let values, positionals;
try {
  ({ values, positionals } = parseArgs({ options: { help: { type: "boolean", short: "h" } }, allowPositionals: true }));
} catch { console.error(USAGE); process.exit(2); }
if (values.help) { console.log(USAGE); process.exit(0); }

const file = resolve(positionals[0] || "");
if (!file || !existsSync(file)) die("usage: node scripts/probe.mjs <file>");

const r = run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { pipe: true });
if (!r.ok) die(`ffprobe failed: ${r.stderr.trim() || "is ffprobe installed?"}`);

let info;
try { info = JSON.parse(r.stdout); } catch { die("could not parse ffprobe output"); }

const v = (info.streams || []).find((s) => s.codec_type === "video") || {};
const a = (info.streams || []).find((s) => s.codec_type === "audio");
const fmt = info.format || {};
const fps = (() => {
  if (!v.avg_frame_rate) return null;
  const [n, d] = v.avg_frame_rate.split("/").map(Number);
  return d ? Number((n / d).toFixed(3)) : null;
})();

const pix = v.pix_fmt || "";
const alphaByPix = /a/i.test(pix) && !/^yuv[0-9]+p$/.test(pix);
const ext = file.toLowerCase().split(".").pop();

log(`file        ${file}`);
log(`format      ${fmt.format_name || "?"}`);
log(`duration    ${fmt.duration ? Number(fmt.duration).toFixed(3) + "s" : "?"}`);
log(`size        ${fmt.size ? (Number(fmt.size) / 1e6).toFixed(2) + " MB" : "?"}`);
log(`video       ${v.codec_name || "?"}  ${v.width || "?"}x${v.height || "?"}  ${fps || "?"}fps  ${pix || "?"}`);
log(`audio       ${a ? `${a.codec_name} ${a.channels || "?"}ch ${a.sample_rate || "?"}Hz` : "none"}`);
log(`transparency ${alphaByPix ? "pixel format carries alpha" : "not signalled by pixel format"}`);
if (["webm", "mov"].includes(ext) && !alphaByPix) {
  log("");
  log("Note: VP9/MOV alpha is often not visible in the default pixel format read.");
  log("Confirm visually over a checkerboard with:");
  log(`  ffmpeg -c:v libvpx-vp9 -i "${file}" -frames:v 1 -pix_fmt rgba /tmp/alpha-frame.png`);
  log("If the PNG is opaque, compare against a PNG-sequence render of the same composition.");
}
process.exit(0);
