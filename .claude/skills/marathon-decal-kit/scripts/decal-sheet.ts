// CLI: generate Marathon-style decals as SVG (optionally PNG).
// Without --palette the output is pure black and white (white decals on black) for use as masks in 3D software.
// node scripts/decal-sheet.ts --mode sheet --layout prop --seed 5 --out out/prop.svg --png [--mask black] [--transparent] [--scale 2]
// node scripts/decal-sheet.ts --mode sheet --layout prop --palette lab --seed 4 --out out/prop.svg --png
// node scripts/decal-sheet.ts --mode kind --kind glyphDisc --count 12 --seed 3 --out out/glyphs.svg
// node scripts/decal-sheet.ts --mode variants --text "SEAL 014" --palette ink --out out/variants.svg
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { sheet, catalog, variantSheet, make, toSvg, KINDS, PALETTES, SHEET_LAYOUTS, place, rng, type Decal, type DecalKind, type MaskMode, type PaletteName, type SheetLayout } from "../assets/decals.ts";

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const key = argv[i].slice(2), val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
  args.set(key, val);
}
const get = (k: string, d: string) => args.get(k) ?? d;

if (args.has("help")) {
  console.log(`modes: sheet | kind | variants | catalog
layouts (mode sheet): ${SHEET_LAYOUTS.join(" | ")}
kinds: ${Object.keys(KINDS).join(", ")}
palettes: ${Object.keys(PALETTES).join(", ")}
flags: --mode --layout --kind --palette --mask white|black --seed --count --rows --cell --text --w --footer --no-footer
       --out --png --transparent --scale <n> --chromium <path> --no-fonts
default: no --palette = pure black & white (palette "mask", --mask white, no footer bar)`);
  process.exit(0);
}

const mode = get("mode", "sheet");
// Black & white unless a color palette is asked for; --mask also binarizes an explicit palette.
const mask: MaskMode | undefined = args.has("mask") ? (get("mask", "white") === "black" ? "black" : "white") : args.has("palette") ? undefined : "white";
const palette = get("palette", "mask") as PaletteName;
if (!(palette in PALETTES)) throw new Error(`unknown palette ${palette}`);
const seed = get("seed", "1");
const layout = get("layout", "flow") as SheetLayout;
if (!SHEET_LAYOUTS.includes(layout)) throw new Error(`unknown layout ${layout}`);
const out = get("out", `out/${mode === "sheet" ? `${layout}-` : ""}${mode}-${palette}${mask === "black" ? "-black" : ""}-${seed}.svg`);
const num = (k: string) => (args.has(k) ? +get(k, "0") : undefined);

let d: Decal;
if (mode === "catalog") {
  d = catalog({ seed, palette });
} else if (mode === "variants") {
  d = variantSheet({ text: get("text", "SEAL 014"), palette, seed });
} else if (mode === "kind") {
  const kind = get("kind", "glyphDisc") as DecalKind;
  if (!(kind in KINDS)) throw new Error(`unknown kind ${kind}`);
  const count = +get("count", "12"), r = rng(seed), cols = Math.ceil(Math.sqrt(count)), cell = 160;
  let body = "";
  for (let i = 0; i < count; i++) {
    const it = make(kind, { seed: r.int(1, 1e9), palette, ...(args.has("text") ? { text: get("text", "") } : {}) });
    body += place(it, (i % cols) * cell + 16, Math.floor(i / cols) * cell + 16, cell - 32, cell - 32);
  }
  d = { kind: "grid", w: cols * cell, h: Math.ceil(count / cols) * cell, body };
} else {
  d = sheet({ seed, palette, layout, w: num("w"), count: num("count"), rows: num("rows"), cell: num("cell"), ...(args.has("no-footer") || (mask && !args.has("footer")) ? { footer: false as const } : {}) });
}

const pad = mode === "sheet" ? 0 : 32, transparent = args.has("transparent");
const svgOpts = { palette, padding: pad, embedFonts: !args.has("no-fonts"), mask };
const svg = toSvg(d, { ...svgOpts, background: !transparent });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(`wrote ${out} (${Math.round(d.w)}×${Math.round(d.h)})`);

if (args.has("png")) {
  // Either package works; the name is a variable so neither is required at type-check time.
  const load = async (name: string) => ((await import(name)) as typeof import("playwright-core")).chromium;
  let chromium: Awaited<ReturnType<typeof load>>;
  try { chromium = await load("playwright-core"); }
  catch { try { chromium = await load("playwright"); } catch { console.error("PNG export needs playwright or playwright-core installed"); process.exit(1); } }
  const exe = args.get("chromium") ?? process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const scale = Math.max(1, +get("scale", "1"));
  const page = await browser.newPage({ viewport: { width: Math.ceil(d.w + pad * 2), height: Math.ceil(d.h + pad * 2) }, deviceScaleFactor: scale });
  // A transparent mask is rendered on its ground, then luminance becomes alpha so anti-aliased edges stay soft.
  const render = transparent && mask ? toSvg(d, { ...svgOpts, background: true }) : svg;
  await page.setContent(`<html><body style="margin:0">${render}</body></html>`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  let png = await page.screenshot({ fullPage: true, omitBackground: transparent });
  if (transparent && mask) {
    const b64 = await page.evaluate(async ([src, white]: readonly [string, boolean]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height), a = px.data;
      for (let i = 0; i < a.length; i += 4) {
        const l = a[i] * 0.2126 + a[i + 1] * 0.7152 + a[i + 2] * 0.0722;
        a[i + 3] = white ? l : 255 - l;
        a[i] = a[i + 1] = a[i + 2] = white ? 255 : 0;
      }
      g.putImageData(px, 0, 0);
      return c.toDataURL("image/png").split(",")[1];
    }, [`data:image/png;base64,${png.toString("base64")}`, mask === "white"] as const);
    png = Buffer.from(b64, "base64");
  }
  await browser.close();
  const file = out.replace(/\.svg$/, ".png");
  writeFileSync(file, png);
  console.log(`wrote ${file}${scale > 1 ? ` (×${scale})` : ""}${transparent ? " (transparent)" : ""}`);
}
