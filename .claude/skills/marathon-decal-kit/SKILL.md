---
name: marathon-decal-kit
description: Generate Marathon-style (Bungie 2026) decals, symbols, labels and text variants as seeded SVG — glyph discs, pixel arrows, barcodes, spec tables, repeat bands, thin codes, big type, hardware buttons, 21 type treatments — and whole decal sheets in four layouts (flow, prop sheet, symbol atlas, seal bands) via CLI, TypeScript import or React components.
---

# Marathon Decal Kit（马拉松风格贴花 / 符号 / 文字变体生成库）

用代码批量生成 Marathon 风格的贴花素材：符号、图标、条码、编号块、规格表、警示标签、重复带、字标组合、像素/数码管文字，以及 21 种文字变体。输出纯 SVG 字符串（可转 PNG），同一个 `seed` 永远得到同一张图。

**贴花主要给 3D 软件用，所以命令行默认输出纯黑白：黑底白图，没有灰色，没有底部品牌条**（见第 3 节）。要彩色稿时再加 `--palette`。

参考来源：用户提供的 10 张参考图（`references/images/`，含 Patrick Bloom 的 Marathon 贴花表 ArtStation 作品）。元素拆解见 `references/decal-language.md`，取色见 `references/palette.md`，生成样例见 `references/samples/`。

## 1. 什么时候用
- 需要给 UI、海报、3D 道具、贴图、网页背景铺 Marathon 风格的"功能性装饰"。
- 需要一整张贴花表（sheet，四种版式见第 4 节）、某一类符号的批量变体（kind）、或一个词的多种字体处理（variants）。
- 网页 UI 本身用 `marathon-ui-style` skill；本库负责装饰物和贴花，两者可以一起用。

## 2. 快速开始
文件都在本 skill 目录内：
- `assets/decals.ts`：生成器本体，零依赖，Node 22+ 可直接运行 `.ts`，也可被任何打包器引入。
- `assets/Decal.tsx`：React 包装（`<Decal>`、`<DecalText>`、`<DecalSheet>`）。
- `scripts/decal-sheet.ts`：命令行。

```bash
# 整张贴花表，默认黑底白图（SVG，加 --png 再导出 PNG，需要 playwright-core 或 playwright）
node scripts/decal-sheet.ts --mode sheet --seed 7 --out out/sheet.svg --png
# 道具稿 / 符号图集 / 封条带版式
node scripts/decal-sheet.ts --mode sheet --layout prop --seed 5 --out out/prop.svg --png
node scripts/decal-sheet.ts --mode sheet --layout atlas --seed 3 --out out/atlas.svg --png
node scripts/decal-sheet.ts --mode sheet --layout bands --seed 1 --out out/bands.svg --png
# 白底黑图 / 透明底 / 4096 宽高清
node scripts/decal-sheet.ts --mode sheet --layout prop --seed 5 --mask black --out out/prop-black.svg --png
node scripts/decal-sheet.ts --mode sheet --layout prop --seed 5 --transparent --out out/prop-alpha.svg --png
node scripts/decal-sheet.ts --mode sheet --layout atlas --seed 3 --scale 2 --out out/atlas-4k.svg --png
# 彩色稿：指定调色板就不再强制黑白
node scripts/decal-sheet.ts --mode sheet --layout prop --palette lab --seed 5 --out out/prop-lab.svg --png
# 某一类的 12 个变体
node scripts/decal-sheet.ts --mode kind --kind glyphDisc --count 12 --seed 3 --out out/glyphs.svg
# 一个词的全部文字变体
node scripts/decal-sheet.ts --mode variants --text "SEAL 014" --out out/variants.svg
# 所有种类和图标的索引页
node scripts/decal-sheet.ts --mode catalog --out out/catalog.svg
```
参数：`--mode sheet|kind|variants|catalog`、`--layout flow|prop|atlas|bands`、`--kind`、`--palette`（不传就是黑白）、`--mask white|black`、`--seed`、`--count`、`--rows`、`--cell`、`--text`、`--w`、`--footer`、`--no-footer`、`--out`、`--png`、`--transparent`、`--scale <倍数>`、`--chromium <路径>`（或环境变量 `CHROMIUM_PATH`）、`--no-fonts`（不嵌入 Google Fonts）、`--help`。

