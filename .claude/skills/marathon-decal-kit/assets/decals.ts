// Marathon-style decal / symbol / text-variant generator.
// Zero dependencies, deterministic (seeded), outputs plain SVG markup.
// Runs in browsers, bundlers and Node 22+ (`node file.ts` strips types).

/* ============================== palettes ============================== */

export interface Palette { bg: string; fg: string; muted: string; accents: string[] }

/** Colors sampled from the reference decal sheets (see references/palette.md). */
export const PALETTES = {
  /** pure white on pure black, no greys: masks for 3D software (pair with toSvg({ mask })) */
  mask: { bg: "#000000", fg: "#FFFFFF", muted: "#FFFFFF", accents: ["#FFFFFF"] },
  /** white decals on black: glyph sheets, NuCaloric atlas, UESC lockup */
  mono: { bg: "#000000", fg: "#FFFFFF", muted: "#8A8A8A", accents: ["#FFFFFF", "#C4C4C4"] },
  /** black decals on white */
  ink: { bg: "#FFFFFF", fg: "#0A0A0A", muted: "#9A9A9A", accents: ["#0A0A0A", "#3B3B3B"] },
  /** light-gray lab sheet: red bar, deep teal type, olive, signal yellow, coral */
  lab: { bg: "#C4C4C4", fg: "#1A1A1A", muted: "#7E7E7E", accents: ["#E53002", "#055F5A", "#899469", "#F9FA14", "#FA8A62", "#4EBC99"] },
  /** acid lime on black, the footer-bar color of the official sheets */
  signal: { bg: "#0A0A0A", fg: "#C0FE0F", muted: "#4A5A12", accents: ["#C0FE0F", "#FFFFFF"] },
  /** medic decals: white ground, yellow / dusk purple / periwinkle / violet / mint */
  medic: { bg: "#FFFFFF", fg: "#1F1F21", muted: "#BDBDBD", accents: ["#FFDF28", "#56507F", "#6E79FE", "#B16CFE", "#4EBC99"] },
  /** colored prop atlas on deep navy */
  atlas: { bg: "#003A54", fg: "#FFFFFF", muted: "#5D7F8F", accents: ["#BFEF00", "#FFF300", "#20B14A", "#00ADEF", "#F36422", "#FF008B", "#2763E5", "#FBCD1C"] },
  /** seal / attach bands: black, charcoal, safety orange, olive, lime-green type */
  hazard: { bg: "#0A0A0A", fg: "#FFFFFF", muted: "#363636", accents: ["#E74600", "#9ECC23", "#91E838", "#E7001E", "#B920B3", "#80AA5A"] },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;
export type PaletteInput = PaletteName | Palette;
const pal = (p: PaletteInput = "mono"): Palette => (typeof p === "string" ? PALETTES[p] : p);

/* ============================== fonts ============================== */
// Original typefaces first (used when installed locally), free look-alikes after.
export const FONTS = {
  display: "'KH Interference','Chakra Petch','Michroma','Eurostile',sans-serif",
  wide: "'Shapiro Wide','Archivo Expanded','Archivo','Helvetica Neue',sans-serif",
  mono: "'Fraktion Mono','JetBrains Mono','IBM Plex Mono',monospace",
  grotesk: "'Neue Haas Grotesk Display','Helvetica Neue','Inter',Arial,sans-serif",
  serif: "'IvyPresto Headline','Instrument Serif',serif",
};
export type FontKey = keyof typeof FONTS;
/** Average advance width per em, used to size text boxes (textLength pins the final width). */
const ADV: Record<FontKey, number> = { display: 0.66, wide: 0.82, mono: 0.6, grotesk: 0.56, serif: 0.5 };

/* ============================== rng ============================== */

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

export function rng(seed: number | string = 1): Rng {
  let h = 2166136261 >>> 0;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
  };
}

/* ============================== svg helpers ============================== */

export interface Decal { kind: string; w: number; h: number; body: string }

let uidCounter = 0;
const uid = (p: string) => `mtd-${p}-${(uidCounter++).toString(36)}`;
const n = (v: number) => +v.toFixed(2);
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const poly = (pts: number[][], fill: string) =>
  `<polygon points="${pts.map(p => `${n(p[0])},${n(p[1])}`).join(" ")}" fill="${fill}"/>`;

interface TextOpts { font?: FontKey; size: number; fill: string; weight?: number; anchor?: "start" | "middle" | "end"; width?: number; spacing?: number; extra?: string }
function text(x: number, y: number, s: string, o: TextOpts) {
  const len = o.width ? ` textLength="${n(o.width)}" lengthAdjust="spacingAndGlyphs"` : "";
  const ls = o.spacing ? ` letter-spacing="${o.spacing}"` : "";
  return `<text x="${n(x)}" y="${n(y)}" font-family="${FONTS[o.font ?? "mono"]}" font-size="${n(o.size)}" font-weight="${o.weight ?? 500}" fill="${o.fill}" text-anchor="${o.anchor ?? "start"}"${len}${ls}${o.extra ? " " + o.extra : ""}>${esc(s)}</text>`;
}
const textW = (s: string, size: number, font: FontKey = "mono") => s.length * size * ADV[font];
const isHex = (h: string) => /^#[0-9a-f]{6}$/i.test(h);
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** Relative luminance (WCAG) of a #RRGGBB color. */
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(v => v / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Black or white, whichever reads better on `fill` (hex). */
export function onColor(fill: string) {
  return isHex(fill) && lum(fill) > 0.3 ? "#0A0A0A" : "#FFFFFF";
}
const contrast = (a: string, b: string) => {
  if (!isHex(a) || !isHex(b)) return 21;
  const [x, y] = [lum(a), lum(b)].sort((m, k) => k - m);
  return (x + 0.05) / (y + 0.05);
};
/** Linear blend of two #RRGGBB colors (t = 0 → a, 1 → b). */
const mix = (a: string, b: string, t: number) =>
  isHex(a) && isHex(b) ? "#" + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, "0")).join("") : a;
const saturated = (h: string) => { if (!isHex(h)) return false; const v = rgb(h); return Math.max(...v) - Math.min(...v) > 60; };

/** Google Fonts stylesheet for the free look-alikes (locally installed originals still win). */
export const FONT_CSS = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,400..800&family=Chakra+Petch:wght@500;700&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;800&family=Instrument+Serif&display=swap";

/** "white": white decals on black · "black": black decals on white. */
export type MaskMode = "white" | "black";
/** Snaps every #RRGGBB in the markup to pure ink or ground, judged against the palette it was drawn with; drops opacity. */
function binarize(body: string, p: Palette, mode: MaskMode) {
  const ink = mode === "white" ? "#FFFFFF" : "#000000", ground = mode === "white" ? "#000000" : "#FFFFFF";
  return body
    .replace(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g, m => (contrast(m.slice(0, 7), p.bg) > contrast(m.slice(0, 7), p.fg) ? ink : ground))
    .replace(/ opacity="[^"]*"/g, "");
}

/**
 * Wraps a decal into a standalone <svg>. `background` paints the palette bg (or a given color).
 * `mask` outputs pure black and white for 3D software; draw the decal with palette "mask" so nothing relies on grey.
 */
export function toSvg(d: Decal, o: { background?: boolean | string; palette?: PaletteInput; padding?: number; scale?: number; embedFonts?: boolean; mask?: MaskMode } = {}) {
  const p = o.padding ?? 0, palette = pal(o.palette);
  const W = d.w + p * 2, H = d.h + p * 2, s = o.scale ?? 1;
  const fill = typeof o.background === "string" ? o.background : o.mask ? (o.mask === "white" ? "#000000" : "#FFFFFF") : palette.bg;
  const bg = o.background ? `<rect width="${W}" height="${H}" fill="${fill}"/>` : "";
  const fonts = o.embedFonts ? `<style>@import url('${FONT_CSS.replace(/&/g, "&amp;")}');</style>` : "";
  const body = o.mask ? binarize(d.body, palette, o.mask) : d.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(W)} ${n(H)}" width="${n(W * s)}" height="${n(H * s)}">${fonts}${bg}<g transform="translate(${p} ${p})">${body}</g></svg>`;
}

/** Places a decal inside a box (keeps aspect ratio, centered). */
export function place(d: Decal, x: number, y: number, w: number, h: number) {
  return `<svg x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(d.w)} ${n(d.h)}" overflow="visible">${d.body}</svg>`;
}

/* ============================== copy generators ============================== */

const L = "ABCDEFGHJKLMNPRSTUVWXZ";
const D = "0123456789";
const AN = L + D;
const str = (r: Rng, chars: string, len: number) => Array.from({ length: len }, () => r.pick(chars.split(""))).join("");

/** Fictional codes in the style of the reference sheets. None reproduce a real product. */
export const codes = {
  serial: (r: Rng) => `${r.int(100, 999)} ${str(r, L, 1)}${r.int(10000, 99999)}`, // 188 B91543
  part: (r: Rng) => `${str(r, L, 3)}${r.int(10, 99)}   ${r.int(1000000, 9999999)}`, // SDR37   2445556
  model: (r: Rng) => `${str(r, L, 1)}${r.int(1, 9)}${str(r, L, 1)}-*${r.int(1, 9)}`, // R9K-*3
  lot: (r: Rng) => `LOT // ${r.int(1, 4)}.${r.int(100, 9999)} ${r.int(1, 9)} ${str(r, L, 1)}`,
  tracking: (r: Rng) => `${r.int(100000, 999999)}-${str(r, L, 5)}`,
  short: (r: Rng) => `${str(r, L, 1)}${r.int(1, 99)}`, // B7, S8
  ratio: (r: Rng) => `${str(r, L, 2)} x ${r.int(1000, 9999)}`, // AC x 5078
  date: (r: Rng) => `${r.int(1, 12)}.${r.int(1, 28)}.${r.int(1979, 2099)}`,
  stamp: (r: Rng) => `${r.int(10, 28)}.${r.int(10, 12)}.`, // 14.12.
  hexRow: (r: Rng) => Array.from({ length: 3 }, () => str(r, AN, 3)).join(" "), // 118 B91 543
  mixed: (r: Rng) => `${str(r, L, 1)}${str(r, "abcdeq", 1)} ${str(r, L, 3)}   ${str(r, L, 2)}   ${str(r, L, 1)}/${str(r, L, 2)}${r.int(1, 9)}`, // Mq EXC  FF  G/TS8
};

const SYL_A = ["NU", "KA", "VO", "TRE", "SE", "MO", "ZE", "OR", "AX", "LU", "DE", "QI", "RA", "HE"];
const SYL_B = ["VEX", "LIN", "TAR", "CORE", "NIX", "DYN", "RAL", "GEN", "MAX", "SYS", "TEK", "VA", "KO", "MIR"];
/** Fictional corporation / division names, e.g. KAVEX, ZETAR SYSTEMS. */
export function corpName(r: Rng, long = false) {
  const base = r.pick(SYL_A) + r.pick(SYL_B);
  return long ? `${base} ${r.pick(["SYSTEMS", "INDUSTRIES", "AGRICULTURE", "DATA DIV.", "BIOMEDICAL", "MUNITIONS", "LOGISTICS"])}` : base;
}
export const WORDS = ["SEAL", "LINK", "ATTACH", "PACKAGE", "VENT", "LOCK", "FEED", "CERT", "DETACH", "FILTER", "POWER", "COVER", "INTAKE", "PURGE", "SYNC", "ARMED", "CORE", "CARGO", "MEDIC", "FUEL"];
const NOTICES = [
  ["SHUT OFF MAIN VALVE.", "BLEED ALL LINES BEFORE", "SERVICING THIS UNIT."],
  ["HIGH PRESSURE CONTENTS.", "DO NOT PUNCTURE.", "STORE BELOW 40°C."],
  ["AUTHORIZED PERSONNEL ONLY.", "LOG ALL ACCESS", "AT TERMINAL 4."],
  ["READ NOTICE BEFORE USE.", "BEST BEFORE: SEE BOTTOM.", "DO NOT BEND."],
  ["CONTENTS UNDER VACUUM.", "BREAK SEAL SLOWLY.", "DISCARD IF SWOLLEN."],
];
export const PROPS = [
  ["Fibre Length", "mm"], ["Fibre Diameter", "um"], ["Linear Dens.", "dtex"], ["Tensile Strength", "MPa"],
  ["Tensile Modulus", "GPa"], ["Strain to Failure", "%"], ["Density", "g/cc"], ["Thermal Cond.", "W/mK"], ["Shelf Life", "d"],
];
export const MATERIALS = ["Carbon", "Aramid", "Ceramic", "Polymer", "Alloy 6063", "Graphene"];

/* ============================== bitmap + segment fonts ============================== */

