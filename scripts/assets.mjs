#!/usr/bin/env node
// promo-motion assets — resolve a media need into a frozen local file + ledger.
//
// The one verb is `resolve`: give it a type and a brief, it picks the first
// available provider, materialises the asset to a local file, and appends a
// provenance record to the project's asset ledger. Re-running the same request
// reuses the frozen file (deterministic builds), unless --force.
//
//   node scripts/assets.mjs check
//   node scripts/assets.mjs ledger --project ./out/roast
//   node scripts/assets.mjs resolve --type voice --text "Roast. Fresh, weekly." \
//     --out ./out/roast/assets/audio/vo-1.mp3
//   node scripts/assets.mjs resolve --type stock --query "coffee beans roasting" \
//     --out ./out/roast/assets/footage/beans.mp4
//   node scripts/assets.mjs resolve --type cutout --in assets/talk.mp4 \
//     --out ./out/roast/assets/footage/presenter.webm
//
// Every resolve supports --dry-run (prints the request, spends nothing).

import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { resolve, dirname, join, relative, basename } from "node:path";
import { run, f, log, die } from "./lib/common.mjs";
import {
  providerStatus, replicateRun, replicateToken, firstUrl, download,
  elevenlabsTts, pexelsVideo, pexelsPhoto, probeDuration,
} from "./lib/providers.mjs";

const USAGE = `promo-motion assets

Resolve media needs into frozen local files, with provenance.

Verbs:
  check                         what providers are configured on this machine
  ledger [--project <dir>]      print the asset ledger
  resolve --type <t> ...        materialise one asset

Types and their flags:
  import  --in <file> --out <file>
  stock   --query "<q>" --out <file> [--media video|photo] [--orientation landscape|portrait|square] [--min-duration <s>]
  cutout  --in <file> --out <.webm|.png|.mov> [--background-output <file>]
  voice   --text "<line>" --out <file> [--provider auto|elevenlabs|qwen3|kokoro|replicate] [--voice <id>] [--instruct "<style>"]
  music   --prompt "<mood>" --out <file> [--duration <s>] [--provider replicate] [--model <owner/name>]
  sfx     --prompt "<sound>" --out <file> [--provider replicate] [--model <owner/name>]
  image   --prompt "<desc>" --out <file> --model <owner/name> [--aspect 16:9]
  video   --prompt "<desc>" --out <file> --model <owner/name> [--duration <s>] [--aspect 16:9]

Common flags:
  --project <dir>     project root (default: derived from --out; used for the ledger)
  --ledger <path>     ledger file (default <project>/assets/asset-ledger.json)
  --force             regenerate even if a matching frozen asset exists
  --dry-run           print the request/command and exit (spends nothing)
  --json              machine-readable result
  --help, -h

Replicate model suggestions (resolve by search before relying on these):
  image  black-forest-labs/flux-schnell | ideogram-ai/ideogram-v2
  video  google/veo-3.1 | kwaivgi/kling-v3-video | bytedance/seedance-2.0 |
         runwayml/gen-4.5 | alibaba/wan-3 | prunaai/p-video (draft mode)
  music  meta/musicgen                       sfx  haoheliu/audio-ldm`;

const options = {
  type: { type: "string" },
  out: { type: "string", short: "o" },
  in: { type: "string" },
  project: { type: "string" }, ledger: { type: "string" },
  provider: { type: "string" }, model: { type: "string" },
  query: { type: "string" }, media: { type: "string" },
  orientation: { type: "string" }, "min-duration": { type: "string" },
  text: { type: "string" }, prompt: { type: "string" },
  voice: { type: "string" }, instruct: { type: "string" },
  duration: { type: "string" }, aspect: { type: "string" }, seed: { type: "string" },
  "background-output": { type: "string" },
  input: { type: "string" },
  force: { type: "boolean" }, "dry-run": { type: "boolean" }, json: { type: "boolean" },
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

const verb = values.type ? "resolve" : (positionals[0] || "check");
const say = (...a) => { if (!values.json) log(...a); };

// ---- ledger ---------------------------------------------------------------

function projectRoot(outFile) {
  if (values.project) return resolve(values.project);
  if (outFile) {
    let d = dirname(resolve(outFile));
    while (d !== dirname(d)) {
      if (existsSync(join(d, "index.html")) || existsSync(join(d, "assets"))) return d;
      d = dirname(d);
    }
    return dirname(resolve(outFile));
  }
  return process.cwd();
}

function ledgerPath(root) {
  return values.ledger ? resolve(values.ledger) : join(root, "assets", "asset-ledger.json");
}

function readLedger(p) {
  if (!existsSync(p)) return { version: 1, assets: [] };
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return { version: 1, assets: [] }; }
}

