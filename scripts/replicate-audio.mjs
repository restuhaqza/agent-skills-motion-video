#!/usr/bin/env node
// Minimal Replicate REST client for promo-motion audio generation.
// Reads REPLICATE_API_TOKEN from env, else from ~/.config/opencode/opencode.json.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

function token() {
  if (process.env.REPLICATE_API_TOKEN) return process.env.REPLICATE_API_TOKEN;
  const cfg = JSON.parse(readFileSync(`${homedir()}/.config/opencode/opencode.json`, "utf8"));
  const servers = cfg?.mcp?.servers || cfg?.mcp || {};
  const rep = servers.replicate || Object.values(servers).find((s) => JSON.stringify(s).includes("replicate-mcp"));
  const t = rep?.environment?.REPLICATE_API_TOKEN;
  if (!t) throw new Error("no Replicate token found");
  return t;
}

const H = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 5, label = "call") {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const m = String(e);
      const is429 = /\b429\b|throttl|rate limit/i.test(m);
      const retryable = is429 || /500|502|503|504|fetch failed|ECONN|ETIMEDOUT|socket/i.test(m);
      if (!retryable || i === tries - 1) throw e;
      const wait = is429 ? 20000 * (i + 1) : 1500 * (i + 1);
      console.error(`retry ${i + 1}/${tries} (${label}) in ${wait / 1000}s: ${m.slice(0, 100)}`);
      await sleep(wait);
    }
  }
  throw last;
}

async function model(owner, name) {
  return withRetry(async () => {
    const r = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, { headers: H });
    if (!r.ok) throw new Error(`model ${owner}/${name}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }, 4, `model ${owner}/${name}`);
}

async function predict(owner, name, input) {
  const m = await model(owner, name);
  const version = m.latest_version?.id;
  let p = await withRetry(async () => {
    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST", headers: H, body: JSON.stringify({ version, input }),
    });
    if (!r.ok) throw new Error(`predict: ${r.status} ${(await r.text()).slice(0, 200)}`);
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

async function search(query) {
  const r = await fetch(`https://api.replicate.com/v1/models?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: H.Authorization },
  });
  if (!r.ok) throw new Error(`search: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function download(url, out) {  const r = await withRetry(async () => {
    const x = await fetch(url, { headers: H });
    if (!x.ok) throw new Error(`download: ${x.status}`);
    return x;
  }, 4, "download");
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "schema") {
  const [owner, name] = args;
  const m = await model(owner, name);
  const input = m.latest_version?.openapi_schema?.components?.schemas?.Input;
  console.log(JSON.stringify({ model: `${owner}/${name}`, version: m.latest_version?.id, run_count: m.run_count, input: input?.properties, required: input?.required }, null, 2));
} else if (cmd === "gen") {
  const [owner, name, out, inputJson] = args;
  const output = await predict(owner, name, JSON.parse(inputJson));
  const url = Array.isArray(output) ? output[output.length - 1] : output;
  console.log("output:", url);
  await download(typeof url === "string" ? url : url.url, out);
  console.log("saved:", out);
} else if (cmd === "search") {
  const [q] = args;
  const r = await search(q);
  const list = (r?.results || []).map((m) => `${m.owner}/${m.name}  (runs ${m.run_count})  — ${(m.description || "").slice(0, 90)}`);
  console.log(list.join("\n"));
} else {
  console.log("usage: replicate-audio.mjs schema <owner> <name> | gen <owner> <name> <out> '<json>' | search '<query>'");
}