const PIX: Record<string, string> = {
  A: "01110,10001,10001,11111,10001,10001,10001", B: "11110,10001,10001,11110,10001,10001,11110",
  C: "01110,10001,10000,10000,10000,10001,01110", D: "11110,10001,10001,10001,10001,10001,11110",
  E: "11111,10000,10000,11110,10000,10000,11111", F: "11111,10000,10000,11110,10000,10000,10000",
  G: "01110,10001,10000,10111,10001,10001,01111", H: "10001,10001,10001,11111,10001,10001,10001",
  I: "01110,00100,00100,00100,00100,00100,01110", J: "00111,00010,00010,00010,00010,10010,01100",
  K: "10001,10010,10100,11000,10100,10010,10001", L: "10000,10000,10000,10000,10000,10000,11111",
  M: "10001,11011,10101,10101,10001,10001,10001", N: "10001,10001,11001,10101,10011,10001,10001",
  O: "01110,10001,10001,10001,10001,10001,01110", P: "11110,10001,10001,11110,10000,10000,10000",
  Q: "01110,10001,10001,10001,10101,10010,01101", R: "11110,10001,10001,11110,10100,10010,10001",
  S: "01111,10000,10000,01110,00001,00001,11110", T: "11111,00100,00100,00100,00100,00100,00100",
  U: "10001,10001,10001,10001,10001,10001,01110", V: "10001,10001,10001,10001,10001,01010,00100",
  W: "10001,10001,10001,10101,10101,10101,01010", X: "10001,10001,01010,00100,01010,10001,10001",
  Y: "10001,10001,01010,00100,00100,00100,00100", Z: "11111,00001,00010,00100,01000,10000,11111",
  "0": "01110,10001,10011,10101,11001,10001,01110", "1": "00100,01100,00100,00100,00100,00100,01110",
  "2": "01110,10001,00001,00010,00100,01000,11111", "3": "11111,00010,00100,00010,00001,10001,01110",
  "4": "00010,00110,01010,10010,11111,00010,00010", "5": "11111,10000,11110,00001,00001,10001,01110",
  "6": "00110,01000,10000,11110,10001,10001,01110", "7": "11111,00001,00010,00100,01000,01000,01000",
  "8": "01110,10001,10001,01110,10001,10001,01110", "9": "01110,10001,10001,01111,00001,00010,01100",
  "-": "00000,00000,00000,11111,00000,00000,00000", ".": "00000,00000,00000,00000,00000,01100,01100",
  "/": "00001,00010,00010,00100,01000,01000,10000", ":": "00000,01100,01100,00000,01100,01100,00000",
  "+": "00000,00100,00100,11111,00100,00100,00000", "*": "00000,10101,01110,11111,01110,10101,00000",
  "#": "01010,11111,01010,01010,01010,11111,01010", ">": "10000,01000,00100,00010,00100,01000,10000",
  "<": "00001,00010,00100,01000,00100,00010,00001", "[": "01110,01000,01000,01000,01000,01000,01110",
  "]": "01110,00010,00010,00010,00010,00010,01110", "_": "00000,00000,00000,00000,00000,00000,11111",
  "=": "00000,00000,11111,00000,11111,00000,00000", "?": "01110,10001,00001,00010,00100,00000,00100",
  "!": "00100,00100,00100,00100,00100,00000,00100", "@": "01110,10001,10111,10101,10111,10000,01111",
  "%": "11001,11010,00010,00100,01000,01011,10011", " ": "00000,00000,00000,00000,00000,00000,00000",
};

/** Text drawn as 5×7 pixel cells: font-independent, ideal for PNG export. */
export function pixelText(o: { text: string; cell?: number; gap?: number; color?: string; palette?: PaletteInput; round?: boolean }): Decal {
  const c = o.cell ?? 6, g = o.gap ?? 0, col = o.color ?? pal(o.palette).fg;
  const chars = o.text.toUpperCase().split("");
  let body = "";
  chars.forEach((ch, i) => {
    const rows = (PIX[ch] ?? PIX["?"]).split(",");
    rows.forEach((row, y) => row.split("").forEach((bit, x) => {
      if (bit === "1") body += rect((i * 6 + x) * c, y * c, c - g, c - g, col, o.round ? `rx="${n(c * 0.3)}"` : "");
    }));
  });
  return { kind: "pixelText", w: Math.max(1, chars.length * 6 - 1) * c, h: 7 * c, body: `<g shape-rendering="crispEdges">${body}</g>` };
}

const SEG: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  A: "abcefg", B: "cdefg", C: "adef", D: "bcdeg", E: "adefg", F: "aefg", H: "bcefg", L: "def", O: "abcdef", P: "abefg", R: "eg", S: "afgcd", T: "defg", U: "bcdef", "-": "g", " ": "",
};

/** Seven-segment numerals/letters with chamfered bars (big "1234567890" style). */
export function segmentText(o: { text: string; height?: number; color?: string; palette?: PaletteInput; slant?: number; dim?: string }): Decal {
  const H = o.height ?? 100, W = H * 0.55, t = H * 0.12, gap = H * 0.18, col = o.color ?? pal(o.palette).fg;
  const hb = (x: number, y: number) => [[x + t * 0.5, y], [x + W - t * 0.5, y], [x + W, y + t * 0.5], [x + W - t * 0.5, y + t], [x + t * 0.5, y + t], [x, y + t * 0.5]];
  const vb = (x: number, y: number, len: number) => [[x + t * 0.5, y], [x + t, y + t * 0.5], [x + t, y + len - t * 0.5], [x + t * 0.5, y + len], [x, y + len - t * 0.5], [x, y + t * 0.5]];
  const half = (H - t) / 2;
  const shapes: Record<string, (x: number) => number[][]> = {
    a: x => hb(x, 0), g: x => hb(x, half), d: x => hb(x, H - t),
    f: x => vb(x - t * 0.15, t * 0.5, half), b: x => vb(x + W - t * 0.85, t * 0.5, half),
    e: x => vb(x - t * 0.15, half + t * 0.5, half), c: x => vb(x + W - t * 0.85, half + t * 0.5, half),
  };
  let body = "";
  const chars = o.text.toUpperCase().split("");
  chars.forEach((ch, i) => {
    const x = i * (W + gap);
    const on = SEG[ch] ?? "g";
    for (const s of "abcdefg") {
      if (on.includes(s)) body += poly(shapes[s](x), col);
      else if (o.dim) body += poly(shapes[s](x), o.dim);
    }
  });
  const w = chars.length * (W + gap) - gap;
  const sk = o.slant ?? 0;
  return { kind: "segmentText", w: w + Math.abs(sk) * H, h: H, body: sk ? `<g transform="translate(${n(Math.max(0, sk) * H)} 0) skewX(${n(-Math.atan(sk) * 180 / Math.PI)})">${body}</g>` : body };
}

/* ============================== symbols ============================== */

interface Base { seed?: number | string; palette?: PaletteInput }

/** Letter-like emblem cut out of a disc or tile (glyph-sheet style). */
export function glyphDisc(o: Base & { shape?: "circle" | "square" | "round"; tile?: boolean; size?: number } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), S = o.size ?? 100;
  const shape = o.shape ?? r.pick(["circle", "circle", "circle", "round", "square"] as const);
  const disc = o.tile ? p.bg : p.fg, ink = o.tile ? p.fg : p.bg;
  const id = uid("clip");
  const u = S / 100;
  const x0 = r.int(18, 28) * u, x1 = r.int(72, 82) * u, y0 = r.int(26, 42) * u, y1 = r.int(74, 86) * u;
  const rad = r.pick([0, 0, 4, 8]) * u;
  let letter = rect(x0, y0, x1 - x0, y1 - y0, ink, rad ? `rx="${rad}"` : "");
  const sw = r.int(16, 22) * u;
  const stems = ["ascL", "ascR", "descL", "descR", "barTop", "none"] as const;
  const picks = new Set([r.pick(stems), r.chance(0.4) ? r.pick(stems) : "none"]);
  if (picks.has("ascL")) letter += rect(x0, 0, sw, y0 + 1, ink);
  if (picks.has("ascR")) letter += rect(x1 - sw, 0, sw, y0 + 1, ink);
  if (picks.has("descL")) letter += rect(x0, y1 - 1, sw, S - y1 + 1, ink);
  if (picks.has("descR")) letter += rect(x1 - sw, y1 - 1, sw, S - y1 + 1, ink);
  if (picks.has("barTop")) letter += rect(x0 + sw * 0.5, y0 - r.int(10, 16) * u, x1 - x0 - sw, r.int(6, 9) * u, ink);
  // counter (hole)
  const hw = r.int(14, 24) * u, hh = r.int(9, 18) * u;
  const hx = (x0 + x1) / 2 - hw / 2 + r.pick([0, 0, -6, 6]) * u, hy = y0 + (y1 - y0) * r.pick([0.5, 0.42, 0.6]) - hh / 2;
  letter += rect(hx, hy, hw, hh, disc);
  // notch or chamfer
  if (r.chance(0.45)) letter += rect(r.chance(0.5) ? x0 - 1 : x1 - r.int(10, 18) * u + 1, (y0 + y1) / 2 - 4 * u, r.int(10, 18) * u, 8 * u, disc);
  if (r.chance(0.35)) letter += poly([[x0 - 1, y0 - 1], [x0 + r.int(10, 18) * u, y0 - 1], [x0 - 1, y0 + r.int(10, 18) * u]], disc);
  const clipShape = shape === "circle" ? `<circle cx="${S / 2}" cy="${S / 2}" r="${S * 0.48}"/>`
    : `<rect x="${S * 0.02}" y="${S * 0.02}" width="${S * 0.96}" height="${S * 0.96}" rx="${shape === "round" ? S * 0.16 : 0}"/>`;
  const tile = o.tile ? rect(0, 0, S, S, p.fg) : "";
  return {
    kind: "glyphDisc", w: S, h: S,
    body: `${tile}<clipPath id="${id}">${clipShape}</clipPath><g clip-path="url(#${id})">${rect(0, 0, S, S, disc)}${letter}</g>`,
  };
}

/** Staircase pixel arrow (medic decal style). */
export function pixelArrow(o: Base & { dir?: "up" | "down" | "left" | "right" | "upRight"; cell?: number; length?: number; head?: number; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), c = o.cell ?? 10, len = o.length ?? r.int(8, 12), head = o.head ?? r.int(3, 5);
  const col = o.color ?? pal(o.palette).fg;
  const W = (head * 2 + 1) * c, H = len * c;
  let b = rect(head * c, 0, c, H, col);
  for (let k = 1; k <= head; k++) { b += rect((head - k) * c, k * c, c, c, col); b += rect((head + k) * c, k * c, c, c, col); }
  const dir = o.dir ?? r.pick(["up", "down", "left", "right"] as const);
  const rot = { up: 0, right: 90, down: 180, left: 270, upRight: 45 }[dir];
  const swap = rot === 90 || rot === 270;
  const w = swap ? H : W, h = swap ? W : H;
  if (dir === "upRight") {
    const d = Math.ceil(Math.hypot(W, H));
    return { kind: "pixelArrow", w: d, h: d, body: `<g transform="translate(${d / 2} ${d / 2}) rotate(45) translate(${-W / 2} ${-H / 2})">${b}</g>` };
  }
  return { kind: "pixelArrow", w, h, body: `<g transform="translate(${w / 2} ${h / 2}) rotate(${rot}) translate(${-W / 2} ${-H / 2})">${b}</g>` };
}

/** Run of chevrons / triangles: ▶▶▶ or >>> */
export function chevrons(o: Base & { count?: number; style?: "solid" | "line" | "half"; size?: number; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), k = o.count ?? r.int(3, 5), s = o.size ?? 40, col = o.color ?? pal(o.palette).fg;
  const style = o.style ?? r.pick(["solid", "line", "half"] as const);
  let b = "";
  for (let i = 0; i < k; i++) {
    const x = i * s * 0.62;
    if (style === "solid") b += poly([[x, 0], [x + s * 0.55, s / 2], [x, s]], col);
    else if (style === "half") b += poly([[x, 0], [x + s * 0.55, s / 2], [x, s / 2]], col) + poly([[x, s / 2], [x + s * 0.55, s / 2], [x, s]], col + "88");
    else b += poly([[x, 0], [x + s * 0.18, 0], [x + s * 0.62, s / 2], [x + s * 0.18, s], [x, s], [x + s * 0.44, s / 2]], col);
  }
  return { kind: "chevrons", w: (k - 1) * s * 0.62 + s * 0.62, h: s, body: b };
}

/** Barcode with optional human-readable digits. */
export function barcode(o: Base & { bars?: number; height?: number; digits?: boolean | string; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), bars = o.bars ?? r.int(28, 44), H = o.height ?? 40, col = o.color ?? pal(o.palette).fg;
  let x = 0, b = "";
  for (let i = 0; i < bars; i++) { const w = r.pick([1, 1, 2, 3]); if (i % 2 === 0) b += rect(x, 0, w, H, col); x += w; }
  const label = typeof o.digits === "string" ? o.digits : o.digits ? `${r.int(100, 999)} ${r.int(1000, 9999)} ${r.int(10, 99)}` : "";
  if (label) b += text(x / 2, H + 9, label, { size: 8, fill: col, anchor: "middle", width: x * 0.9 });
  return { kind: "barcode", w: x, h: label ? H + 11 : H, body: b };
}