function writeLedger(p, ledger) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(ledger, null, 2) + "\n");
}

const sha = (obj) => createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 12);

function recordAsset({ key, type, provider, model, prompt, outFile, root, bytes, duration, attribution, license, params, source }) {
  const p = ledgerPath(root);
  const ledger = readLedger(p);
  const entry = {
    key, type, provider,
    model: model || null,
    prompt: prompt || null,
    file: relative(root, resolve(outFile)),
    bytes: bytes ?? null,
    duration: duration ?? null,
    attribution: attribution || null,
    license: license || null,
    params: params || {},
    source: source || null,
    created: new Date().toISOString(),
  };
  ledger.assets = [...ledger.assets.filter((a) => a.key !== key), entry];
  writeLedger(p, ledger);
  return { ledger: p, entry };
}

function findFrozen(root, key, outFile) {
  const ledger = readLedger(ledgerPath(root));
  const hit = ledger.assets.find((a) => a.key === key);
  if (hit && existsSync(join(root, hit.file))) return hit;
  if (outFile && existsSync(resolve(outFile)) && hit) return hit;
  return null;
}

// ---- output ---------------------------------------------------------------

function audioTag(outFile, root) {
  const dur = probeDuration(outFile);
  const src = relative(root, resolve(outFile));
  return `<audio id="a-${basename(outFile).replace(/\.[^.]+$/, "")}" src="${src}" data-start="0" data-duration="${dur ?? 3}" data-track-index="1" data-volume="1.0" data-fade-in="0.05" data-fade-out="0.12"></audio>`;
}

function finish(result) {
  if (values.json) { console.log(JSON.stringify(result, null, 2)); return; }
  const e = result.entry || {};
  say(`\n${result.reused ? "reused" : "created"} ${e.type} -> ${e.file}`);
  say(`  provider: ${e.provider}${e.model ? ` (${e.model})` : ""}`);
  if (e.duration) say(`  duration: ${e.duration}s`);
  if (e.attribution) say(`  attribution: ${e.attribution}`);
  if (e.license) say(`  license: ${e.license}`);
  say(`  ledger: ${result.ledger}`);
  if (result.audioTag) say(`\nPaste-ready:\n${result.audioTag}`);
}

// ---- verbs ----------------------------------------------------------------

if (verb === "check") {
  const s = providerStatus();
  if (values.json) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }
  log("promo-motion assets — providers on this machine\n");
  const label = {
    heygen: "HeyGen (voice/music/cloud render)",
    elevenlabs: "ElevenLabs (voice/music)",
    gemini: "Gemini (Lyria music, TTS, vision)",
    replicate: "Replicate (image/video/music/voice)",
    openrouter: "OpenRouter (image/speech/vision)",
    pexels: "Pexels (stock photo/video)",
    hyperframes: "HyperFrames CLI (render/tts/cutout/beats)",
    qwenTts: "Qwen3-TTS local (uv + mlx-audio)",
    ffmpeg: "ffprobe (duration probing)",
  };
  for (const [k, v] of Object.entries(s)) log(`  ${v ? "✓" : "✗"} ${label[k] || k}`);
  const missing = Object.entries(s).filter(([, v]) => !v).map(([k]) => k);
  log(missing.length ? `\nNot configured: ${missing.join(", ")}` : "\nEverything is configured.");
  process.exit(0);
}

if (verb === "ledger") {
  const root = projectRoot(null);
  const p = ledgerPath(root);
  const ledger = readLedger(p);
  if (values.json) { console.log(JSON.stringify(ledger, null, 2)); process.exit(0); }
  log(`${p} — ${ledger.assets.length} asset(s)`);
  for (const a of ledger.assets) {
    log(`  ${a.type.padEnd(7)} ${String(a.file).padEnd(40)} ${a.provider}${a.model ? " / " + a.model : ""}${a.attribution ? "  [" + a.attribution.slice(0, 40) + "]" : ""}`);
  }
  process.exit(0);
}

