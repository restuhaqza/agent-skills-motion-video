#!/usr/bin/env node
// Local voice-over with Qwen3-TTS on Apple Silicon (via mlx-audio).
//
// No cloud, no API keys. Text -> speech runs on the machine. Three modes:
//   voicedesign  describe a voice in words ("warm male narrator, calm")
//   customvoice  pick a preset speaker, optionally with an emotion/style
//   clone        clone a voice from a reference audio sample
//
// The heavy lifting is done by `python -m mlx_audio.tts.generate`. This wrapper
// resolves the right model + flags per mode, runs it through `uv` (no permanent
// install), normalises loudness, probes the duration, and prints a paste-ready
// <audio> snippet for a HyperFrames composition.
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname, basename, extname, join, relative, isAbsolute } from "node:path";
import { run, which, f, log, die } from "./lib/common.mjs";

const MODELS = {
  voicedesign: "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16",
  customvoice: "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16",
  clone: "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16",
};
// Lighter alternates, selectable with --model.
const ALT_MODELS = {
  clone: "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16",
  customvoice: "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16",
};
const SPEAKERS = {
  English: ["Ryan", "Aiden"],
  Chinese: ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric"],
};

const USAGE = `promo-motion qwen-tts

Local voice-over with Qwen3-TTS (Apple Silicon / MLX). No API keys.

Usage:
  node scripts/qwen-tts.mjs --text "Build faster with Acme" \\
    --out out/acme-sting/assets/audio/vo-1.wav \\
    --mode voicedesign --instruct "warm male narrator, calm, confident"

Modes (--mode):
  voicedesign   describe the voice in words           (default)
  customvoice   preset speaker + optional emotion     (--voice Ryan --instruct "excited")
  clone         clone a voice from a sample           (--ref-audio a.wav [--ref-text "..."])
                omitting --ref-text auto-transcribes (downloads a Whisper model once)

Common flags:
  --text <s>            the spoken line (or --text-file <f>, or pipe via stdin)
  --out, -o <file>      output audio file (default assets/audio/vo.wav)
  --mode <m>            voicedesign | customvoice | clone
  --model <hf-id>       override the model (default per mode)
  --instruct <s>        voice description (voicedesign) or emotion/style (customvoice)
  --voice <name>        speaker for customvoice / base (default Ryan)
  --ref-audio <file>    reference sample (required for clone)
  --ref-text <s>        transcript of the reference sample
  --lang <code>         language code (default en)
  --speed <n>           playback speed (default 1.0)
  --format <ext>        wav | mp3 | flac (default wav)
  --name <prefix>       output file prefix (default: basename of --out)
  --gain <db>           apply volume gain in dB (e.g. -3), before normalise
  --normalize           loudness-normalise to -16 LUFS (EBU R128) via ffmpeg
  --snippet             print a paste-ready <audio> tag (done by default)
  --src <path>          src prefix used in the snippet (default: <out> as given)

Setup / inspection:
  --list                show models and preset speakers, then exit
  --check               check uv / ffmpeg / ffprobe availability, then exit
  --dry-run             print the resolved command without running it
  --python <ver>        interpreter for uv (default 3.12)
  --mlx-version <v>     pin the mlx-audio version (e.g. 0.3.0)
  --no-prerelease       do not pass --prerelease allow to uv
  --no-project          run without a project env (default: true)

  --help, -h`;