/** Diagonal hazard stripes block. */
export function stripes(o: Base & { w?: number; h?: number; band?: number; angle?: number; color?: string; ground?: string } = {}): Decal {
  const p = pal(o.palette), W = o.w ?? 240, H = o.h ?? 60, band = o.band ?? 14, col = o.color ?? p.fg, id = uid("st");
  const a = o.angle ?? -45;
  return {
    kind: "stripes", w: W, h: H,
    body: `<pattern id="${id}" width="${band * 2}" height="${band * 2}" patternUnits="userSpaceOnUse" patternTransform="rotate(${a})">${o.ground ? rect(0, 0, band * 2, band * 2, o.ground) : ""}${rect(0, 0, band, band * 2, col)}</pattern>${rect(0, 0, W, H, `url(#${id})`)}`,
  };
}

/** Flat or globe-warped checkerboard. */
export function checker(o: Base & { cols?: number; rows?: number; cell?: number; globe?: boolean; color?: string } = {}): Decal {
  const p = pal(o.palette), cols = o.cols ?? 12, rows = o.rows ?? 8, c = o.cell ?? 16, col = o.color ?? p.fg;
  const W = cols * c, H = rows * c;
  const warp = (i: number, k: number, size: number) => o.globe ? (Math.sin(-Math.PI / 2 + Math.PI * i / k) + 1) / 2 * size : i / k * size;
  let b = "";
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if ((i + j) % 2) continue;
    const x0 = warp(i, cols, W), x1 = warp(i + 1, cols, W), y0 = warp(j, rows, H), y1 = warp(j + 1, rows, H);
    b += rect(x0, y0, x1 - x0, y1 - y0, col);
  }
  if (o.globe) { const id = uid("gl"); b = `<clipPath id="${id}"><ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}"/></clipPath><g clip-path="url(#${id})">${b}</g>`; }
  else b = `<g shape-rendering="crispEdges">${b}</g>`;
  return { kind: "checker", w: W, h: H, body: b };
}

/** Dithered noise block fading left→right (glitch / data-corruption strip). */
export function dither(o: Base & { w?: number; h?: number; cell?: number; color?: string; fade?: "right" | "left" | "none" } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), W = o.w ?? 240, H = o.h ?? 80, c = o.cell ?? 4, col = o.color ?? p.fg;
  const fade = o.fade ?? "right";
  let b = "";
  for (let x = 0; x < W; x += c) for (let y = 0; y < H; y += c) {
    const t = fade === "none" ? 0.5 : fade === "right" ? 1 - x / W : x / W;
    if (r.next() < t * 0.9 + 0.05) b += rect(x, y, c, c, col);
  }
  return { kind: "dither", w: W, h: H, body: `<g shape-rendering="crispEdges">${b}</g>` };
}

/** Crosshairs, targets and registration marks. */
export function reticle(o: Base & { variant?: "plus" | "crossCircle" | "target" | "tickRing" | "register" | "pip"; size?: number; color?: string; stroke?: number } = {}): Decal {
  const r = rng(o.seed ?? 1), S = o.size ?? 100, col = o.color ?? pal(o.palette).fg, sw = o.stroke ?? S * 0.04, c = S / 2;
  const v = o.variant ?? r.pick(["plus", "crossCircle", "target", "tickRing", "register", "pip"] as const);
  const line = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${col}" stroke-width="${n(sw)}"/>`;
  const circ = (rr: number, fill = "none") => `<circle cx="${c}" cy="${c}" r="${n(rr)}" fill="${fill}" stroke="${fill === "none" ? col : "none"}" stroke-width="${n(sw)}"/>`;
  let b = "";
  if (v === "plus") b = line(c, 0, c, S) + line(0, c, S, c);
  if (v === "crossCircle") b = circ(S * 0.3) + line(c, 0, c, S) + line(0, c, S, c);
  if (v === "target") b = circ(S * 0.46) + circ(S * 0.28) + circ(S * 0.1, col);
  if (v === "tickRing") b = circ(S * 0.3) + line(c, 0, c, S * 0.14) + line(c, S * 0.86, c, S) + line(0, c, S * 0.14, c) + line(S * 0.86, c, S, c) + circ(S * 0.04, col);
  if (v === "register") b = circ(S * 0.22) + line(c, S * 0.08, c, S * 0.92) + line(S * 0.08, c, S * 0.92, c);
  if (v === "pip") b = circ(S * 0.14, col) + line(c, 0, c, S * 0.3) + line(c, S * 0.7, c, S) + line(0, c, S * 0.3, c) + line(S * 0.7, c, S, c);
  return { kind: "reticle", w: S, h: S, body: b };
}

/** Dot / plus / x matrix (perforation panels). */
export function dotMatrix(o: Base & { cols?: number; rows?: number; pitch?: number; mark?: "dot" | "square" | "plus" | "x"; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), cols = o.cols ?? r.int(8, 16), rows = o.rows ?? r.int(3, 6), pt = o.pitch ?? 14, col = o.color ?? pal(o.palette).fg;
  const mark = o.mark ?? r.pick(["dot", "square", "plus", "x"] as const);
  let b = "";
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * pt + pt / 2, y = j * pt + pt / 2, s = pt * 0.32;
    if (mark === "dot") b += `<circle cx="${x}" cy="${y}" r="${n(s)}" fill="${col}"/>`;
    if (mark === "square") b += rect(x - s, y - s, s * 2, s * 2, col, `rx="${n(s * 0.35)}"`);
    if (mark === "plus") b += rect(x - s, y - 0.75, s * 2, 1.5, col) + rect(x - 0.75, y - s, 1.5, s * 2, col);
    if (mark === "x") b += `<path d="M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}" stroke="${col}" stroke-width="1.5"/>`;
  }
  return { kind: "dotMatrix", w: cols * pt, h: rows * pt, body: b };
}

/** Pixel monogram from a mirrored random grid. */
export function blockMark(o: Base & { grid?: number; cell?: number; round?: boolean; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), g = o.grid ?? r.int(4, 6), c = o.cell ?? 14, col = o.color ?? pal(o.palette).fg;
  let b = "";
  const half = Math.ceil(g / 2);
  for (let y = 0; y < g; y++) for (let x = 0; x < half; x++) {
    if (!r.chance(0.55)) continue;
    const ext = o.round ? `rx="${n(c * 0.28)}"` : "";
    b += rect(x * c, y * c, c, c, col, ext);
    if (g - 1 - x !== x) b += rect((g - 1 - x) * c, y * c, c, c, col, ext);
  }
  // Square cells snap to the pixel grid so neighbours don't leave anti-aliased seams (matters for masks).
  return { kind: "blockMark", w: g * c, h: g * c, body: o.round ? b : `<g shape-rendering="crispEdges">${b}</g>` };
}

/** Corner-bracket frame, optionally around another decal. */
export function bracketFrame(o: Base & { w?: number; h?: number; arm?: number; inner?: Decal; color?: string; stroke?: number } = {}): Decal {
  const W = o.w ?? 160, H = o.h ?? 120, a = o.arm ?? Math.min(W, H) * 0.18, col = o.color ?? pal(o.palette).fg, s = o.stroke ?? 3;
  const d = `M0 ${a}V0H${a}M${W - a} 0H${W}V${a}M${W} ${H - a}V${H}H${W - a}M${a} ${H}H0V${H - a}`;
  const inner = o.inner ? place(o.inner, W * 0.18, H * 0.18, W * 0.64, H * 0.64) : "";
  return { kind: "bracketFrame", w: W, h: H, body: `<path d="${d}" fill="none" stroke="${col}" stroke-width="${s}" stroke-linecap="square"/>${inner}` };
}

/** Tick ruler with R- / R+ ends. */
export function ruler(o: Base & { w?: number; ticks?: number; color?: string; labels?: [string, string] } = {}): Decal {
  const W = o.w ?? 240, t = o.ticks ?? 12, col = o.color ?? pal(o.palette).fg, [l0, l1] = o.labels ?? ["R-", "R+"];
  let b = rect(0, 10, W, 2, col);
  for (let i = 0; i <= t; i++) { const x = (W - 2) * i / t; b += rect(x, i % 4 === 0 ? 0 : 5, 2, i % 4 === 0 ? 16 : 7, col); }
  b += rect(W * 0.42, 14, W * 0.16, 7, "none", `stroke="${col}" stroke-width="1.5"`);
  b += text(0, 32, l0, { size: 11, fill: col, weight: 700 }) + text(W, 32, l1, { size: 11, fill: col, weight: 700, anchor: "end" });
  return { kind: "ruler", w: W, h: 34, body: b };
}

/** Flat utility icons from the prop/decal atlases. */
export const ICONS = ["drop", "bowtie", "dShape", "square", "circle", "ring", "pill", "roundRect", "plusSquare", "xSquare", "triangleUp", "triangleDown", "arrowUp", "arrowDown", "peanut", "splitDiamond", "brackets", "bolt", "hazard", "asterisk", "steps", "tab", "keyhole", "hexNut"] as const;
export type IconName = typeof ICONS[number];

export function icon(o: Base & { name?: IconName; size?: number; color?: string; ground?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), S = o.size ?? 100, c = o.color ?? p.fg, g = o.ground ?? p.bg;
  const name = o.name ?? r.pick(ICONS);
  const sw = S * 0.07, st = `fill="none" stroke="${c}" stroke-width="${n(sw)}"`;
  const P = (d: string, extra = `fill="${c}"`) => `<path d="${d}" ${extra}/>`;
  const k = S / 100;
  // Scale path numbers, except arc rotation and flags (A rx ry ROT LARGE SWEEP x y).
  const sc = (d: string) => d.replace(/([A-Za-z])([^A-Za-z]*)/g, (_, cmd: string, args: string) => {
    let i = 0;
    return cmd + args.replace(/-?\d+(\.\d+)?/g, m => { const keep = /a/i.test(cmd) && [2, 3, 4].includes(i++ % 7); return keep ? m : String(n(+m * k)); });
  });
  const b: Record<IconName, () => string> = {
    drop: () => P(sc("M50 6C50 6 18 46 18 66a32 32 0 0 0 64 0C82 46 50 6 50 6Z")),
    bowtie: () => P(sc("M8 10L50 50L8 90ZM92 10L50 50L92 90Z")),
    dShape: () => P(sc("M10 14H50a36 36 0 0 1 0 72H10Z")) + P(sc("M48 20V80M14 50H86"), `stroke="${g}" stroke-width="${n(4 * k)}"`),
    square: () => rect(12 * k, 12 * k, 76 * k, 76 * k, "none", st),
    circle: () => `<circle cx="${S / 2}" cy="${S / 2}" r="${n(38 * k)}" ${st}/>`,
    ring: () => `<circle cx="${S / 2}" cy="${S / 2}" r="${n(32 * k)}" fill="none" stroke="${c}" stroke-width="${n(22 * k)}"/>`,
    pill: () => rect(8 * k, 34 * k, 84 * k, 32 * k, c, `rx="${n(16 * k)}"`),
    roundRect: () => rect(10 * k, 22 * k, 80 * k, 56 * k, "none", `${st} rx="${n(14 * k)}"`),
    plusSquare: () => rect(10 * k, 10 * k, 80 * k, 80 * k, c) + rect(46 * k, 26 * k, 8 * k, 48 * k, g) + rect(26 * k, 46 * k, 48 * k, 8 * k, g),
    xSquare: () => rect(10 * k, 10 * k, 80 * k, 80 * k, c) + P(sc("M28 28L72 72M72 28L28 72"), `stroke="${g}" stroke-width="${n(6 * k)}"`),
    triangleUp: () => P(sc("M50 18L90 82H10Z")),
    triangleDown: () => P(sc("M10 18H90L50 82Z")),
    arrowUp: () => P(sc("M50 6L84 42H62V94H38V42H16Z")),
    arrowDown: () => P(sc("M38 6H62V58H84L50 94L16 58H38Z")),
    peanut: () => `<circle cx="${S / 2}" cy="${n(30 * k)}" r="${n(22 * k)}" fill="${c}"/><circle cx="${S / 2}" cy="${n(70 * k)}" r="${n(22 * k)}" fill="${c}"/>` + rect(36 * k, 30 * k, 28 * k, 40 * k, c),
    splitDiamond: () => rect(14 * k, 22 * k, 72 * k, 56 * k, "none", st) + P(sc("M20 50L42 32V68ZM80 50L58 32V68Z")),
    brackets: () => P(sc("M30 14H14V86H30M70 14H86V86H70"), st),
    bolt: () => P(sc("M58 4L22 56H46L38 96L78 40H54Z")),
    hazard: () => P(sc("M50 10L92 86H8Z"), `fill="none" stroke="${c}" stroke-width="${n(6 * k)}" stroke-linejoin="round"`) + rect(47 * k, 36 * k, 6 * k, 26 * k, c) + rect(47 * k, 68 * k, 6 * k, 6 * k, c),
    asterisk: () => [0, 60, 120].map(a => `<rect x="${n(44 * k)}" y="${n(8 * k)}" width="${n(12 * k)}" height="${n(84 * k)}" fill="${c}" transform="rotate(${a} ${S / 2} ${S / 2})"/>`).join(""),
    steps: () => [0, 1, 2, 3].map(i => rect((10 + i * 20) * k, (70 - i * 20) * k, 20 * k, 20 * k, c)).join(""),
    tab: () => P(sc("M10 30H62a10 10 0 0 0 10-10V10H90V90H10Z"), st),
    keyhole: () => `<circle cx="${S / 2}" cy="${n(38 * k)}" r="${n(18 * k)}" fill="${c}"/>` + P(sc("M42 44H58L64 86H36Z")),
    hexNut: () => P(sc("M50 6L88 28V72L50 94L12 72V28Z")) + `<circle cx="${S / 2}" cy="${S / 2}" r="${n(18 * k)}" fill="${g}"/>`,
  };
  return { kind: "icon", w: S, h: S, body: b[name]() };
}