```ts
import { make, toSvg, textVariant, sheet } from "./assets/decals.ts";
const svg = toSvg(make("glyphDisc", { seed: 4, palette: "mono" }), { background: true, palette: "mono" });
const word = toSvg(textVariant({ text: "ATTACH", variant: "stencil", size: 64 }));
const prop = toSvg(sheet({ layout: "prop", palette: "medic", seed: 8 }), { background: true, palette: "medic" });
const mask = toSvg(sheet({ layout: "prop", palette: "mask", seed: 5, footer: false }), { background: true, mask: "white" });
```

```tsx
import { Decal, DecalText, DecalSheet } from "./assets/Decal.tsx";
<Decal kind="barcode" seed={12} palette="signal" digits />
<DecalText text="SEAL 014" variant="codeSplit" size={40} />
<DecalSheet seed="s3" palette="lab" layout="prop" />
<DecalSheet seed={5} palette="mask" layout="prop" mask="white" />
```
React 组件通过 `dangerouslySetInnerHTML` 注入生成的 SVG；所有文本在 `decals.ts` 里已经做了 XML 转义。

## 3. 给 3D 软件用（默认黑白）
命令行不传 `--palette` 时用 `mask` 调色板，再把 SVG 里每个颜色二值化：

- **白 = 贴花，黑 = 空**。只有 #FFFFFF 和 #000000 两种颜色，没有灰色和半透明；PNG 里只有抗锯齿边缘是中间灰。
- 不画底部绿条和页码（要的话加 `--footer`）。
- 原本靠颜色区分的地方都改成形状：未点亮的 LED 是空心圈，开关钮、色块里的字、色带分隔符自动反成黑色，像素格用 `crispEdges` 渲染，拼接处没有灰缝。
- 元素之间留着间隔，方便在 3D 软件里按 UV 裁切。

三种出法：

| 需要 | 参数 | 结果 |
|---|---|---|
| 遮罩 / 不透明度贴图 | 默认（`--mask white`） | 黑底白图 |
| 白底黑图（打印、正片叠底） | `--mask black` | 白底黑图 |
| 直接当贴花图层 | `--transparent` | 白图 + 透明底 PNG，亮度转成 alpha，边缘保留抗锯齿；配 `--mask black` 是黑图 + 透明底 |

- 分辨率：默认宽度 1600（flow）、1920（prop）、2048（atlas / bands），`--scale 2` 输出两倍像素，例如 atlas 是 4096 宽。SVG 本身是矢量，可以在 Illustrator 或 Inkscape 里按任意尺寸导出。
- Blender：把 PNG 接到 Principled BSDF 的 Alpha，或当 Mix Shader 的系数，在着色器里给颜色。Substance Painter：拖进 Shelf 当 alpha 或 stencil，在填充层的 mask 里用。Unreal：贴花材质的 Opacity 接 R 通道，Blend Mode 选 Translucent 或 Masked。
- 颜色在 3D 软件里给，一张黑白图可以复用成任何配色。
- 指定了彩色 `--palette` 又想要黑白时，加 `--mask` 也会二值化：接近前景色的部分归白，接近底色的归黑。
- 代码里：`sheet({ palette: "mask", footer: false })` 配 `toSvg(d, { mask: "white" | "black" })`；React 组件都接受 `mask` 属性。
- 样例：`references/samples/mask-prop.png`、`mask-atlas.png`、`mask-bands.png`、`mask-flow.png`、`mask-prop-black.png`。

