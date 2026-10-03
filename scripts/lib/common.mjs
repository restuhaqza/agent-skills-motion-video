import { spawnSync } from "node:child_process";

export const DEFAULTS = {
  colors: {
    bg: "#0B0B0E",
    surface: "#15151A",
    fg: "#F5F5F7",
    muted: "#9A9AA5",
    primary: "#FF5A1F",
    accent: "#FFB020",
    contrast: "#FFFFFF",
  },
  fonts: {
    display: '"Space Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif',
    body: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    displayWeight: 800,
    tracking: "-0.02em",
  },
  motion: { personality: "confident", energy: 0.6 },
};

export const ASPECTS = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
};

export function brandCssVars(brand, w, h) {
  const c = { ...DEFAULTS.colors, ...(brand.colors || {}) };
  const f = { ...DEFAULTS.fonts, ...(brand.fonts || {}) };
  return [
    `--bg: ${c.bg};`,
    `--surface: ${c.surface};`,
    `--fg: ${c.fg};`,
    `--muted: ${c.muted};`,
    `--primary: ${c.primary};`,
    `--accent: ${c.accent};`,
    `--contrast: ${c.contrast};`,
    `--font-display: ${f.display};`,
    `--font-body: ${f.body};`,
    `--display-weight: ${f.displayWeight};`,
    `--tracking: ${f.tracking};`,
    `--w: ${w}px;`,
    `--h: ${h}px;`,
  ].join("\n      ");
}

export function hexToRgba(hex, alpha = 1) {
  if (typeof hex !== "string") return `rgba(0,0,0,${alpha})`;
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    stdio: opts.pipe ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, ...(opts.env || {}) },
    maxBuffer: 128 * 1024 * 1024,
  });
  if (res.error) {
    return { ok: false, status: 127, stdout: "", stderr: String(res.error.message || res.error) };
  }
  return { ok: res.status === 0, status: res.status ?? 1, stdout: res.stdout || "", stderr: res.stderr || "" };
}

export function which(bin) {
  return run("sh", ["-lc", `command -v ${bin} >/dev/null 2>&1`], { pipe: true }).ok;
}

export function f(n) {
  return Number(Number(n).toFixed(3));
}

export function log(...a) {
  console.log(...a);
}

export function die(msg, code = 1) {
  console.error("promo-motion: " + msg);
  process.exit(code);
}

export function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? undefined : v)));
}

export function readDurationFromHtml(fileText, fallback = 3) {
  const m = fileText.match(/data-duration="([0-9.]+)"/);
  return m ? Number(m[1]) : fallback;
}