if (verb !== "resolve") {
  console.error(USAGE);
  process.exit(2);
}

const type = values.type;
if (!type) die("--type is required");
if (!values.out) die("--out is required");
const outFile = resolve(values.out);
mkdirSync(dirname(outFile), { recursive: true });
const root = projectRoot(outFile);

const params = {
  media: values.media || "video", orientation: values.orientation,
  minDuration: values["min-duration"], aspect: values.aspect,
  duration: values.duration, voice: values.voice, instruct: values.instruct,
  input: values.input ? safeJson(values.input) : undefined,
};

function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }

function frozenOrNull() {
  const key = sha({ type, provider: values.provider || "auto", model: values.model || null, prompt: values.prompt || values.text || values.query || values.in, params });
  if (!values.force) {
    const hit = findFrozen(root, key, outFile);
    if (hit) return { key, hit };
  }
  return { key, hit: null };
}

switch (type) {
  // ---------------------------------------------------------------- import
  case "import": {
    if (!values.in) die("--in is required for import");
    const src = resolve(values.in);
    if (!existsSync(src)) die(`input not found: ${src}`);
    const { key, hit } = frozenOrNull();
    if (hit) { finish({ reused: true, ledger: ledgerPath(root), entry: hit }); break; }
    if (values["dry-run"]) { say(`copy ${src} -> ${outFile}`); break; }
    copyFileSync(src, outFile);
    const res = recordAsset({ key, type, provider: "file", outFile, root, bytes: statSync(outFile).size, duration: probeDuration(outFile), prompt: values.in, source: src });
    finish({ ...res, reused: false, audioTag: isAudio(outFile) ? audioTag(outFile, root) : null });
    break;
  }

  // ----------------------------------------------------------------- stock
  case "stock": {
    if (!values.query) die("--query is required for stock");
    const { key, hit } = frozenOrNull();
    if (hit) { finish({ reused: true, ledger: ledgerPath(root), entry: hit }); break; }
    if (values["dry-run"]) {
      say(`GET https://api.pexels.com/v1/${params.media === "photo" ? "search" : "videos/search"}?query=${encodeURIComponent(values.query)}&orientation=${values.orientation || "landscape"}`);
      say(`Authorization: PEXELS_API_KEY`);
      say(`-> ${outFile}  (records attribution in the ledger)`);
      break;
    }
    if (!process.env.PEXELS_API_KEY) die("stock needs PEXELS_API_KEY (free: https://www.pexels.com/api/)");
    const pick = params.media === "photo"
      ? await pexelsPhoto({ query: values.query, orientation: values.orientation })
      : await pexelsVideo({ query: values.query, orientation: values.orientation, minDuration: params.minDuration });
    say(`pexels ${params.media} ${pick.id} (${pick.width}x${pick.height}${pick.duration ? `, ${pick.duration}s` : ""})`);
    const bytes = await download(pick.url, outFile);
    const res = recordAsset({
      key, type, provider: "pexels", outFile, root, bytes,
      duration: pick.duration ?? probeDuration(outFile),
      attribution: pick.attribution, license: pick.license,
      prompt: values.query, params, source: null,
    });
    finish({ ...res, reused: false });
    break;
  }

  // ---------------------------------------------------------------- cutout
  case "cutout": {
    if (!values.in) die("--in is required for cutout");
    const src = resolve(values.in);
    if (!existsSync(src)) die(`input not found: ${src}`);
    const isImage = /\.(png|jpg|jpeg|webp)$/i.test(src);
    if (isImage && !/\.png$/i.test(outFile)) {
      die(`image input requires a .png output (got ${basename(outFile)}). Use a video input for .webm/.mov, or change --out to <name>.png`);
    }
    if (!isImage && /\.png$/i.test(outFile)) {
      die(`video input requires a .webm or .mov output (got .png). Change --out, or pass an image with --in`);
    }
    const { key, hit } = frozenOrNull();
    if (hit) { finish({ reused: true, ledger: ledgerPath(root), entry: hit }); break; }
    const args = ["--yes", "hyperframes", "remove-background", src, "-o", outFile, "--json"];
    if (values["background-output"]) args.push("-b", resolve(values["background-output"]));
    if (values["dry-run"]) { say(`npx ${args.slice(0, -1).join(" ")}`); break; }
    say("running hyperframes remove-background (local model; person subjects only)…");
    const r = run("npx", args, { pipe: true });
    if (!r.ok) {
      const msg = parseHfError(r.stdout) || (r.stderr || r.stdout || "").slice(-400);
      die(`remove-background failed: ${msg}\n(person-only matting; needs a one-time onnxruntime-node install — see references/tooling.md §7)`);
    }
    const res = recordAsset({ key, type, provider: "hyperframes", model: "u2net_human_seg", outFile, root, bytes: statSync(outFile).size, duration: probeDuration(outFile), prompt: values.in, source: src, params });
    finish({ ...res, reused: false });
    break;
  }

  // ----------------------------------------------------------------- voice
  case "voice": {
    if (!values.text) die("--text is required for voice");
    const picked = pickVoiceProvider(values.provider);
    if (!picked && values["dry-run"]) {
      say("voice provider auto order: elevenlabs -> qwen3 -> kokoro -> replicate(model).");
      say("none are configured on this machine; set ELEVENLABS_API_KEY, install uv, or pass --model.");
      break;
    }
    if (!picked) die("no voice provider available — set ELEVENLABS_API_KEY, install uv (Qwen3-TTS) or Kokoro, or pass --provider replicate --model <owner/name>");
    const { key, hit } = frozenOrNull();
    if (hit) { finish({ reused: true, ledger: ledgerPath(root), entry: hit }); break; }
    if (values["dry-run"]) { voiceDryRun(picked, outFile); break; }

    let bytes = 0, model = null;
    if (picked === "elevenlabs") {
      const r = await elevenlabsTts({ text: values.text, out: outFile, voice: values.voice || undefined });
      bytes = r.bytes; model = "eleven_multilingual_v2";
    } else if (picked === "qwen3") {
      const script = join(import.meta.dirname, "qwen-tts.mjs");
      const args = [script, "--mode", values.instruct ? "voicedesign" : "customvoice",
        "--text", values.text, "--out", outFile, "--normalize"];
      if (values.instruct) args.push("--instruct", values.instruct);
      if (values.voice) args.push("--voice", values.voice);
      const r = run(process.execPath, args, { pipe: true });
      if (!r.ok) die(`qwen-tts failed:\n${(r.stderr || r.stdout || "").slice(-600)}`);
      bytes = existsSync(outFile) ? statSync(outFile).size : 0; model = "Qwen3-TTS-VoiceDesign";
    } else if (picked === "kokoro") {
      const args = ["--yes", "hyperframes", "tts", values.text, "-o", outFile, "--json"];
      if (values.voice) args.push("-v", values.voice);
      const r = run("npx", args, { pipe: true });
      if (!r.ok) die(`hyperframes tts failed:\n${(r.stderr || r.stdout || "").slice(-600)}`);
      bytes = existsSync(outFile) ? statSync(outFile).size : 0; model = "Kokoro-82M";
    } else if (picked === "replicate") {
      if (!values.model) die("--provider replicate needs --model <owner/name>");
      const input = { text: values.text, ...(params.input || {}) };
      if (values.voice) input.voice = values.voice;
      const output = await replicateRun(values.model, input);
      bytes = await download(firstUrl(output), outFile);
      model = values.model;
    }
    const res = recordAsset({ key, type, provider: picked, model, outFile, root, bytes, duration: probeDuration(outFile), prompt: values.text, params });
    finish({ ...res, reused: false, audioTag: audioTag(outFile, root) });
    break;
  }

  // --------------------------------------------------------- music / sfx
  case "music":
  case "sfx": {
    const prompt = values.prompt;
    if (!prompt) die(`--prompt is required for ${type}`);
    if (!replicateToken() && !values["dry-run"]) die(`${type} needs REPLICATE_API_TOKEN (or use HyperFrames /media-use for the HeyGen/Lyria libraries)`);
    const model = values.model || (type === "music" ? "meta/musicgen" : "haoheliu/audio-ldm");
    const { key, hit } = frozenOrNull();
    if (hit) { finish({ reused: true, ledger: ledgerPath(root), entry: hit }); break; }
    const input = buildGenInput(type, values, params);
    if (values["dry-run"]) { say(`POST https://api.replicate.com/v1/predictions  model=${model}`); say(`input ${JSON.stringify(input)}`); say(`-> ${outFile}`); break; }
    const output = await replicateRun(model, input);
    const bytes = await download(firstUrl(output), outFile);
    const res = recordAsset({ key, type, provider: "replicate", model, outFile, root, bytes, duration: probeDuration(outFile), prompt, params });
    finish({ ...res, reused: false, audioTag: audioTag(outFile, root) });
    break;
  }

  // ------------------------------------------------------- image / video
  case "image":
  case "video": {
    const prompt = values.prompt;
    if (!prompt) die(`--prompt is required for ${type}`);
    if (!values.model) die(`--model is required for ${type} (e.g. ${type === "image" ? "black-forest-labs/flux-schnell" : "google/veo-3.1"}); resolve names with a model search first`);
    if (!replicateToken() && !values["dry-run"]) die(`${type} needs REPLICATE_API_TOKEN`);
    const { key, hit } = frozenOrNull();
    if (hit) { finish({ reused: true, ledger: ledgerPath(root), entry: hit }); break; }
    const input = buildGenInput(type, values, params);
    if (values["dry-run"]) { say(`POST https://api.replicate.com/v1/predictions  model=${values.model}`); say(`input ${JSON.stringify(input)}`); say(`-> ${outFile}`); break; }
    const output = await replicateRun(values.model, input);
    const bytes = await download(firstUrl(output), outFile);
    const res = recordAsset({ key, type, provider: "replicate", model: values.model, outFile, root, bytes, duration: probeDuration(outFile), prompt, params });
    finish({ ...res, reused: false });
    break;
  }

  default:
    die(`unknown type: ${type} (see --help)`);
}

