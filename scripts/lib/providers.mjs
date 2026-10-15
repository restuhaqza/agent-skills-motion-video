// Provider clients for promo-motion asset resolution.
//
// Every function here is non-interactive and returns plain data. No secret is
// ever written into a project: tokens are read from the environment or an
// existing tool config, and only the *result* (a frozen local file + provenance)
// is recorded in the asset ledger.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { run } from "./common.mjs";

export const env = (...names) => names.find((n) => process.env[n]) || null;
export const envVal = (...names) => names.map((n) => process.env[n]).find(Boolean) || null;

// ---- credential discovery -------------------------------------------------

function opencodeMcpEnvironment(match) {
  for (const p of [
    join(homedir(), ".config", "opencode", "opencode.json"),
    join(homedir(), ".config", "opencode", "opencode.jsonc"),
  ]) {
    if (!existsSync(p)) continue;
    try {
      const cfg = JSON.parse(readFileSync(p, "utf8"));
      const servers = cfg?.mcp?.servers || cfg?.mcp || {};
      for (const s of Object.values(servers)) {
        if (s && JSON.stringify(s).includes(match) && s.environment) return s.environment;
      }
    } catch { /* ignore a malformed config */ }
  }
  return null;
}

export function replicateToken() {
  if (process.env.REPLICATE_API_TOKEN) return process.env.REPLICATE_API_TOKEN;
  const e = opencodeMcpEnvironment("replicate");
  return e?.REPLICATE_API_TOKEN || null;
}

export function openrouterToken() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const e = opencodeMcpEnvironment("openrouter");
  return e?.OPENROUTER_API_KEY || null;
}

export function heygenConfigured() {
  if (envVal("HEYGEN_API_KEY", "HYPERFRAMES_API_KEY", "HEYGEN_ACCESS_TOKEN")) return true;
  return existsSync(join(homedir(), ".heygen", "credentials"));
}

// ---- status ---------------------------------------------------------------

export function providerStatus() {
  const uv = run("sh", ["-lc", "command -v uv >/dev/null 2>&1"], { pipe: true }).ok;
  return {
    // audio
    heygen: heygenConfigured(),
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    gemini: !!envVal("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    // generation
    replicate: !!replicateToken(),
    openrouter: !!openrouterToken(),
    // stock
    pexels: !!process.env.PEXELS_API_KEY,
    // local media CLI
    hyperframes: run("sh", ["-lc", "command -v hyperframes >/dev/null 2>&1 || npx --yes hyperframes --version >/dev/null 2>&1"], { pipe: true }).ok,
    qwenTts: uv,
    ffmpeg: run("sh", ["-lc", "command -v ffprobe >/dev/null 2>&1"], { pipe: true }).ok,
  };
}

// ---- Replicate ------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries, label) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const m = String(e);
      const retryable = /\b429\b|\b5\d\d\b|throttl|rate limit|fetch failed|ECONN|ETIMEDOUT|socket/i.test(m);
      if (!retryable || i === tries - 1) throw e;
      await sleep(/\b429\b|throttl|rate limit/i.test(m) ? 15000 * (i + 1) : 1500 * (i + 1));
    }
  }
  throw last;
}

export async function replicateModel(owner, name) {
  const token = replicateToken();
  if (!token) throw new Error("no Replicate token (set REPLICATE_API_TOKEN)");
  const H = { Authorization: `Bearer ${token}` };
  return withRetry(async () => {
    const r = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, { headers: H });
    if (!r.ok) throw new Error(`model ${owner}/${name}: ${r.status} ${(await r.text()).slice(0, 180)}`);
    return r.json();
  }, 4, "model");
}

/** Run a Replicate model and return the output URL(s). */
export async function replicateRun(modelRef, input) {
  const [owner, name] = modelRef.split("/");
  const m = await replicateModel(owner, name);
  const version = m.latest_version?.id;
  const token = replicateToken();
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let p = await withRetry(async () => {
    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST", headers: H, body: JSON.stringify({ version, input }),
    });
    if (!r.ok) throw new Error(`predict: ${r.status} ${(await r.text()).slice(0, 180)}`);
    return r.json();
  }, 4, "predict");
  while (["starting", "processing"].includes(p.status)) {
    await sleep(3000);
    p = await withRetry(async () => {
      const g = await fetch(p.urls.get, { headers: H });
      if (!g.ok) throw new Error(`poll: ${g.status}`);
      return g.json();
    }, 4, "poll");
  }
  if (p.status !== "succeeded") throw new Error(`prediction ${p.status}: ${p.error}`);
  return p.output;
}

/** Download a URL to a local path. Returns bytes written. */
export async function download(url, out, headers = {}) {
  const r = await withRetry(async () => {
    const x = await fetch(url, { headers });
    if (!x.ok) throw new Error(`download ${x.status}`);
    return x;
  }, 4, "download");
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(out, buf);
  return buf.length;
}

export function firstUrl(output) {
  const u = Array.isArray(output) ? output[output.length - 1] : output;
  return typeof u === "string" ? u : u?.url;
}

// ---- ElevenLabs -----------------------------------------------------------

export async function elevenlabsTts({ text, out, voice = "21m00Tcm4TlvDq8ikWAM", model = "eleven_multilingual_v2" }) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("no ELEVENLABS_API_KEY");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model }),
  });
  if (!r.ok) throw new Error(`elevenlabs ${r.status}: ${(await r.text()).slice(0, 180)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(out, buf);
  return { bytes: buf.length };
}

// ---- Pexels ---------------------------------------------------------------

export async function pexelsVideo({ query, orientation, minDuration, perPage = 15 }) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("no PEXELS_API_KEY");
  const url = new URL("https://api.pexels.com/v1/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  if (orientation) url.searchParams.set("orientation", orientation);
  const r = await fetch(url, { headers: { Authorization: key } });
  if (!r.ok) throw new Error(`pexels ${r.status}: ${(await r.text()).slice(0, 180)}`);
  const data = await r.json();
  let videos = data.videos || [];
  if (minDuration) videos = videos.filter((v) => (v.duration || 0) >= Number(minDuration));
  if (!videos.length) throw new Error(`pexels: no video matched "${query}"`);
  const v = videos[0];
  const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.width);
  files.sort((a, b) => (b.width || 0) - (a.width || 0));
  const file = files[0];
  return {
    url: file.link,
    width: file.width,
    height: file.height,
    duration: v.duration,
    id: v.id,
    attribution: `Video by ${v.user?.name || "a Pexels contributor"} on Pexels (${v.url})`,
    license: "Pexels License — attribution required",
  };
}

export async function pexelsPhoto({ query, orientation, perPage = 15 }) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("no PEXELS_API_KEY");
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  if (orientation) url.searchParams.set("orientation", orientation);
  const r = await fetch(url, { headers: { Authorization: key } });
  if (!r.ok) throw new Error(`pexels ${r.status}: ${(await r.text()).slice(0, 180)}`);
  const data = await r.json();
  const p = (data.photos || [])[0];
  if (!p) throw new Error(`pexels: no photo matched "${query}"`);
  return {
    url: p.src?.original || p.src?.large2x,
    width: p.width, height: p.height,
    id: p.id,
    attribution: `Photo by ${p.photographer} on Pexels (${p.url})`,
    license: "Pexels License — attribution required",
  };
}

// ---- local probing --------------------------------------------------------

export function probeDuration(file) {
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { pipe: true });
  if (!r.ok) return null;
  const n = Number((r.stdout || "").trim());
  return Number.isFinite(n) ? Number(n.toFixed(3)) : null;
}