/** Boxed code chips: big code in a box (B7), split box (CL x2214 | RN), number over label (5 / CRR). */
export function codeBox(o: Base & { variant?: "big" | "split" | "stack"; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), c = o.color ?? p.fg, v = o.variant ?? r.pick(["big", "split", "stack"] as const);
  if (v === "big") {
    const t = codes.short(r);
    return { kind: "codeBox", w: 110, h: 110, body: rect(0, 0, 110, 110, c) + text(55, 82, t, { size: 70, fill: onColor(c), font: "grotesk", weight: 800, anchor: "middle", width: Math.min(96, textW(t, 70, "grotesk")) }) };
  }
  if (v === "split") {
    const a = `${str(r, L, 2)} x${r.int(1000, 9999)}`, b2 = str(r, L, 2);
    return { kind: "codeBox", w: 150, h: 64, body: rect(1, 1, 148, 62, "none", `stroke="${c}" stroke-width="2"`) + rect(0, 31, 150, 2, c) + text(8, 25, a, { size: 18, fill: c, width: textW(a, 18) }) + text(8, 56, b2, { size: 18, fill: c }) };
  }
  const num = String(r.int(1, 9)), lab = str(r, L, 3);
  return { kind: "codeBox", w: 76, h: 112, body: rect(1.5, 1.5, 73, 109, "none", `stroke="${c}" stroke-width="3"`) + text(10, 64, num, { size: 58, fill: c, font: "grotesk", weight: 800 }) + rect(0, 76, 76, 3, c) + text(38, 104, lab, { size: 22, fill: c, font: "grotesk", weight: 800, anchor: "middle" }) };
}

/** Rough painted tape strip (masking-tape / spray-paint bar). */
export function tape(o: Base & { w?: number; h?: number; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), W = o.w ?? 360, H = o.h ?? 56, c = o.color ?? r.pick(pal(o.palette).accents);
  // Edges are random walks, so long strips read as brushed rather than serrated.
  const pts: number[][] = [], dy = Math.max(4, H * 0.1), dx = Math.max(5, H * 0.14);
  let e = dy / 2;
  const walk = (max: number) => (e = Math.min(max, Math.max(0, e + (r.next() - 0.5) * max * 0.5)));
  for (let x = 0; x <= W; x += 10) pts.push([x, walk(dy)]);
  for (let y = 0; y <= H; y += 6) pts.push([W - walk(dx), y]);
  for (let x = W; x >= 0; x -= 10) pts.push([x, H - walk(dy)]);
  for (let y = H; y >= 0; y -= 6) pts.push([walk(dx), y]);
  return { kind: "tape", w: W, h: H, body: poly(pts, c) };
}

/* ============================== labels & typography ============================== */

/** Lines of serial / lot / part codes. */
export function serialBlock(o: Base & { lines?: number; size?: number; color?: string; style?: keyof typeof codes } = {}): Decal {
  const r = rng(o.seed ?? 1), k = o.lines ?? r.int(2, 4), s = o.size ?? 14, col = o.color ?? pal(o.palette).fg;
  const style = o.style ?? r.pick(["hexRow", "part", "serial", "mixed", "tracking"] as const);
  const lines = Array.from({ length: k }, () => codes[style](r));
  const w = Math.max(...lines.map(l => textW(l, s)));
  return { kind: "serialBlock", w, h: k * s * 1.25, body: lines.map((l, i) => text(0, (i + 1) * s * 1.25 - s * 0.25, l, { size: s, fill: col, width: textW(l, s) })).join("") };
}

/** Material spec table with header rule and a footer division mark. */
export function specTable(o: Base & { rows?: number; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), col = o.color ?? p.fg, k = o.rows ?? r.int(4, 6), W = 260, lh = 13;
  const mat = r.pick(MATERIALS);
  const rows = [...PROPS].sort(() => r.next() - 0.5).slice(0, k);
  let b = rect(0.5, 0.5, W - 1, (k + 3) * lh + 14, "none", `stroke="${col}" stroke-width="1"`);
  b += text(6, 13, "Property", { size: 10, fill: col }) + text(122, 13, "Unit", { size: 10, fill: col }) + text(182, 13, mat, { size: 10, fill: col });
  b += rect(0, 18, W, 1, col);
  rows.forEach(([prop, unit], i) => {
    const y = 18 + (i + 1) * lh;
    b += text(6, y, prop, { size: 8.5, fill: col, font: "grotesk" }) + text(122, y, unit, { size: 8.5, fill: col, font: "grotesk" });
    b += text(182, y, `${(r.next() * 900).toFixed(2)}`, { size: 8.5, fill: col, font: "grotesk" }) + text(226, y, `±${(r.next() * 9).toFixed(1)}`, { size: 8.5, fill: col, font: "grotesk" });
  });
  const fy = 18 + (k + 1) * lh + 6;
  b += rect(0, fy - 4, W, 1, col);
  b += place(blockMark({ seed: r.int(1, 1e6), grid: 4, color: col }), 6, fy, 16, 16);
  b += text(W - 6, fy + 13, corpName(r, true), { size: 8.5, fill: col, anchor: "end" });
  return { kind: "specTable", w: W, h: fy + 20, body: b };
}

/** NOTICE / WARNING block with hazard triangle. */
export function warningLabel(o: Base & { kind?: "NOTICE" | "WARNING" | "CAUTION"; color?: string; icon?: boolean } = {}): Decal {
  const r = rng(o.seed ?? 1), col = o.color ?? pal(o.palette).fg, kind = o.kind ?? r.pick(["NOTICE", "WARNING", "CAUTION"] as const);
  const lines = [...r.pick(NOTICES)];
  lines[0] = `${kind}: ${lines[0]}`;
  const s = 11, icon = o.icon ?? r.chance(0.5), ox = icon ? 40 : 0;
  let b = icon ? poly([[16, 2], [32, 30], [0, 30]], "none").replace('fill="none"', `fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"`) + rect(14.75, 11, 2.5, 10, col) + rect(14.75, 23.5, 2.5, 2.5, col) : "";
  const w = Math.max(...lines.map(l => textW(l, s)));
  lines.forEach((l, i) => { b += text(ox, (i + 1) * s * 1.3, l, { size: s, fill: col, width: textW(l, s) }); });
  return { kind: "warningLabel", w: ox + w, h: lines.length * s * 1.3 + 4, body: b };
}

/** Repeating word band: SEAL - SEAL - SEAL / LINK LINK LINK / ATTACH HERE */
export function repeatBand(o: Base & { word?: string; sep?: string; w?: number; h?: number; fill?: string; color?: string; sepColor?: string; pill?: boolean; mark?: boolean; weight?: number } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette);
  const word = (o.word ?? r.pick(WORDS)).toUpperCase(), sep = o.sep ?? r.pick(["-", " ", " / ", " · "]);
  const W = o.w ?? 600, H = o.h ?? 56, fill = o.fill ?? r.pick(p.accents), col = o.color ?? onColor(fill);
  const s = H * 0.72, unit = word + sep, uw = textW(unit, s), reps = Math.ceil(W / uw) + 1;
  const id = uid("band");
  let row = "";
  for (let i = 0; i < reps; i++) {
    const x = i * uw;
    row += text(x, H * 0.76, (o.mark ? "▪" : "") + word, { size: s, fill: col, weight: o.weight, width: textW((o.mark ? "▪" : "") + word, s) });
    if (sep.trim()) row += text(x + textW(word, s), H * 0.76, sep, { size: s, fill: o.sepColor ?? col, weight: o.weight, width: textW(sep, s) });
  }
  const shape = o.pill ? `rx="${H / 2}"` : "";
  return { kind: "repeatBand", w: W, h: H, body: `<clipPath id="${id}"><rect width="${W}" height="${H}" ${shape}/></clipPath>${rect(0, 0, W, H, fill, shape)}<g clip-path="url(#${id})">${row}</g>` };
}

/** Rounded status pill: dot + arrow + date code (or code + end dot). */
export function pillTag(o: Base & { code?: string; fill?: string; dot?: string; arrow?: boolean; end?: "left" | "right"; w?: number } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette);
  // Default to the palette's first saturated accent (safety orange on hazard/lab); mono palettes get a plain pill.
  const hues = p.accents.filter(saturated);
  const W = o.w ?? 300, H = 64, fill = o.fill ?? hues[0] ?? p.fg;
  const dot = o.dot ?? (hues.length > 1 ? r.pick(hues.slice(1)) : p.bg), ink = onColor(fill);
  const code = o.code ?? (r.chance(0.5) ? codes.stamp(r) : `${r.int(1, 99).toString().padStart(3, "0")}.${str(r, L, 1)}`);
  const left = (o.end ?? (r.chance(0.5) ? "left" : "right")) === "left";
  let b = rect(0, 0, W, H, fill, `rx="${H / 2}"`);
  b += `<circle cx="${left ? H / 2 : W - H / 2}" cy="${H / 2}" r="${H / 2 - 2}" fill="${dot}"/>`;
  const tx = left ? H + 10 : 24;
  if (o.arrow ?? left) b += `<path d="M${tx} ${H * 0.3}V${H * 0.7}M${tx} ${H / 2}H${tx + 30}M${tx + 18} ${H * 0.3}L${tx + 30} ${H / 2}L${tx + 18} ${H * 0.7}" stroke="${ink}" stroke-width="3.5" fill="none"/>`;
  b += text(left ? tx + 46 : W - H - 12, H * 0.68, code, { size: H * 0.5, fill: ink, font: "mono", weight: 600, anchor: left ? "start" : "end" });
  return { kind: "pillTag", w: W, h: H, body: b };
}

/** Stacked badge: model code over a big two-line word, in a colored square. */
export function stackBadge(o: Base & { lines?: string[]; fill?: string; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), S = 100;
  const name = corpName(r);
  const lines = o.lines ?? [codes.model(r), name.slice(0, Math.ceil(name.length / 2)), name.slice(Math.ceil(name.length / 2))];
  const fill = o.fill ?? r.pick(p.accents), col = o.color ?? onColor(fill);
  let b = rect(0, 0, S, S, fill);
  b += text(8, 20, lines[0], { size: 13, fill: col, weight: 700, width: Math.min(84, textW(lines[0], 13)) });
  for (const [i, l] of [lines[1] ?? "", lines[2] ?? ""].entries()) b += text(8, 56 + i * 34, l, { size: 34, fill: col, weight: 800, font: "display", width: Math.min(84, textW(l, 34, "display")) });
  return { kind: "stackBadge", w: S, h: S, body: b };
}

/** Big wordmark lockup with stamp, spec columns, vertical codes and ruler (UESC-banner style). */
export function lockup(o: Base & { text?: string; stamp?: string; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), col = o.color ?? pal(o.palette).fg, W = 1000, H = 250;
  const word = (o.text ?? corpName(r).slice(0, 4)).toUpperCase();
  const stamp = o.stamp ?? `${word} Rc. ${codes.date(r)}`;
  let b = reticle({ variant: "plus", size: 46, color: col, stroke: 2 }).body.replace(/^/, `<g transform="translate(148 18)">`) + "</g>";
  b += text(196, 48, stamp, { size: 22, fill: col, font: "grotesk", weight: 600 });
  b += text(560, 205, word, { size: 190, fill: col, font: "display", weight: 800, anchor: "middle", width: 520 });
  const left = [`${str(r, L, 2)}-${r.int(1000, 9999)}  UNT-${r.int(1, 9)}`, `${str(r, L, 3)}-${r.int(1000, 9999)}/${r.int(100, 999)}`, `${word} BASE UNIT™`];
  left.forEach((l, i) => { b += `<g transform="translate(${70 + i * 18} 220) rotate(-90)">${text(0, 0, l, { size: 14, fill: col, font: "mono", width: textW(l, 14) })}</g>`; });
  for (let i = 0; i < 7; i++) {
    const l = `${str(r, L, 2)} - ${r.int(100, 99999)}`, m = r.chance(0.6) ? `${r.pick(["UNIT", "NTE", "MGE"])} -${r.int(1, 9)}` : "";
    b += text(845, 64 + i * 20 + (i > 2 ? 12 : 0), l, { size: 12, fill: col, font: "grotesk", weight: 600 }) + text(930, 64 + i * 20 + (i > 2 ? 12 : 0), m, { size: 12, fill: col, font: "grotesk", weight: 600 });
  }
  b += `<g transform="translate(815 192)">${reticle({ variant: "plus", size: 44, color: col, stroke: 2 }).body}</g>`;
  b += place(ruler({ w: 240, color: col }), 440, 212, 240, 34);
  return { kind: "lockup", w: W, h: H, body: b };
}