## 4. 整张贴花表的四种版式（`sheet({ layout })`）
| layout | 对应参考图 | 构图 | 默认尺寸 | 底部绿条 |
|---|---|---|---|---|
| `flow`（默认） | 01、03 | 各种元素按行密排，大小按种类分档 | 1600 宽，60 个 | 有 |
| `prop` | 06、08 | 12 栏网格上放十几个元素：2–3 个主角（描边大字 M、像素箭头对、色块组、嵌套方框按钮）、几个中号（细体编码、数码管数字、按键），其余是小号编码和准星；按元素宽高比挑格子，约 40% 留白；左下角有 `MEDIC DECALS_PG_2` 这类页码 | 1920 宽，7 行，14 个 | 有 |
| `atlas` | 02、05 | 小格子密排上百个图标、按钮、编号块，先散放规格表、序列号、警示语、抖动块等多格元素；底部一行压缩长串编码和一行 A–Z Ø–9 字母表 | 2048 宽，92px 格，14 行 | 无 |
| `bands` | 10 | 通栏条带自上而下堆叠：开头 3–4 条灰底重复字带（LINK / ATTACH / ▪ATTACH HERE / SEAL-SEAL），之后随机组合彩色字带、胶囊字带、日期戳色条、两个胶囊标签、刷痕胶带、齿条、绿色色条、长串编码、散点标注区、条码行，最后一条箭头带 | 2048 宽，12 条 | 无 |

```ts
sheet({ layout: "prop", palette: "lab", seed: 5 });                 // 武器道具稿
sheet({ layout: "prop", palette: "medic", seed: 8, count: 18 });    // 元素更多一点
sheet({ layout: "atlas", palette: "mono", rows: 18, cell: 80 });    // 更密的图集
sheet({ layout: "bands", palette: "hazard", count: 14, footer: { left: "KAVEX LOGISTICS" } });
sheet({ layout: "prop", kinds: ["bigType", "thinCode", "reticle", "pixelArrow"] }); // 限定元素种类
```
- `count`：flow 是元素数，prop 是元素数，bands 是条带数；atlas 用 `rows` × `cell` 决定密度。
- `footer`：flow 和 prop 默认带酸性绿底条，atlas 和 bands 默认不带；传 `false` 关掉，传 `{ left, right, color, ink, label }` 改文字和颜色（`label` 是 prop 左下角页码）。
- 搭配建议：prop 用 `lab`、`medic`、`mono`；atlas 用 `mono`、`atlas`；bands 用 `hazard`、`signal`。效果见 `references/samples/prop-lab.png`、`prop-medic.png`、`atlas-mono.png`、`atlas-atlas.png`、`bands-hazard.png`，flow 版式是 `sheet-*.png`。

## 5. 调色板（`PALETTES`）
| 名称 | 底 / 前景 | 用途 | 来源 |
|---|---|---|---|
| `mask` | 纯黑 / 纯白，没有灰 | 命令行默认，给 3D 软件当遮罩（第 3 节） | — |
| `mono` | 黑 / 白 | 代码默认，符号表、字标 | 参考图 01–04 |
| `ink` | 白 / 黑 | 亮底印刷、文档 | 反相 |
| `lab` | 浅灰 #C4C4C4 / 深灰 | 道具贴花表，红橙+青绿+橄榄强调 | 参考图 06、09 |
| `signal` | 黑 / 酸性绿 #C0FE0F | 品牌强调、HUD | 官网主色 |
| `medic` | 白 / 炭黑 | 医疗道具，黄+紫+钴蓝 | 参考图 07、08 |
| `atlas` | 深海军蓝 #003A54 / 白 | 道具图集，八种荧光色 | 参考图 05 |
| `hazard` | 黑 / 白 | 封条带、警示，橙红+黄绿+洋红 | 参考图 10 |

也可以传自定义 `{ bg, fg, muted, accents[] }`。