// ---- helpers --------------------------------------------------------------

function isAudio(p) { return /\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i.test(p); }

function parseHfError(text) {
  const s = (text || "").trim();
  const start = s.indexOf("{");
  if (start < 0) return null;
  try { return JSON.parse(s.slice(start)).error || null; } catch { return null; }
}

function pickVoiceProvider(explicit) {
  if (explicit && explicit !== "auto") return explicit;
  const s = providerStatus();
  if (s.elevenlabs) return "elevenlabs";
  if (s.qwenTts) return "qwen3";
  if (s.hyperframes) return "kokoro";
  if (s.replicate && values.model) return "replicate";
  return null;
}

function voiceDryRun(provider, out) {
  if (provider === "elevenlabs") say(`POST https://api.elevenlabs.io/v1/text-to-speech/<voice> (xi-api-key) -> ${out}`);
  else if (provider === "qwen3") say(`node scripts/qwen-tts.mjs --mode ${values.instruct ? "voicedesign" : "customvoice"} --text "${values.text}" --out ${out} --normalize`);
  else if (provider === "kokoro") say(`npx hyperframes tts "${values.text}" -o ${out}${values.voice ? ` -v ${values.voice}` : ""}`);
  else if (provider === "replicate") say(`POST https://api.replicate.com/v1/predictions model=${values.model} text="${values.text}" -> ${out}`);
}

function buildGenInput(t, v, p) {
  const base = {};
  if (t === "music") {
    base.prompt = v.prompt;
    if (v.duration) base.duration = Number(v.duration);
    base.output_format = "wav";
  } else if (t === "sfx") {
    base.prompt = v.prompt;
    if (v.duration) base.duration = Number(v.duration);
  } else if (t === "image") {
    base.prompt = v.prompt;
    if (v.aspect) base.aspect_ratio = v.aspect;
  } else if (t === "video") {
    base.prompt = v.prompt;
    if (v.aspect) base.aspect_ratio = v.aspect;
    if (v.duration) base.duration = Number(v.duration);
  }
  if (v.seed) base.seed = Number(v.seed);
  return { ...base, ...(p.input || {}) };
}