/* ============================== thin codes, big type, hardware ============================== */

const LOW = "abcdeqr";

/** Thin grotesk codes from the prop sheets: + Sbr130 **+, (·)( Sb 021a821), Mq EXC —, 023/820/320 stacks, R 0001 -02Q 000 R. */
export function thinCode(o: Base & { variant?: "line" | "bracket" | "overbar" | "stack" | "range"; text?: string; size?: number; color?: string; weight?: number } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), s = o.size ?? 64, wt = o.weight ?? 300;
  const v = o.variant ?? r.pick(["line", "line", "bracket", "overbar", "stack", "range"] as const);
  const col = o.color ?? r.pick([p.fg, p.muted]);
  const gw = (t: string) => textW(t, s, "grotesk");
  const T = (x: number, t: string, weight = wt) => text(x, s * 0.8, t, { size: s, fill: col, font: "grotesk", weight, width: gw(t) });
  const mk = (w: number, h: number, body: string): Decal => ({ kind: "thinCode", w, h, body });
  const digits = (k: number) => String(r.int(0, 10 ** k - 1)).padStart(k, "0");
  if (v === "stack") {
    const lines = o.text ? o.text.split("/") : [digits(3), digits(3), digits(3)];
    const w = Math.max(...lines.map(gw));
    return mk(w, lines.length * s * 1.05, lines.map((l, i) => text(w, (i + 0.8) * s * 1.05, l, { size: s, fill: col, font: "grotesk", weight: wt, width: gw(l), anchor: "end" })).join(""));
  }
  if (v === "range") {
    const t = o.text ?? `${digits(4)} -${digits(2)}${str(r, L, 1)} ${digits(3)}`, gap = s * 0.3, rw = gw("R"), tw = gw(t);
    return mk(rw * 2 + tw + gap * 2, s, T(0, "R", 500) + T(rw + gap, t) + T(rw + tw + gap * 2, "R", 500));
  }
  if (v === "bracket") {
    const lab = `${str(r, L, 1)}${str(r, LOW, 1)}`, code = o.text ?? `0${digits(2)}${str(r, LOW, 1)}${digits(3)}`;
    const pre = r.chance(0.4) ? `${r.pick(["≤", "≥"])}${r.int(1, 9)}` : "";
    const P = (x: number, t: string) => text(x, s * 0.8, t, { size: s, fill: col, font: "grotesk", weight: 700, width: s * 0.3 * t.length });
    let x = 0, b = "";
    if (pre) { b += T(0, pre, 500); x += gw(pre) + s * 0.1; }
    b += P(x, "(") + rect(x + s * 0.34, s * 0.4, s * 0.16, s * 0.16, col) + rect(x + s * 0.24, s * 0.5, s * 0.07, s * 0.07, col) + P(x + s * 0.56, ")(");
    x += s * 1.25;
    b += T(x, lab); x += gw(lab) + s * 0.8;
    b += T(x, code); x += gw(code) + s * 0.04;
    return mk(x + s * 0.3, s, b + P(x, ")"));
  }
  if (v === "overbar") {
    const t = o.text ?? `${str(r, L, 1)}${str(r, LOW, 1)} ${str(r, L, 3)}${r.chance(0.5) ? `   ${str(r, L, 2)}` : ""}`;
    const boxed = r.chance(0.35), pd = boxed ? s * 0.2 : 0, tw = gw(t), lead = r.chance(0.4) ? s * 0.9 : 0;
    const ink = boxed ? (contrast(p.muted, p.fg) < 1.5 ? onColor(p.fg) : p.muted) : col;
    const w = lead + tw + s * 1.3 + pd * 2, h = s * 1.2 + pd * 2;
    let b = boxed ? rect(0, 0, w, h, p.fg) : "";
    if (lead) b += rect(pd, pd + s * 0.62, s * 0.5, s * 0.07, ink);
    b += rect(pd + lead + s * 0.04, pd, s * 0.42, s * 0.07, ink);
    b += text(pd + lead, pd + s, t, { size: s, fill: ink, font: "grotesk", weight: wt, width: tw });
    return mk(w, h, b + rect(pd + lead + tw + s * 0.5, pd + s * 0.62, s * 0.6, s * 0.07, ink));
  }
  const gens = [
    () => `${str(r, L, 1)}${str(r, LOW, 2)}${digits(3)}`, // Sbr130
    () => `${digits(2)}${str(r, L, 2)}/.${str(r, L, 1)}`, // 92EE/.S
    () => `${str(r, L, 2)}${r.int(0, 9)}${str(r, L, 1)}${r.int(0, 9)} ${str(r, L, 1)}*${str(r, L, 1)}`, // RO4E3 O*O
    () => `0${digits(2)}${str(r, LOW, 1)}${digits(3)}`, // 021a821
    () => `${str(r, L, 1)} ${r.int(1, 9)}${str(r, L, 2)} -`, // A 5PN -
  ];
  const t = o.text ?? r.pick(gens)();
  const [pre, post] = r.pick<[string, string]>([["", ""], ["", ""], ["+ ", " **+"], ["- ", " -"], ["", " *"]]);
  return mk(gw(pre + t + post), s, T(0, pre + t + post));
}

/** Oversized glyphs: stroke-built M / W / A / N, big grotesk numerals (S8 with underbar), heavy italics (Q4), thin outlines. */
export function bigType(o: Base & { variant?: "stroke" | "numeral" | "italic" | "outline"; text?: string; size?: number; color?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), H = o.size ?? 200;
  const v = o.variant ?? r.pick(["stroke", "numeral", "numeral", "italic", "outline"] as const);
  const col = o.color ?? r.pick([p.fg, p.fg, p.muted]);
  const mk = (w: number, h: number, body: string): Decal => ({ kind: "bigType", w, h, body });
  // Round glyphs overshoot cap height and baseline; keep a little room so the outer <svg> doesn't clip them.
  const mkType = (w: number, h: number, body: string) => mk(w, h + H * 0.08, `<g transform="translate(0 ${n(H * 0.04)})">${body}</g>`);
  if (v === "stroke") {
    // Polylines in unit space; ends overshoot the box and get clipped flat, joins stay mitred.
    const shapes: Record<string, [number, number[][]]> = {
      M: [1.75, [[0, 1.1], [0.27, 0], [0.5, 0.72], [0.73, 0], [1, 1.1]]],
      W: [1.75, [[0, -0.1], [0.27, 1], [0.5, 0.28], [0.73, 1], [1, -0.1]]],
      A: [1.05, [[0, 1.1], [0.5, 0], [1, 1.1]]],
      N: [0.9, [[0, 1.1], [0, 0], [1, 1], [1, -0.1]]],
    };
    const [ratio, pts] = shapes[(o.text ?? r.pick(Object.keys(shapes))).toUpperCase()] ?? shapes.M;
    const W = H * ratio, sw = H * r.pick([0.1, 0.12, 0.15]), id = uid("bt"), xs = (x: number) => sw * 0.7 + x * (W - sw * 1.4);
    return mk(W, H, `<clipPath id="${id}"><rect width="${n(W)}" height="${H}"/></clipPath><polyline clip-path="url(#${id})" points="${pts.map(([x, y]) => `${n(xs(x))},${n(y * H)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="${n(sw)}" stroke-linejoin="miter" stroke-miterlimit="12"/>`);
  }
  if (v === "numeral") {
    const t = o.text ?? r.pick([String(r.int(0, 9)), String(r.int(10, 99)), `${str(r, L, 1)}${r.int(1, 9)}`, str(r, "AEKMSX", 1)]);
    const size = H * 1.37, w = textW(t, size, "grotesk") * 1.08, under = r.chance(0.4);
    const b = text(0, H, t, { size, fill: col, font: "grotesk", weight: r.pick([300, 400, 500]), width: w });
    return under ? mkType(w, H * 1.23, b + rect(0, H * 1.1, w, H * 0.13, col)) : mkType(w, H, b);
  }
  if (v === "italic") {
    const t = o.text ?? `${str(r, L, 1)}${r.int(1, 9)}`, size = H * 1.4, tw = textW(t, size, "display"), sk = H * 0.27;
    return mkType(tw + sk, H, `<g transform="translate(${n(sk)} 0) skewX(-15)">${text(0, H, t, { size, fill: col, font: "display", weight: 700, width: tw })}</g>`);
  }
  const t = o.text ?? str(r, "CEMNOSUX", 1), size = H * 1.37, tw = textW(t, size, "wide");
  return mkType(tw, H, text(0, H, t, { size, fill: "none", font: "wide", weight: 700, width: tw, extra: `stroke="${col}" stroke-width="${n(H * 0.022)}"` }));
}

/** Small hardware parts from the prop atlases: keycaps, toggles, LED rails, plus buttons, capsules, numbered dots, knobs, nested sockets. */
export function button(o: Base & { variant?: "key" | "toggle" | "led" | "plus" | "pill" | "dots" | "knob" | "socket"; color?: string; label?: string } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette);
  const v = o.variant ?? r.pick(["key", "toggle", "led", "plus", "pill", "dots", "knob", "socket"] as const);
  const hues = p.accents.filter(saturated);
  const c = o.color ?? (hues.length ? r.pick(hues) : p.fg), ink = onColor(c), house = p.muted, deep = mix(p.muted, "#000000", 0.65);
  // `want` if it stands out on `fill`, else black/white: keeps parts readable when the palette has no greys (mask).
  const on = (fill: string, want: string) => (contrast(want, fill) < 1.5 ? onColor(fill) : want);
  const flat = contrast(c, house) < 1.5;
  const mk = (w: number, h: number, body: string): Decal => ({ kind: "button", w, h, body });
  const circ = (cx: number, cy: number, rr: number, fill: string, extra = "") => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rr)}" fill="${fill}"${extra ? " " + extra : ""}/>`;
  const plus = (cx: number, cy: number, s: number, fill: string) => rect(cx - s * 0.13, cy - s / 2, s * 0.26, s, fill) + rect(cx - s / 2, cy - s * 0.13, s, s * 0.26, fill);
  switch (v) {
    case "key": {
      const t = o.label ?? r.pick(["A", "T", "4", "6", "B", "+", "0"]);
      return mk(100, 100, rect(0, 0, 100, 100, c, `rx="18"`) + (t === "+" ? plus(50, 50, 52, ink) : text(50, 74, t, { size: 66, fill: ink, font: "display", weight: 700, anchor: "middle" })));
    }
    case "toggle": {
      const right = r.chance(0.5), mark = onColor(house);
      return mk(180, 80, rect(0, 0, 180, 80, house, `rx="40"`) + circ(right ? 140 : 40, 40, 30, on(house, c)) + (right ? rect(30, 30, 20, 20, mark, `rx="3"`) : rect(136, 26, 8, 28, mark, `rx="3"`)));
    }
    case "led": {
      const k = r.int(3, 5), lit = r.int(0, k - 1), W = 44 + (k - 1) * 36;
      let b = rect(0, 0, W, 44, deep, `rx="22"`);
      for (let i = 0; i < k; i++) {
        const cx = 22 + i * 36;
        // Unlit LEDs are rings when lit and unlit would share a color.
        b += i === lit || r.chance(0.2) ? circ(cx, 22, 16, c, `opacity="0.3"`) + circ(cx, 22, 10, c)
          : flat ? circ(cx, 22, 9, "none", `stroke="${house}" stroke-width="3"`) : circ(cx, 22, 10, house);
      }
      return mk(W, 64, b + text(4, 62, o.label ?? r.pick(["PWR", "SYS", "LNK", "RDY", "A1"]), { size: 13, fill: house, weight: 700 }));
    }
    case "plus": {
      const tall = r.chance(0.4), W = tall ? 70 : 124, H = tall ? 110 : 84;
      return mk(W, H, rect(0, 0, W, H, c, `rx="${tall ? 12 : 42}"`) + plus(W / 2, H / 2, tall ? 40 : 46, ink));
    }
    case "pill":
      return mk(170, 70, rect(0, 0, 170, 70, c, `rx="35"`) + text(135, 51, o.label ?? str(r, L, 1), { size: 46, fill: ink, font: "display", weight: 700, anchor: "middle" }));
    case "dots": {
      const k = r.int(3, 5), fill = r.chance(0.5) ? house : c;
      let b = "";
      for (let i = 0; i < k; i++) b += circ(20 + i * 46, 20, 19, fill) + text(20 + i * 46, 27, String(i + 1), { size: 20, fill: onColor(fill), weight: 700, anchor: "middle" });
      return mk(k * 46 - 6, 40, b);
    }
    case "knob":
      return mk(100, 100, circ(50, 50, 48, house) + circ(50, 50, 34, deep) + rect(47, 18, 6, 26, c, `rx="3"`));
    case "socket": {
      // Thick rounded frame around nested squares (the orange frame on the SMG sheet).
      const c2 = hues.length > 1 ? r.pick(hues.filter(h => h !== c)) : p.muted;
      const l1 = hues.length ? mix(c, "#FFFFFF", 0.78) : p.bg, l2 = hues.length ? mix(c2, "#FFFFFF", 0.5) : p.muted;
      return mk(150, 132, rect(6, 6, 138, 120, "none", `stroke="${c}" stroke-width="12" rx="22"`) + rect(42, 33, 66, 66, l1) + rect(49, 40, 52, 52, l2) + rect(59, 50, 32, 32, on(l2, p.fg), `rx="3"`));
    }
  }
}

/** Cluster of colored tiles carrying a code, a pixel mark, a ring or a small reading (medic-sheet style). */
export function tileGroup(o: Base & { cols?: number; rows?: number; cell?: number } = {}): Decal {
  const r = rng(o.seed ?? 1), p = pal(o.palette), cols = o.cols ?? 2, rows = o.rows ?? r.int(2, 3), c = o.cell ?? 120;
  const hues = p.accents.filter(saturated), fills = hues.length ? hues : [p.fg, p.muted];
  const on = Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => !(i || j) || r.chance(0.8)));
  let b = "", last = "";
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (!on[j][i]) continue;
    let fill = r.pick(fills);
    if (fill === last && fills.length > 1) fill = fills[(fills.indexOf(fill) + 1) % fills.length];
    last = fill;
    const x = i * c, y = j * c, ink = onColor(fill), what = r.pick(["code", "mark", "ring", "num", "none"] as const);
    // One shape per tile that reaches 2px under its right and lower neighbours, so anti-aliasing leaves no grey seams in masks.
    const ex = on[j][i + 1] ? 2 : 0, ey = on[j + 1]?.[i] ? 2 : 0;
    b += ex && ey && !on[j + 1][i + 1]
      ? poly([[x, y], [x + c + ex, y], [x + c + ex, y + c], [x + c, y + c], [x + c, y + c + ey], [x, y + c + ey]], fill)
      : rect(x, y, c + ex, c + ey, fill);
    if (what === "code") b += rect(x + c * 0.1, y + c * 0.06, c * 0.3, c * 0.05, ink) + text(x + c * 0.08, y + c * 0.9, `${str(r, L, 1)}${str(r, "nqrbe", 1)}`, { size: c * 0.66, fill: ink, font: "grotesk", weight: 500, width: c * 0.8 });
    if (what === "mark") b += place(blockMark({ seed: r.int(1, 1e6), grid: 5, color: ink }), x + c * 0.2, y + c * 0.2, c * 0.6, c * 0.6);
    if (what === "ring") b += place(icon({ name: r.pick(["ring", "peanut", "circle", "pill"] as const), color: ink, ground: fill }), x + c * 0.12, y + c * 0.12, c * 0.76, c * 0.76);
    if (what === "num") b += text(x + c * 0.92, y + c * 0.9, (r.next() * 99).toFixed(1), { size: c * 0.24, fill: ink, font: "grotesk", weight: 500, anchor: "end" });
  }
  return { kind: "tileGroup", w: cols * c, h: rows * c, body: b };
}