## 6. 种类（`KINDS`，`make(kind, opts)`）
所有生成器都接受 `seed` 和 `palette`；未指定的参数由 seed 随机决定。

| kind | 是什么 | 常用参数 |
|---|---|---|
| `glyphDisc` | 圆/方底上的粗块字形（参考 01 的大圆标） | `shape: circle\|square\|round`、`tile`、`size` |
| `pixelArrow` | 像素阶梯箭头 | `dir: up\|down\|left\|right\|upRight`、`cell`、`length` |
| `chevrons` | 连续箭头 ▶▶▶ | `count`、`style: solid\|line\|half` |
| `barcode` | 条码（可带数字） | `bars`、`height`、`digits` |
| `stripes` | 斜纹警示带 | `w`、`h`、`band`、`angle`、`ground` |
| `checker` / `globe` | 棋盘格 / 球面棋盘 | `cols`、`rows`、`cell` |
| `dither` | 像素抖动渐隐块 | `fade: right\|left\|none` |
| `reticle` | 准星、套准标、靶心 | `variant: plus\|crossCircle\|target\|tickRing\|register\|pip` |
| `dotMatrix` | 点阵/加号阵/叉阵 | `mark: dot\|square\|plus\|x` |
| `blockMark` | 对称像素块徽记 | `grid`、`round` |
| `bracketFrame` | 四角取景框，可嵌套其他贴花 | `inner`、`arm` |
| `ruler` | 刻度尺，带 R−/R+ 标注 | `ticks`、`labels` |
| `icon` | 24 个基础图形（见 `ICONS`） | `name`、`ground` |
| `codeBox` | 色块编号盒（大号码 / 分栏 / 叠字） | `variant: big\|split\|stack` |
| `tape` | 手撕胶带 / 刷痕色块 | `w`、`h` |
| `serialBlock` | 多行序列号 | `lines`、`style`（`codes` 里的格式） |
| `specTable` | 材料规格表（Property / Unit / 值 / 公差） | `rows` |
| `warningLabel` | NOTICE / WARNING 文字块 | `kind`、`icon` |
| `repeatBand` | SEAL-SEAL-SEAL 重复带 | `word`、`sep`、`pill`、`mark` |
| `pillTag` | 胶囊编号标签 ⊖→ 008.A | `code`、`dot`、`arrow`、`end` |
| `stackBadge` | 方块里两行叠字 | `lines` |
| `lockup` | 大字标 + Rc. 日期 + 竖排编号 + 数据栏（参考 04） | `text`、`stamp` |
| `pixelText` | 5×7 像素字 | `text`、`cell` |
| `segmentText` | 七段数码管字 | `text`、`height`、`slant` |
| `thinCode` | 细体大号编码：`+ Sbr130 **+`、`(·)( Sb 021a821)`、带上划线的 `Mq EXC —`、三行数字竖排、`R 0001 -02Q 000 R`（参考 06、08） | `variant: line\|bracket\|overbar\|stack\|range`、`text`、`size`、`weight` |
| `bigType` | 超大字形：粗描边拼成的 M / W / A / N、大号细体数字（可带下划粗条，如 S8）、粗斜体（Q4）、细描边字母 | `variant: stroke\|numeral\|italic\|outline`、`text`、`size` |
| `button` | 小型硬件部件：键帽、拨动开关、LED 灯排、加号按钮、胶囊键、数字圆点、旋钮、嵌套方框插座（参考 05、06） | `variant: key\|toggle\|led\|plus\|pill\|dots\|knob\|socket`、`label` |
| `tileGroup` | 彩色方块组，块内放字母代码、像素徽记、圆环或小读数（参考 08 的 Mn 色块） | `cols`、`rows`、`cell` |

`ICONS`：drop, bowtie, dShape, square, circle, ring, pill, roundRect, plusSquare, xSquare, triangleUp, triangleDown, arrowUp, arrowDown, peanut, splitDiamond, brackets, bolt, hazard, asterisk, steps, tab, keyhole, hexNut。

