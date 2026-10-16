#!/usr/bin/env node
import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULTS, stripUndefined, log, normalizeArgv } from "./lib/common.mjs";

const USAGE = `promo-motion brand-scaffold

Write a brand.tokens.json from flags. Unset colors fall back to the built-in
neutral kit, so you always get a complete, renderable file.

Usage:
  node scripts/brand-scaffold.mjs --name Acme --primary "#FF5A1F" --out brand.tokens.json

Flags:
  --name <string>          brand name
  --primary <hex>          action / emphasis color
  --accent <hex>           secondary accent
  --bg <hex>               background / ground
  --surface <hex>          plates, bars, secondary surface
  --fg <hex>               primary text
  --muted <hex>            secondary text
  --contrast <hex>         text on the primary color
  --display <font-family>  display / hero font
  --body <font-family>     body / support font
  --display-weight <int>   100-900
  --tracking <em>          e.g. -0.02em
  --logo <path>            relative path to the logo asset
  --personality <name>     premium | confident | energetic | playful
  --out, -o <path>         output file or directory (default brand.tokens.json)
  --help, -h`;

const opts = {
  name: { type: "string" },
  primary: { type: "string" },
  accent: { type: "string" },
  bg: { type: "string" },
  surface: { type: "string" },
  fg: { type: "string" },
  muted: { type: "string" },
  contrast: { type: "string" },
  display: { type: "string" },
  body: { type: "string" },
  "display-weight": { type: "string" },
  tracking: { type: "string" },
  logo: { type: "string" },
  personality: { type: "string" },
  out: { type: "string", short: "o" },
  help: { type: "boolean", short: "h" },
};

let values;
try {
  ({ values } = parseArgs({ options: opts, args: normalizeArgv(process.argv.slice(2), opts), allowPositionals: true }));
} catch (e) {
  console.error("promo-motion: " + e.message + "\n");
  console.error(USAGE);
  process.exit(2);
}

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const name = values.name || "Brand";
const brand = stripUndefined({
  name,
  colors: {
    bg: values.bg,
    surface: values.surface,
    fg: values.fg,
    muted: values.muted,
    primary: values.primary,
    accent: values.accent,
    contrast: values.contrast,
  },
  fonts: {
    display: values.display,
    body: values.body,
    displayWeight: values["display-weight"] ? Number(values["display-weight"]) : undefined,
    tracking: values.tracking,
  },
  logo: values.logo ? { src: values.logo, alt: name } : undefined,
  motion: {
    personality: values.personality || undefined,
    energy: DEFAULTS.motion.energy,
  },
  notes: "",
});

const out = values.out || "brand.tokens.json";
const target = out.endsWith(".json") ? out : resolve(out, "brand.tokens.json");
mkdirSync(dirname(resolve(target)), { recursive: true });
writeFileSync(target, JSON.stringify(brand, null, 2) + "\n");
log(`Wrote ${target}`);
log(`Colors default to the neutral kit where unset. Edit the file to refine.`);