/* ============================== text variants ============================== */

export const TEXT_VARIANTS = ["plain", "wide", "mono", "display", "outline", "inverted", "bracket", "overbar", "underbar", "stacked", "vertical", "mirrored", "spaced", "slashedZero", "strike", "stencil", "distressed", "pixel", "segment", "boxed", "codeSplit"] as const;
export type TextVariant = typeof TEXT_VARIANTS[number];

/** One word rendered in one of the decal typographic treatments. */
export function textVariant(o: Base & { text: string; variant: TextVariant; size?: number; color?: string }): Decal {
  const p = pal(o.palette), col = o.color ?? p.fg, s = o.size ?? 48, v = o.variant, t = o.text;
  const T = (str: string, font: FontKey = "display", extra: Partial<TextOpts> = {}) => {
    const w = textW(str, s, font);
    return { w, body: text(0, s * 0.82, str, { size: s, fill: col, font, weight: 800, width: w, ...extra }) };
  };
  const mk = (w: number, h: number, body: string): Decal => ({ kind: `text:${v}`, w, h, body });
  switch (v) {
    case "plain": { const x = T(t, "grotesk"); return mk(x.w, s, x.body); }
    case "wide": { const x = T(t.toUpperCase(), "wide", { spacing: s * 0.04 }); return mk(x.w, s, x.body); }
    case "mono": { const x = T(t.toUpperCase(), "mono", { weight: 500 }); return mk(x.w, s, x.body); }
    case "display": { const x = T(t.toUpperCase(), "display"); return mk(x.w, s, x.body); }
    case "outline": { const x = T(t.toUpperCase(), "display", { fill: "none", extra: `stroke="${col}" stroke-width="${n(s * 0.035)}"` }); return mk(x.w, s, x.body); }
    case "inverted": { const x = T(t.toUpperCase(), "mono", { fill: p.bg, weight: 600 }); return mk(x.w + s * 0.4, s * 1.1, rect(0, 0, x.w + s * 0.4, s * 1.1, col) + `<g transform="translate(${s * 0.2} ${s * 0.08})">${x.body}</g>`); }
    case "bracket": { const x = T(`[ ${t.toUpperCase()} ]`, "mono", { weight: 600 }); return mk(x.w, s, x.body); }
    case "overbar": { const x = T(t, "grotesk", { weight: 500 }); return mk(x.w, s * 1.15, rect(s * 0.05, 0, s * 0.42, s * 0.07, col) + `<g transform="translate(0 ${s * 0.15})">${x.body}</g>`); }
    case "underbar": { const x = T(t.toUpperCase(), "grotesk", { weight: 500 }); return mk(x.w, s * 1.25, x.body + rect(0, s * 1.05, x.w, s * 0.16, col)); }
    case "stacked": {
      const chars = t.toUpperCase().split("");
      return mk(s * 0.75, chars.length * s * 0.92, chars.map((c, i) => text(s * 0.375, (i + 0.82) * s * 0.92, c, { size: s, fill: col, font: "display", weight: 800, anchor: "middle" })).join(""));
    }
    case "vertical": { const x = T(t.toUpperCase(), "mono", { weight: 600 }); return mk(s, x.w, `<g transform="translate(${s * 0.85} 0) rotate(90)">${x.body}</g>`); }
    case "mirrored": { const x = T(t.toUpperCase(), "display"); return mk(x.w, s, `<g transform="translate(${x.w} 0) scale(-1 1)">${x.body}</g>`); }
    case "spaced": { const str2 = t.toUpperCase().split("").join(" "); const x = T(str2, "mono", { weight: 500 }); return mk(x.w, s, x.body); }
    case "slashedZero": { const x = T(t.toUpperCase().replace(/0/g, "Ø").replace(/O/g, "Ø"), "mono", { weight: 600 }); return mk(x.w, s, x.body); }
    case "strike": { const x = T(t.toUpperCase(), "display"); return mk(x.w, s, x.body + rect(-s * 0.05, s * 0.4, x.w + s * 0.1, s * 0.09, col)); }
    case "stencil": {
      const x = T(t.toUpperCase(), "display"), id = uid("stn");
      const gaps = rect(0, s * 0.43, x.w, s * 0.07, "#000") + Array.from({ length: t.length - 1 }, (_, i) => rect((i + 1) * x.w / t.length - s * 0.02, 0, s * 0.04, s * 0.3, "#000")).join("");
      return mk(x.w, s, `<mask id="${id}">${rect(0, 0, x.w, s, "#fff")}${gaps}</mask><g mask="url(#${id})">${x.body}</g>`);
    }
    case "distressed": {
      const x = T(t.toUpperCase(), "display"), id = uid("dst"), seed = rng(o.seed ?? t).int(1, 999);
      const f = `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.06 0.5" numOctaves="3" seed="${seed}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 2.75" result="m"/><feComponentTransfer in="m" result="k"><feFuncA type="discrete" tableValues="0 1 1 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="k" operator="in"/></filter>`;
      return mk(x.w, s, `${f}<g filter="url(#${id})">${x.body}</g>`);
    }
    case "pixel": { const d = pixelText({ text: t, cell: s / 7, color: col }); return { ...d, kind: `text:${v}` }; }
    case "segment": { const d = segmentText({ text: t, height: s, color: col, slant: 0.08 }); return { ...d, kind: `text:${v}` }; }
    case "boxed": { const x = T(t.toUpperCase(), "wide", { weight: 700 }); return mk(x.w + s * 0.5, s * 1.3, rect(1.5, 1.5, x.w + s * 0.5 - 3, s * 1.3 - 3, "none", `stroke="${col}" stroke-width="3" rx="${s * 0.3}"`) + `<g transform="translate(${s * 0.25} ${s * 0.18})">${x.body}</g>`); }
    case "codeSplit": {
      const r = rng(o.seed ?? t), a = T(t.toUpperCase(), "display"), code = String(r.int(1000000, 9999999));
      const bw = textW(code, s * 0.5, "mono"), gap = s * 0.3;
      return mk(a.w + gap * 2 + bw, s, a.body + rect(a.w + gap - s * 0.03, s * 0.08, s * 0.06, s * 0.8, col) +
        text(a.w + gap * 2, s * 0.4, code, { size: s * 0.5, fill: col, font: "mono", weight: 500, width: bw }) +
        text(a.w + gap * 2, s * 0.82, codes.short(r), { size: s * 0.34, fill: col, font: "mono", weight: 400 }));
    }
  }
}

/** Every text variant of one word, laid out in height-balanced columns. */
export function variantSheet(o: Base & { text: string; size?: number; variants?: readonly TextVariant[]; cols?: number }): Decal {
  const p = pal(o.palette), s = o.size ?? 40, vs = o.variants ?? TEXT_VARIANTS, cols = o.cols ?? 3;
  const items = vs.map(v => ({ v, d: textVariant({ ...o, variant: v, size: s }) }));
  const colW = Math.max(...items.map(i => i.d.w)) + 60, cellH = (d: Decal) => d.h + 36;
  const target = items.reduce((a, i) => a + cellH(i.d), 0) / cols;
  let b = "", maxH = 0, c = 0, y = 0;
  for (const { v, d } of items) {
    if (y > 0 && y + cellH(d) / 2 > target && c < cols - 1) { maxH = Math.max(maxH, y); c++; y = 0; }
    b += text(c * colW, y + 12, v.toUpperCase(), { size: 10, fill: p.muted, font: "mono" });
    b += `<g transform="translate(${c * colW} ${y + 18})">${d.body}</g>`;
    y += cellH(d);
  }
  maxH = Math.max(maxH, y);
  return { kind: "variantSheet", w: colW * cols - 60, h: maxH - 18, body: b };
}

/* ============================== registry & sheet ============================== */

type Maker = (o: Base & Record<string, unknown>) => Decal;
const asMaker = <T>(f: (o: T) => Decal) => f as unknown as Maker;

export const KINDS = {
  glyphDisc: asMaker(glyphDisc), pixelArrow: asMaker(pixelArrow), chevrons: asMaker(chevrons), barcode: asMaker(barcode),
  stripes: asMaker(stripes), checker: asMaker(checker), globe: asMaker((o: Base) => checker({ ...o, globe: true, cols: 14, rows: 10 })),
  dither: asMaker(dither), reticle: asMaker(reticle), dotMatrix: asMaker(dotMatrix), blockMark: asMaker(blockMark),
  bracketFrame: asMaker((o: Base) => bracketFrame({ ...o, inner: reticle({ ...o, variant: "pip" }) })), ruler: asMaker(ruler),
  serialBlock: asMaker(serialBlock), specTable: asMaker(specTable), warningLabel: asMaker(warningLabel), repeatBand: asMaker(repeatBand),
  pillTag: asMaker(pillTag), stackBadge: asMaker(stackBadge), lockup: asMaker(lockup),
  pixelText: asMaker((o: Base & { text?: string }) => pixelText({ ...o, text: o.text ?? corpName(rng(o.seed ?? 1)) })),
  segmentText: asMaker((o: Base & { text?: string }) => segmentText({ ...o, text: o.text ?? String(rng(o.seed ?? 1).int(10, 99999)) })),
  icon: asMaker(icon), codeBox: asMaker(codeBox), tape: asMaker(tape),
  thinCode: asMaker(thinCode), bigType: asMaker(bigType), button: asMaker(button), tileGroup: asMaker(tileGroup),
} as const;
export type DecalKind = keyof typeof KINDS;

/** Generic entry point: make("glyphDisc", { seed: 4, palette: "mono" }). */
export function make(kind: DecalKind, o: Base & Record<string, unknown> = {}): Decal {
  return KINDS[kind](o);
}