## 7. 文字变体（`TEXT_VARIANTS`）
`plain` `wide` `mono` `display` `outline` `inverted` `bracket` `overbar` `underbar` `stacked` `vertical` `mirrored` `spaced` `slashedZero` `strike` `stencil` `distressed` `pixel` `segment` `boxed` `codeSplit`

`textVariant({ text, variant, size, color, seed, palette })` 出单个，`variantSheet({ text, size, variants, cols })` 出对比表。效果见 `references/samples/variants-ink.png`。

## 8. 字体
生成的 SVG 用 CSS 字体栈，原版字体装在本机时优先生效，否则落到免费替代：
- display：KH Interference → Chakra Petch
- wide：Shapiro Wide → Archivo（font-stretch 125%）
- mono：Fraktion Mono → JetBrains Mono
- grotesk：Neue Haas Grotesk Display → Inter；serif：IvyPresto Headline → Instrument Serif

`toSvg(d, { embedFonts: true })` 会在 SVG 里 `@import` Google Fonts，保证脱离网页也能渲染；导出 PNG 时 CLI 默认开启。宽度用 `textLength` 锁定，换字体也不会撑破版式。

## 9. 构图规则（从参考图总结）
1. **一张表只用一套调色板**：中性底 + 前景色占 80%，强调色只点在 10–20% 的元素上。
2. **大小对比要狠**：一两个大字标或大圆标，配几十个小号码、小图标、细线条。
3. **数据当装饰**：每组图形旁边配编号、批次、日期、`//`、`R−/R+`，内容可以无意义，但格式要像真的。
4. **重复制造节奏**：重复带、连续箭头、点阵、刻度尺横向铺满，打断大块。
5. **硬边优先**：直角、切角、像素阶梯。圆形只用于圆标和胶囊。
6. **做旧要克制**：`distressed`、`tape` 一张表用一两次就够。
7. **底部品牌条**：彩色稿的 flow 和 prop 版式默认在底部放酸性绿条（虚构公司名 + 条码 + 编号），可用 `footer: false` 关掉；黑白输出默认不带。
8. **按用途选版式**：要给一件道具配贴花用 `prop`，要一套品牌符号库用 `atlas`，要封条、胶带、管线标签用 `bands`。

## 10. 扩展
新增一种贴花：在 `decals.ts` 写 `function myKind(o: Base & {...}): Decal`，返回 `{ kind, w, h, body }`（`body` 是不带外层 `<svg>` 的 SVG 片段，坐标从 0,0 起），然后：
1. 加进 `KINDS`；
2. 在 `SHEET_FIT` 写它在 flow 表里的相对高度，在 `SHEET_WEIGHT` 写出现频率；想让它进 prop 或 atlas 版式，再加进 `PROP_POOL`（hero / mid / small 三档）或 `ATLAS_SMALL` / `ATLAS_BLOCKS`；
3. 随机数只用传进来的 `rng(seed)`，保证可复现；文字一律经过 `esc()`。

## 11. 版权与命名
- 生成器里的公司名（`corpName`）、型号、编号全部是随机拼出来的虚构内容。**不要**复刻 Bungie、Marathon、UESC、NuCaloric 等真实标志或商标。
- `references/images/` 里的图只用于研究风格，不要直接拿去当素材发布；其中 06–08 是 Patrick Bloom 在 ArtStation 发布的作品（文件名 `pb-brrt-smg-00N`、`pb-medic-0N` 是他的作品编号，不是贴花上的文字），引用时注明作者。
- 2025 年 Bungie 承认 Marathon 测试版里有一批贴花抄袭了独立艺术家的作品并撤换。生成时只用通用的几何、编号和排版手法，不要临摹任何具体艺术家的图形；该艺术家常用的 "Aleph" 一词也不要用。
