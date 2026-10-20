// React wrappers for the decal generator.
import { useMemo, type CSSProperties } from "react";
import { make, toSvg, textVariant, sheet, type DecalKind, type MaskMode, type PaletteInput, type SheetLayout, type TextVariant } from "./decals.ts";

/** `mask` snaps the output to pure black and white (use palette "mask" with it), e.g. to preview 3D masks. */
type Common = { seed?: number | string; palette?: PaletteInput; background?: boolean | string; mask?: MaskMode; className?: string; style?: CSSProperties; title?: string };

function Svg({ svg, className, style, title }: { svg: string; className?: string; style?: CSSProperties; title?: string }) {
  // Generated markup only; user text is XML-escaped inside decals.ts. The SVG shrinks to fit narrow containers.
  const html = svg.replace("<svg ", '<svg style="display:block;max-width:100%;height:auto" ');
  return <span className={className} style={{ display: "inline-block", lineHeight: 0, maxWidth: "100%", ...style }}
    role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
    dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Any registered decal kind: <Decal kind="glyphDisc" seed={4} palette="mono" />. Extra props go to the generator. */
export function Decal({ kind, seed, palette, background, mask, className, style, title, ...opts }: Common & { kind: DecalKind } & Record<string, unknown>) {
  const key = JSON.stringify(opts);
  const svg = useMemo(() => toSvg(make(kind, { seed, palette, ...opts }), { background, palette, mask }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, seed, palette, background, mask, key]);
  return <Svg svg={svg} className={className} style={style} title={title} />;
}

/** A word in one decal typographic treatment. */
export function DecalText({ text, variant, size, color, seed, palette, background, mask, className, style }: Common & { text: string; variant: TextVariant; size?: number; color?: string }) {
  const svg = useMemo(() => toSvg(textVariant({ text, variant, size, color, seed, palette }), { background, palette, mask }),
    [text, variant, size, color, seed, palette, background, mask]);
  return <Svg svg={svg} className={className} style={style} title={text} />;
}

/** A full decal sheet, scaled to its container width. `layout`: flow | prop | atlas | bands. */
export function DecalSheet({ seed, palette = "mono", layout, count, mask, className, style }: Common & { layout?: SheetLayout; count?: number }) {
  const svg = useMemo(() => toSvg(sheet({ seed, palette, layout, count, ...(mask ? { footer: false as const } : {}) }), { background: true, palette, mask }).replace(/ width="[^"]+" height="[^"]+"/, ' width="100%"'),
    [seed, palette, layout, count, mask]);
  return <Svg svg={svg} className={className} style={{ width: "100%", ...style }} title="Decal sheet" />;
}