/** Relative row height and size options per kind, so a sheet mixes big marks with small print. */
const SHEET_FIT: Partial<Record<DecalKind, { k: number; opts?: (r: Rng) => Record<string, unknown> }>> = {
  glyphDisc: { k: 0.9 }, pixelArrow: { k: 0.9 }, chevrons: { k: 0.45 }, barcode: { k: 0.55 },
  stripes: { k: 0.6, opts: r => ({ w: r.int(160, 360), h: r.int(40, 90), band: r.int(6, 14) }) },
  checker: { k: 0.7, opts: r => ({ cols: r.int(6, 12), rows: r.int(2, 6) }) }, globe: { k: 1 },
  dither: { k: 0.8, opts: r => ({ w: r.int(160, 320), h: r.int(60, 110), cell: r.pick([3, 4, 6]) }) },
  reticle: { k: 0.6 }, dotMatrix: { k: 0.55 }, blockMark: { k: 0.6 }, bracketFrame: { k: 0.9 }, ruler: { k: 0.4 },
  serialBlock: { k: 0.55 }, specTable: { k: 1 }, warningLabel: { k: 0.5 },
  repeatBand: { k: 0.42, opts: r => ({ w: r.int(360, 760), h: r.int(36, 56) }) },
  pillTag: { k: 0.45 }, stackBadge: { k: 0.8 }, lockup: { k: 1.25 }, pixelText: { k: 0.4 }, segmentText: { k: 0.75 },
  icon: { k: 0.62 }, codeBox: { k: 0.7 }, tape: { k: 0.4, opts: r => ({ w: r.int(220, 420) }) },
  thinCode: { k: 0.45 }, bigType: { k: 1 }, button: { k: 0.5 }, tileGroup: { k: 1.1 },
};
/** How often a kind is drawn again after every kind has appeared once. */
const SHEET_WEIGHT: Partial<Record<DecalKind, number>> = {
  icon: 6, glyphDisc: 3, reticle: 2, blockMark: 2, codeBox: 2, pixelArrow: 1.5, chevrons: 1.5, barcode: 1.5, serialBlock: 1.5,
  segmentText: 1, pixelText: 1, dotMatrix: 1, stackBadge: 1, pillTag: 0.8, stripes: 0.8, checker: 0.6, globe: 0.4, dither: 0.6,
  repeatBand: 0.6, warningLabel: 0.5, tape: 0.4, bracketFrame: 0.5, ruler: 0.4, specTable: 0.2, lockup: 0,
  thinCode: 1.5, button: 1.5, bigType: 0.6, tileGroup: 0.3,
};
const weighted = (r: Rng, kinds: DecalKind[], table = SHEET_WEIGHT) => {
  const ws = kinds.map(k => table[k] ?? 1), total = ws.reduce((a, b) => a + b, 0);
  let t = r.next() * total;
  for (let i = 0; i < kinds.length; i++) { t -= ws[i]; if (t <= 0) return kinds[i]; }
  return kinds[kinds.length - 1];
};
const TINTABLE: DecalKind[] = ["icon", "codeBox", "tape", "pixelArrow", "chevrons", "barcode", "reticle", "dotMatrix", "blockMark", "segmentText", "pixelText", "stripes", "checker", "thinCode", "bigType", "button"];

/* ---------- layout helpers ---------- */

