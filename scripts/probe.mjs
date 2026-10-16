#!/usr/bin/env node
// promo-motion probe — summarise a rendered file, including real alpha detection.
//
// VP9 (WebM) and ProRes 4444 (MOV) alpha is not always visible in the default
// pixel-format read, so for those containers we decode the alpha plane with the
// alpha-aware decoder and measure it across a few frames. "carries alpha" means
// measured, not guessed.

import { parseArgs } from "node:util";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { run, log, die, normalizeArgv } from "./lib/common.mjs";

const USAGE = `promo-motion probe

Summarise a rendered file: duration, codec, resolution, fps, pixel format, audio,
and whether transparency is actually present (measured, for WebM/MOV).

Usage:
  node scripts/probe.mjs <file> [--json]`;

const OPTS = { json: { type: "boolean" }, help: { type: "boolean", short: "h" } };

let values, positionals;
try {
  ({ values, positionals } = parseArgs({
    options: OPTS,
    args: normalizeArgv(process.argv.slice(2), OPTS),
    allowPositionals: true,
  }));
} catch (e) {
  console.error("promo-motion: " + e.message + "\n");
  console.error(USAGE);
  process.exit(2);
}
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
const ext = file.toLowerCase().split(".").pop();
const alphaByPix = /a/i.test(pix);

const alpha = measureAlpha(file, ext, alphaByPix);

const out = {
  file,
  format: fmt.format_name || null,
  duration: fmt.duration ? Number(Number(fmt.duration).toFixed(3)) : null,
  size_mb: fmt.size ? Number((Number(fmt.size) / 1e6).toFixed(2)) : null,
  video: { codec: v.codec_name || null, width: v.width || null, height: v.height || null, fps, pix_fmt: pix || null },
  audio: a ? { codec: a.codec_name, channels: a.channels, sample_rate: a.sample_rate } : null,
  alpha,
};

if (values.json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

log(`file        ${file}`);
log(`format      ${out.format || "?"}`);
log(`duration    ${out.duration != null ? out.duration + "s" : "?"}`);
log(`size        ${out.size_mb != null ? out.size_mb + " MB" : "?"}`);
log(`video       ${out.video.codec || "?"}  ${out.video.width || "?"}x${out.video.height || "?"}  ${out.video.fps || "?"}fps  ${out.video.pix_fmt || "?"}`);
log(`audio       ${out.audio ? `${out.audio.codec} ${out.audio.channels || "?"}ch ${out.audio.sample_rate || "?"}Hz` : "none"}`);
log(`alpha       ${out.alpha.state}${out.alpha.detail ? "  (" + out.alpha.detail + ")" : ""}`);
if (out.alpha.state === "present" && ext === "webm") {
  log(`            confirm visually over a checkerboard if it matters:`);
  log(`            ffmpeg -c:v libvpx-vp9 -i "${file}" -frames:v 1 -pix_fmt rgba /tmp/alpha-frame.png`);
}
process.exit(0);

// ---------------------------------------------------------------------------

function measureAlpha(path, ext, alphaByPix) {
  if (!alphaByPix && !["webm", "mov"].includes(ext)) {
    return { state: "none", detail: "container/codec cannot carry alpha" };
  }
  const W = 240, H = 135, FRAMES = 8;
  const tmp = join(tmpdir(), `promo-alpha-${process.pid}.raw`);
  const args = ["-y", "-v", "error"];
  // The alpha-aware decoder must be selected *before* the input.
  if (ext === "webm") args.push("-c:v", "libvpx-vp9");
  args.push("-i", path, "-vf", `alphaextract,scale=${W}:${H},fps=2`,
    "-frames:v", String(FRAMES), "-f", "rawvideo", "-pix_fmt", "gray", tmp);
  const res = run("ffmpeg", args, { pipe: true });
  if (!res.ok || !existsSync(tmp)) {
    return { state: "unknown", detail: "alpha decode failed; check manually over a checkerboard" };
  }
  let data;
  try { data = readFileSync(tmp); } catch { return { state: "unknown", detail: "could not read decoded alpha" }; }
  unlinkSync(tmp);
  if (!data.length) return { state: "unknown", detail: "no frames decoded" };
  let min = 255, max = 0;
  for (const b of data) { if (b < min) min = b; if (b > max) max = b; }
  const detail = `alpha ${min}-${max} over ${Math.min(FRAMES, Math.round(data.length / (W * H)))} frame(s)`;
  if (max === 0) return { state: "fully transparent", detail };
  if (min === 255) return { state: "fully opaque", detail: `${detail} (no visible transparency)` };
  return { state: "present", detail };
}