const str = (t) => ({ type: t });
const options = {
  text: str("string"),
  "text-file": str("string"),
  out: { type: "string", short: "o" },
  mode: str("string"),
  model: str("string"),
  instruct: str("string"),
  voice: str("string"),
  "ref-audio": str("string"),
  "ref-text": str("string"),
  lang: str("string"),
  speed: str("string"),
  format: str("string"),
  name: str("string"),
  gain: str("string"),
  normalize: { type: "boolean" },
  snippet: { type: "boolean" },
  src: str("string"),
  list: { type: "boolean" },
  check: { type: "boolean" },
  "dry-run": { type: "boolean" },
  python: str("string"),
  "mlx-version": str("string"),
  "no-prerelease": { type: "boolean" },
  "no-project": { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

// Allow signed numeric option values written as "--gain -3" (parseArgs would
// otherwise treat "-3" as an option). Normalise them to "--gain=-3".
const rawArgs = process.argv.slice(2);
const argv = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  const next = rawArgs[i + 1];
  if (/^--(gain|speed)$/.test(a) && next !== undefined && /^-?[\d.]/.test(next)) {
    argv.push(`${a}=${next}`);
    i++;
  } else {
    argv.push(a);
  }
}

let values;
try {
  ({ values } = parseArgs({ args: argv, options, allowPositionals: false }));
} catch {
  console.error(USAGE);
  process.exit(2);
}
if (values.help) { log(USAGE); process.exit(0); }

if (values.list) {
  log("Qwen3-TTS models (mlx-audio):\n");
  log(`  voicedesign  ${MODELS.voicedesign}`);
  log(`  customvoice  ${MODELS.customvoice}   (lighter: ${ALT_MODELS.customvoice})`);
  log(`  clone        ${MODELS.clone}   (lighter: ${ALT_MODELS.clone})`);
  log("\nPreset speakers:");
  for (const [lang, names] of Object.entries(SPEAKERS)) log(`  ${lang}: ${names.join(", ")}`);
  log("\nNotes: first run downloads the model from Hugging Face (a few GB).");
  log("VoiceDesign is the most flexible for brand work; clone for a fixed brand voice.");
  process.exit(0);
}

if (values.check) {
  const tools = {
    uv: which("uv"),
    python3: which("python3"),
    ffmpeg: which("ffmpeg"),
    ffprobe: which("ffprobe"),
  };
  for (const [k, ok] of Object.entries(tools)) log(`${ok ? "ok  " : "MISS"}  ${k}`);
  const uvV = run("uv", ["--version"], { pipe: true });
  if (uvV.ok) log(`\nuv          ${uvV.stdout.trim()}`);
  if (!tools.ffmpeg || !tools.ffprobe) {
    log("\nffmpeg/ffprobe are required to probe and convert audio (brew install ffmpeg).");
  }
  log("\nThis skill runs mlx-audio through uv; the model downloads on first run.");
  log("Verify end to end with:");
  log('  node scripts/qwen-tts.mjs --text "test" --out /tmp/vo.wav --dry-run');
  process.exit(tools.uv && tools.ffmpeg && tools.ffprobe ? 0 : 1);
}

// ---- mode + model ---------------------------------------------------------
const mode = values.mode || "voicedesign";
if (!["voicedesign", "customvoice", "clone"].includes(mode)) {
  die(`unknown --mode "${mode}" (voicedesign | customvoice | clone)`);
}
const model = values.model || MODELS[mode];

// ---- text -----------------------------------------------------------------
let text = values.text;
if (!text && values["text-file"]) {
  const tf = resolve(values["text-file"]);
  if (!existsSync(tf)) die(`--text-file not found: ${tf}`);
  text = readFileSync(tf, "utf8").trim();
}
if (!text && !process.stdin.isTTY) {
  try { text = readFileSync(0, "utf8").trim(); } catch { /* no stdin */ }
}
if (!text) die("no text: pass --text, --text-file, or pipe via stdin");
if (text.length > 500) {
  log(`note: text is ${text.length} chars; long lines render slower. Consider splitting per scene.`);
}

// ---- output paths ---------------------------------------------------------
const outGiven = values.out || join("assets", "audio", "vo.wav");
const outAbs = resolve(outGiven);
const ext = (values.format || extname(outAbs).replace(/^\./, "") || "wav").toLowerCase();
if (!["wav", "mp3", "flac"].includes(ext)) die(`unsupported --format "${ext}" (wav | mp3 | flac)`);
const wavAbs = ext === "wav" ? outAbs : outAbs.slice(0, outAbs.length - extname(outAbs).length) + ".wav";
const outDir = dirname(wavAbs);
const prefix = values.name || basename(wavAbs, ".wav");
mkdirSync(outDir, { recursive: true });

// ---- build the mlx-audio command -----------------------------------------
const genArgs = [
  "-m", "mlx_audio.tts.generate",
  "--model", model,
  "--text", text,
  "--output_path", outDir,
  "--file_prefix", prefix,
  "--audio_format", "wav",
  "--join_audio",
  "--lang_code", values.lang || "en",
];
if (values.speed) genArgs.push("--speed", values.speed);
if (values.instruct) genArgs.push("--instruct", values.instruct);
if (values.voice) genArgs.push("--voice", values.voice);
if (mode === "customvoice" && !values.voice) genArgs.push("--voice", "Ryan");
if (mode === "clone") {
  if (!values["ref-audio"]) die("clone mode needs --ref-audio <file>");
  const ra = resolve(values["ref-audio"]);
  if (!existsSync(ra)) die(`--ref-audio not found: ${ra}`);
  genArgs.push("--ref_audio", ra);
  if (values["ref-text"]) genArgs.push("--ref_text", values["ref-text"]);
  else log("note: no --ref-text; mlx-audio will auto-transcribe the sample (downloads Whisper once).");
}

const pyVer = values.python || process.env.PROMO_QWEN_PY || "3.12";
const pkg = values["mlx-version"] ? `mlx-audio==${values["mlx-version"]}` : "mlx-audio";
const uvArgs = ["run"];
if (!values["no-project"]) uvArgs.push("--no-project");
uvArgs.push("--python", pyVer);
if (!values["no-prerelease"]) uvArgs.push("--prerelease", "allow");
uvArgs.push("--with", pkg, "python", ...genArgs);

const label = `Qwen3-TTS ${mode} (${model})`;
if (values["dry-run"]) {
  log(`${label}\n`);
  log(`uv ${uvArgs.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
  if (values.normalize) log(`\nffmpeg -i ${wavAbs} -af loudnorm=I=-16:TP=-1.5:LRA=11 <out>`);
  if (ext !== "wav") log(`ffmpeg -i ${wavAbs} ${outAbs}`);
  process.exit(0);
}

if (!which("uv")) {
  die("uv not found. Install it (brew install uv / https://docs.astral.sh/uv), or run mlx-audio via a local venv.");
}

// Remove stale output so a failed render cannot masquerade as success.
for (const p of [wavAbs, outAbs]) { try { if (existsSync(p)) rmSync(p); } catch { /* ignore */ } }

log(`${label}\n`);
const r = run("uv", uvArgs, { env: { UV_PRERELEASE: values["no-prerelease"] ? "disallow" : "allow" } });
if (!r.ok) die(`mlx-audio failed (exit ${r.status}). See output above.`);
if (!existsSync(wavAbs)) die(`mlx-audio reported success but wrote no file at ${wavAbs}`);

// ---- optional normalise + format -----------------------------------------
let work = wavAbs;
if (values.gain) {
  const g = join(outDir, `${prefix}.gain.wav`);
  const gr = run("ffmpeg", ["-y", "-i", work, "-af", `volume=${values.gain}dB`, g], { pipe: true });
  if (gr.ok) { try { rmSync(work); } catch { /* ignore */ } work = g; }
  else log(`warn: gain step failed: ${gr.stderr.trim().split("\n").pop()}`);
}
if (values.normalize) {
  const n = join(outDir, `${prefix}.norm.wav`);
  const nr = run("ffmpeg", ["-y", "-i", work, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", n], { pipe: true });
  if (nr.ok) { try { rmSync(work); } catch { /* ignore */ } work = n; }
  else log(`warn: loudnorm step failed: ${nr.stderr.trim().split("\n").pop()}`);
}
if (ext !== "wav") {
  const br = run("ffmpeg", ["-y", "-i", work, ...(ext === "mp3" ? ["-b:a", "192k"] : []), outAbs], { pipe: true });
  if (!br.ok) die(`ffmpeg convert failed: ${br.stderr.trim().split("\n").pop()}`);
  try { rmSync(work); } catch { /* ignore */ }
} else if (work !== outAbs) {
  // normalised wav: move final over the requested wav path
  const mv = run("mv", [work, outAbs], { pipe: true });
  if (!mv.ok) die(`could not finalise wav: ${mv.stderr.trim()}`);
}

// ---- probe ----------------------------------------------------------------
const probe = run("ffprobe", ["-v", "error", "-show_format", "-of", "json", outAbs], { pipe: true });
let dur = null, size = null;
if (probe.ok) {
  try { const info = JSON.parse(probe.stdout); dur = Number(info.format?.duration); size = Number(info.format?.size); } catch { /* ignore */ }
}

// ---- report + snippet -----------------------------------------------------
const srcPath = values.src || (isAbsolute(outGiven) ? relative(process.cwd(), outAbs) : outGiven);
if (!existsSync(outAbs)) die(`final output missing: ${outAbs}`);
log(`\nwrote      ${outAbs}`);
if (dur) log(`duration   ${f(dur)}s`);
if (size) log(`size       ${(size / 1e6).toFixed(2)} MB`);

const snipDuration = dur ? f(dur) : 3;
log("\nDrop this into the composition (HyperFrames owns playback; never call play()):\n");
log(`<audio id="a-vo" src="${srcPath}" data-start="0" data-duration="${snipDuration}"`);
log(`       data-track-index="1" data-volume="1.0" data-fade-in="0.05" data-fade-out="0.12"></audio>`);
log("\nKeep any music bed 12-18 dB under the voice.");
process.exit(0);
