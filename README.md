# Marathon UI

游戏风格 UI 设计资源，做成 Claude Code skill。在这个仓库里打开 Claude Code，下面三个 skill 会自动加载。

| Skill | 用途 |
|---|---|
| [`marathon-ui-style`](.claude/skills/marathon-ui-style/SKILL.md) | Bungie《Marathon》（2026）风格的网页 / 应用 UI：酸性绿 + 黑 / 骨白、宽体科技字、等宽数据标签。含 React 组件库。 |
| [`arc-raiders-ui-style`](.claude/skills/arc-raiders-ui-style/SKILL.md) | Embark《ARC Raiders》风格的网页 / 应用 UI。含 React 组件库。和 Marathon 风格完全分开。 |
| [`marathon-decal-kit`](.claude/skills/marathon-decal-kit/SKILL.md) | 生成 Marathon 风格的贴花、符号、标签和文字变体，整张贴花表有 flow / prop（道具稿）/ atlas（符号图集）/ bands（封条带）四种版式（SVG / PNG / React）。默认输出纯黑白，直接给 3D 软件当遮罩用。 |

每个 skill 目录的结构：

```
SKILL.md        规范和用法
assets/         可直接复制进项目的代码（CSS、React 组件、生成器）
references/     调研笔记、取色、参考图、效果截图
scripts/        命令行工具（仅 decal kit）
```

## 本地开发

```bash
npm install
npm run typecheck                 # TypeScript strict 检查所有 skill 代码
npm run demos                     # 打包各 skill 的示例页到 out/demos/
CHROMIUM_PATH=... npm run shots   # 桌面 1280px / 手机 390px 截图到 out/shots/，并检查报错和横向溢出
npm run decals -- --mode sheet --layout prop --seed 5 --png               # 黑底白图（默认）
npm run decals -- --mode sheet --layout prop --seed 5 --transparent --png # 透明底
npm run decals -- --mode sheet --layout prop --palette lab --seed 5 --png # 彩色稿
```

## 版权

本仓库是风格研究和复刻工具，不包含也不应加入 Bungie、Embark 的官方标志或素材。`references/` 里的截图和参考图只用于研究，版权归原作者。