const shuffle = <T>(r: Rng, arr: readonly T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = r.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
/** Accents that stay legible on the palette background (tints for marks need less contrast than text). */
const readable = (p: Palette, min: number) => p.accents.filter(c => contrast(c, p.bg) >= min);
/** Fits a decal into a box keeping its aspect; "start" pins it left, otherwise centered. */
function fit(d: Decal, x: number, y: number, w: number, h: number, align: "start" | "middle" = "middle") {
  const k = Math.min(w / d.w, h / d.h), dw = d.w * k, dh = d.h * k;
  return place(d, align === "start" ? x : x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
/** The same decal twice, side by side (paired arrows, paired crosshairs). */
const pair = (d: Decal, gap = 0.18): Decal => ({ ...d, w: d.w * (2 + gap), body: d.body + `<g transform="translate(${n(d.w * (1 + gap))} 0)">${d.body}</g>` });
/** Cell occupancy for the grid layouts. */
function cells(cols: number, rows: number) {
  const used = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const free = (c: number, r0: number, w: number, h: number) => {
    if (c + w > cols || r0 + h > rows) return false;
    for (let j = r0; j < r0 + h; j++) for (let i = c; i < c + w; i++) if (used[j][i]) return false;
    return true;
  };
  return {
    used,
    spots(w: number, h: number) {
      const s: [number, number][] = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (free(i, j, w, h)) s.push([i, j]);
      return s;
    },
    take(c: number, r0: number, w: number, h: number) { for (let j = r0; j < r0 + h; j++) for (let i = c; i < c + w; i++) used[j][i] = true; },
  };
}
/** One full-width line of condensed pseudo-data (the long code rows on atlases and band sheets). */
function codeLine(r: Rng, w: number, size: number, col: string) {
  let s = "";
  while (textW(s, size) < w * 1.4) s += r.pick([str(r, AN, r.int(2, 6)), String(r.int(1, 999)), str(r, L, r.int(1, 4)), `${r.int(10, 99)}${str(r, L, 1)}`]) + " ";
  return text(0, size * 0.8, s.trim(), { size, fill: col, width: w });
}

/* ---------- layouts ---------- */

export const SHEET_LAYOUTS = ["flow", "prop", "atlas", "bands"] as const;
export type SheetLayout = typeof SHEET_LAYOUTS[number];
export interface SheetFooter { left?: string; right?: string; color?: string; ink?: string; label?: string }
export interface SheetOpts extends Base {
  /** flow: dense rows (default) · prop: a dozen big elements on a loose 12-column grid · atlas: packed icon grid + type specimen · bands: full-width seal / tape strips */
  layout?: SheetLayout;
  w?: number;
  /** flow: decals (60) · prop: elements (14) · bands: strips (12). Atlas fills its grid instead. */
  count?: number;
  /** flow: row height in px. */
  rowH?: number;
  /** prop: grid rows (7) · atlas: grid rows (14). */
  rows?: number;
  /** atlas: cell size in px (92). */
  cell?: number;
  /** Restricts which kinds may appear (flow, prop, atlas). */
  kinds?: DecalKind[];
  /** Acid-lime bar along the bottom. On by default for flow and prop, off for atlas and bands. */
  footer?: false | SheetFooter;
}

function flowSheet(o: SheetOpts, r: Rng): Decal {
  const p = pal(o.palette), W = o.w ?? 1600, rowH = o.rowH ?? 130, gap = 30, pad = 40;
  const kinds = o.kinds ?? (Object.keys(KINDS) as DecalKind[]);
  const count = o.count ?? 60, order = shuffle(r, kinds), tints = readable(p, 1.6);
  let x = pad, y = pad, b = "";
  for (let i = 0; i < count; i++) {
    const kind = i < order.length ? order[i] : weighted(r, kinds);
    const sf = SHEET_FIT[kind] ?? { k: 0.8 };
    const tint = TINTABLE.includes(kind) && p.accents.length > 2 && tints.length && r.chance(0.5) ? { color: r.pick(tints) } : {};
    const d = make(kind, { seed: r.int(1, 1e9), palette: o.palette, ...(sf.opts?.(r) ?? {}), ...tint });
    const ar = d.w / d.h;
    let h = rowH * sf.k, w = h * ar;
    const maxW = (W - pad * 2) * (kind === "lockup" ? 0.75 : 0.55);
    if (w > maxW) { w = maxW; h = w / ar; }
    if (x + w > W - pad) { x = pad; y += rowH + gap; }
    b += place(d, x, y + (rowH - h) / 2, w, h);
    x += w + gap;
  }
  return { kind: "sheet", w: W, h: y + rowH + pad, body: b };
}

type Role = "hero" | "mid" | "small";
const PROP_POOL: Record<Role, DecalKind[]> = {
  hero: ["bigType", "bigType", "pixelArrow", "glyphDisc", "blockMark", "tileGroup", "button", "codeBox", "checker", "reticle"],
  mid: ["thinCode", "thinCode", "thinCode", "segmentText", "chevrons", "reticle", "icon", "button", "codeBox", "stripes", "bigType", "stackBadge"],
  small: ["thinCode", "thinCode", "icon", "reticle", "button", "chevrons"],
};
/** Candidate spans (columns × rows) per role; the one closest to the decal's aspect wins. */
const PROP_SPANS: Record<Role, [number, number][]> = {
  hero: [[3, 3], [4, 3], [3, 2], [4, 2], [5, 2], [2, 3], [5, 3]],
  mid: [[2, 2], [3, 1], [4, 1], [2, 1], [1, 2], [3, 2]],
  small: [[1, 1], [2, 1]],
};
const PROP_NAMES = ["MEDIC", "SMG", "RIFLE", "CARGO", "DRONE", "VALVE", "CANISTER", "HELMET", "CRATE", "SCANNER"];
function propOpts(kind: DecalKind, role: Role, r: Rng): Record<string, unknown> {
  switch (kind) {
    case "button": return { variant: role === "hero" ? "socket" : role === "mid" ? r.pick(["key", "plus", "pill", "toggle"]) : r.pick(["led", "dots", "key"]) };
    case "reticle": return { variant: role === "small" ? r.pick(["pip", "plus", "register"]) : r.pick(["plus", "crossCircle", "tickRing", "pip"]) };
    case "codeBox": return { variant: role === "hero" ? r.pick(["big", "stack"]) : r.pick(["split", "big"]) };
    case "checker": return { cols: r.int(3, 5), rows: r.int(2, 4), cell: 40 };
    case "blockMark": return { grid: r.int(4, 5) };
    case "thinCode": return role === "small" ? { variant: r.pick(["line", "stack"]) } : {};
    case "chevrons": return role === "small" ? { count: 3 } : {};
    case "bigType": return { variant: role === "mid" ? r.pick(["numeral", "italic"]) : r.pick(["stroke", "stroke", "numeral", "outline"]) };
    case "stripes": return { w: 300, h: 90, band: 16 };
    default: return {};
  }
}

/** Prop sheet (SMG / medic pages): few large elements, strong scale contrast, lots of air. */
function propSheet(o: SheetOpts, r: Rng): Decal {
  const p = pal(o.palette), W = o.w ?? 1920, cols = 12, rows = o.rows ?? 7, pad = Math.round(W / 30);
  const cell = (W - pad * 2) / cols, grid = cells(cols, rows);
  const total = o.count ?? 14, heroes = Math.max(2, Math.round(total * 0.2)), mids = Math.round(total * 0.38);
  const plan: Role[] = [...Array<Role>(heroes).fill("hero"), ...Array<Role>(mids).fill("mid"), ...Array<Role>(Math.max(0, total - heroes - mids)).fill("small")];
  const tints = readable(p, 1.6), inks = readable(p, 2.6), seen = new Set<DecalKind>();
  let b = "";
  for (const role of plan) {
    const pool = PROP_POOL[role].filter(k => !o.kinds || o.kinds.includes(k));
    if (!pool.length) continue;
    const fresh = pool.filter(k => !seen.has(k)), kind = r.pick(fresh.length ? fresh : pool);
    seen.add(kind);
    const opts: Record<string, unknown> = { seed: r.int(1, 1e9), palette: o.palette, ...propOpts(kind, role, r) };
    if (p.accents.length > 2) {
      if (kind === "thinCode") { if (inks.length && r.chance(0.35)) opts.color = r.pick(inks); }
      else if (TINTABLE.includes(kind) && tints.length && r.chance(0.35)) opts.color = r.pick(tints);
    }
    let d = make(kind, opts);
    if ((kind === "pixelArrow" && role === "hero" && r.chance(0.6)) || (kind === "reticle" && role === "small" && r.chance(0.5))) d = pair(d);
    const ar = d.w / d.h;
    const spans = PROP_SPANS[role].map(s => ({ s, k: Math.abs(Math.log(s[0] / s[1] / ar)) + r.next() * 0.3 })).sort((a, z) => a.k - z.k);
    for (const { s: [cw, ch] } of spans) {
      const spots = grid.spots(cw, ch);
      if (!spots.length) continue;
      const [ci, rj] = r.pick(spots), gut = cell * (role === "hero" ? 0.08 : 0.12);
      grid.take(ci, rj, cw, ch);
      b += fit(d, pad + ci * cell + gut, pad + rj * cell + gut, cw * cell - gut * 2, ch * cell - gut * 2, kind === "thinCode" ? "start" : "middle");
      break;
    }
  }
  const H = pad * 2 + rows * cell, label = (o.footer ? o.footer.label : undefined) ?? `${r.pick(PROP_NAMES)} DECALS_PG_${r.int(1, 9)}`;
  if (o.footer !== false) b += text(pad * 0.4, H - pad * 0.3, label, { size: Math.max(11, W / 110), fill: p.muted, font: "grotesk", weight: 400 });
  return { kind: "sheet", w: W, h: H, body: b };
}

/** Multi-cell blocks scattered first on an atlas: [kind, columns, rows, options]. */
const ATLAS_BLOCKS: [DecalKind, number, number, Record<string, unknown>?][] = [
  ["specTable", 4, 2], ["serialBlock", 3, 1], ["serialBlock", 2, 1, { lines: 3 }], ["warningLabel", 4, 1], ["barcode", 2, 1, { digits: true }],
  ["thinCode", 3, 1, { variant: "line" }], ["thinCode", 2, 1, { variant: "overbar" }], ["segmentText", 3, 1], ["dither", 3, 2], ["stripes", 3, 1],
  ["dotMatrix", 2, 1], ["checker", 2, 1, { cols: 8, rows: 4 }], ["tileGroup", 2, 2], ["button", 2, 1, { variant: "toggle" }], ["button", 2, 1, { variant: "led" }],
  ["bigType", 2, 2, { variant: "stroke" }], ["chevrons", 2, 1], ["pillTag", 3, 1], ["repeatBand", 4, 1, { w: 480, h: 48 }],
];
/** Single-cell fill frequencies on an atlas. */
const ATLAS_SMALL: Partial<Record<DecalKind, number>> = {
  icon: 8, button: 3, glyphDisc: 2, reticle: 2, blockMark: 2, codeBox: 1.5, pixelArrow: 1, chevrons: 1, stackBadge: 1, bigType: 0.6, thinCode: 0.5, dotMatrix: 0.6,
};

/** Symbol atlas (corp atlas / navy prop atlas): a packed grid of small marks, a code line and a type specimen. */
function atlasSheet(o: SheetOpts, r: Rng): Decal {
  const p = pal(o.palette), W = o.w ?? 2048, pad = 32, cell = o.cell ?? 92, cols = Math.floor((W - pad * 2) / cell), rows = o.rows ?? 14;
  const ox = (W - cols * cell) / 2, grid = cells(cols, rows), tints = readable(p, 1.6), colorful = p.accents.length > 2;
  const allow = (k: DecalKind) => !o.kinds || o.kinds.includes(k);
  const opts = (kind: DecalKind, extra: Record<string, unknown> = {}) => {
    const out: Record<string, unknown> = { seed: r.int(1, 1e9), palette: o.palette, ...extra };
    if (colorful && TINTABLE.includes(kind) && tints.length && r.chance(0.55)) out.color = r.pick(tints);
    return out;
  };
  let b = "";
  const put = (d: Decal, ci: number, rj: number, cw: number, ch: number) => {
    const gut = cell * 0.14;
    b += fit(d, ox + ci * cell + gut, pad + rj * cell + gut, cw * cell - gut * 2, ch * cell - gut * 2);
  };
  for (const [kind, cw, ch, extra] of shuffle(r, ATLAS_BLOCKS.filter(([k]) => allow(k))).slice(0, Math.round(rows * 0.9))) {
    const spots = grid.spots(cw, ch);
    if (!spots.length) continue;
    const [ci, rj] = r.pick(spots);
    grid.take(ci, rj, cw, ch);
    put(make(kind, opts(kind, extra)), ci, rj, cw, ch);
  }
  const smalls = (Object.keys(ATLAS_SMALL) as DecalKind[]).filter(allow);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (grid.used[j][i] || !smalls.length || !r.chance(0.86)) continue;
    const kind = weighted(r, smalls, ATLAS_SMALL);
    put(make(kind, opts(kind, kind === "bigType" ? { variant: "numeral" } : kind === "thinCode" ? { variant: "stack" } : {})), i, j, 1, 1);
  }
  const lw = W - pad * 2;
  let y = pad + rows * cell + cell * 0.3;
  b += `<g transform="translate(${pad} ${n(y)})">${codeLine(r, lw, cell * 0.32, p.fg)}</g>`;
  y += cell * 0.5;
  b += text(pad, y + cell * 0.75, "ABCDEFGHIJKLMNOPQRSTUVWXYZØ123456789", { size: cell * 0.9, fill: p.fg, font: "mono", weight: 400, width: lw });
  return { kind: "sheet", w: W, h: y + cell + pad, body: b };
}

/** Seal-band sheet: stacked full-width word bands, stamp bars, pills, tape strokes, combs and code rows. */
function bandsSheet(o: SheetOpts, r: Rng): Decal {
  const p = pal(o.palette), W = o.w ?? 2048, hues = p.accents.filter(saturated);
  const hue = (i: number) => (hues.length ? hues[i % hues.length] : i % 2 ? p.muted : p.fg);
  const ground = mix(p.bg, p.fg, 0.2), light = mix(p.fg, p.bg, 0.25), word = () => r.pick(WORDS), seed = () => r.int(1, 1e9);
  const colorBand = (pill: boolean) => {
    const h = pill ? 104 : 112, fill = mix(hue(1), "#000000", 0.18);
    const ink = hues.length > 2 && contrast(hue(2), fill) >= 1.15 ? hue(2) : onColor(fill);
    return { h, body: repeatBand({ word: word(), sep: "-", w: W, h, fill, color: ink, sepColor: contrast(hue(0), fill) < 2 ? ink : hue(0), weight: 600, pill }).body };
  };
  const bands: Record<string, () => { h: number; body: string }> = {
    thin: () => ({ h: 96, body: repeatBand({ word: word(), sep: "  ", w: W, h: 96, fill: ground, color: light, weight: 400 }).body + rect(0, 88, W, 8, mix(ground, p.fg, 0.12)) }),
    bold: () => ({ h: 128, body: repeatBand({ word: word(), sep: "  ", w: W, h: 128, fill: ground, color: p.fg, weight: 600 }).body }),
    here: () => ({ h: 92, body: repeatBand({ word: `${word()} HERE`, sep: "    ", mark: true, w: W, h: 92, fill: ground, color: p.fg, weight: 600 }).body }),
    dash: () => ({ h: 132, body: repeatBand({ word: word(), sep: "-", w: W, h: 132, fill: ground, color: p.fg, weight: 700 }).body }),
    color: () => colorBand(false),
    pill: () => colorBand(true),
    stamp: () => {
      const h = 120, fill = hue(0);
      return { h, body: rect(0, 0, W, h, fill) + text(24, h * 0.74, codes.stamp(r), { size: h * 0.6, fill: "none", font: "mono", weight: 700, extra: `stroke="${mix(fill, "#000000", 0.75)}" stroke-width="3"` }) };
    },
    pills: () => {
      const k = 1.7, h = 64 * k;
      const a = pillTag({ seed: seed(), palette: o.palette, end: "left", arrow: true, w: (W * 0.43) / k });
      const c = pillTag({ seed: seed(), palette: o.palette, end: "right", arrow: false, w: (W * 0.45) / k });
      return { h, body: place(a, W * 0.01, 0, a.w * k, h) + place(c, W * 0.53, 0, c.w * k, h) };
    },
    tapes: () => {
      const h = 104, c = hue(0);
      return { h, body: place(tape({ seed: seed(), w: W * 0.56, h, color: c }), W * 0.04, 0, W * 0.56, h) + place(tape({ seed: seed(), w: W * 0.3, h, color: c }), W * 0.66, 0, W * 0.3, h) };
    },
    comb: () => {
      const k = 10, step = W / k, fill = mix(p.fg, p.bg, 0.1), bar = mix(p.bg, p.fg, 0.5);
      let body = "";
      for (let i = 0; i < k; i++) { const cx = step * (i + 0.5); body += rect(cx - 9, 0, 18, 30, fill) + rect(cx - 56, 30, 112, 34, fill); }
      for (let x = step * 2.2; x < W - 40; x += step * 2.5) body += rect(x, 96, 16, 70, bar) + rect(x + 24, 96, 16, 70, bar);
      return { h: 166, body };
    },
    bar: () => { const c = hue(5); return { h: 140, body: rect(0, 0, W, 140, mix(c, "#000000", 0.45)) + rect(0, 12, W, 116, c) }; },
    code: () => ({ h: 76, body: codeLine(r, W, 64, light) }),
    scatter: () => {
      const h = 170, lx = W * 0.81, name = corpName(r, true), here = `▪${word()} HERE`;
      let body = "";
      for (let i = 0; i < 14; i++) body += `<circle cx="${r.int(10, Math.round(W * 0.48))}" cy="${r.int(20, h - 20)}" r="5" fill="${p.fg}"/>`;
      for (let i = 0; i < 4; i++) body += text(r.int(60, Math.round(W * 0.45)), r.int(30, h - 20), `${str(r, "tinz", 1)}${str(r, "itnz", 1)} - ${r.int(1, 99)}`, { size: 20, fill: p.fg, font: "grotesk", weight: 400 });
      body += rect(W * 0.505, 0, W * 0.29, h - 10, ground) + poly([[lx, 10], [lx + 40, 10], [lx, 50]], p.fg);
      body += text(lx + 48, 30, name, { size: 20, fill: p.fg, weight: 700, width: Math.min(W - lx - 60, textW(name, 20)) });
      body += text(lx + 48, 56, r.pick(["PODS", "UNITS", "CELLS", "LINES"]), { size: 20, fill: p.fg, weight: 700 });
      body += text(lx + 20, 106, here, { size: 30, fill: p.fg, weight: 700, width: Math.min(W - lx - 30, textW(here, 30)) });
      body += rect(lx, 116, W - lx - 10, 3, p.fg) + rect(lx, 140, W - lx - 10, 2, p.fg);
      for (let x = lx; x < W - 10; x += 60) body += rect(x, 122, 2, 18, p.fg);
      return { h, body };
    },
    barcodes: () => {
      let body = "", x = 0;
      while (x < W - 260) {
        const bc = barcode({ seed: seed(), height: 35, color: p.fg });
        body += place(bc, x, 0, bc.w * 1.6, 56) + text(x, 78, codes.serial(r), { size: 16, fill: light });
        x += Math.max(bc.w * 1.6, 120) + r.int(60, 160);
      }
      return { h: 84, body };
    },
    arrows: () => {
      const h = 48, c = mix(p.bg, p.fg, 0.5), seg = W / 3.4;
      let body = "", x = 0;
      while (x < W) {
        body += poly([[x, 0], [x + seg, 0], [x + seg + h * 0.5, h / 2], [x + seg, h], [x, h]], c);
        x += seg + h * 0.8;
        for (let k = 0; k < 3 && x < W; k++, x += h * 0.75) body += poly([[x, 0], [x + h * 0.25, 0], [x + h * 0.75, h / 2], [x + h * 0.25, h], [x, h], [x + h * 0.5, h / 2]], c);
        x += h * 0.4;
      }
      return { h, body };
    },
  };
  const top = shuffle(r, ["thin", "bold", "here", "dash"]).slice(0, r.int(3, 4));
  const middle = shuffle(r, ["color", "pill", "stamp", "pills", "tapes", "comb", "bar", "code", "scatter", "barcodes"]).slice(0, Math.max(0, (o.count ?? 12) - top.length - 1));
  let y = 0, b = "";
  const add = (key: string, gap: number) => { const band = bands[key](); b += `<g transform="translate(0 ${n(y)})">${band.body}</g>`; y += band.h + gap; };
  top.forEach((k, i) => add(k, i === top.length - 1 ? 32 : 0));
  middle.forEach(k => add(k, r.int(24, 44)));
  add("arrows", 20);
  return { kind: "sheet", w: W, h: y, body: b };
}

/** A whole decal sheet. `layout` picks the composition (see SheetOpts); the footer bar is added here for every layout. */
export function sheet(o: SheetOpts = {}): Decal {
  const r = rng(o.seed ?? 1), layout = o.layout ?? "flow";
  const d = layout === "prop" ? propSheet(o, r) : layout === "atlas" ? atlasSheet(o, r) : layout === "bands" ? bandsSheet(o, r) : flowSheet(o, r);
  if (o.footer === false || (o.footer === undefined && (layout === "atlas" || layout === "bands"))) return d;
  const f: SheetFooter = o.footer || {}, W = d.w, H = d.h, k = Math.max(1, W / 1600), fh = 48 * k, fc = f.color ?? "#C0FE0F", ink = f.ink ?? "#0A0A0A";
  let b = d.body + rect(0, H, W, fh, fc);
  b += text(24 * k, H + 32 * k, f.left ?? corpName(r, true), { size: 18 * k, fill: ink, font: "wide", weight: 700 });
  const bc = barcode({ seed: r.int(1, 1e6), height: 18, color: ink });
  b += place(bc, W - 360 * k, H + 15 * k, bc.w * k, 18 * k);
  b += text(W - 24 * k, H + 32 * k, f.right ?? `× ${r.int(1000, 9999)}  ${codes.short(r)}`, { size: 18 * k, fill: ink, font: "mono", weight: 700, anchor: "end" });
  return { kind: "sheet", w: W, h: H + fh, body: b };
}

/** One labeled example of every kind and every icon: a visual index of the kit. */
export function catalog(o: Base & { w?: number } = {}): Decal {
  const p = pal(o.palette), W = o.w ?? 1600, cell = 180, cols = Math.floor(W / cell);
  const items: { label: string; d: Decal }[] = [
    ...(Object.keys(KINDS) as DecalKind[]).map(k => ({ label: k, d: make(k, { seed: o.seed ?? 3, palette: o.palette }) })),
    ...ICONS.map(name => ({ label: `icon:${name}`, d: icon({ name, palette: o.palette }) })),
  ];
  let b = "";
  items.forEach(({ label, d }, i) => {
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    b += place(d, x + 20, y + 16, cell - 40, cell - 56);
    b += text(x + cell / 2, y + cell - 14, label, { size: 11, fill: p.muted, anchor: "middle" });
  });
  return { kind: "catalog", w: cols * cell, h: Math.ceil(items.length / cols) * cell, body: b };
}
