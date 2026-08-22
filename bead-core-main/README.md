# @wangdandan810012/bead-core

蛋蛋拼豆核心算法库 — 将 RGBA 像素图转换为拼豆色号网格，支持 CIEDE2000 感知配色、区域合并、背景识别、拼豆专用预处理与编辑工具。

- **零运行时依赖**，不绑定 UI 框架
- 可在 **Node.js ≥ 18** 或 **浏览器** 中使用
- 本包为 **ESM**：`package.json` 请设置 `"type": "module"`，或在 TypeScript 中使用 `"module": "ESNext"`
- 在线演示：<https://dandanpindou.netlify.app>
- 站内使用介绍：<https://dandanpindou.netlify.app/bead-core>

## 目录

1. [安装](#安装)
2. [核心概念](#核心概念)
3. [快速开始（端到端）](#快速开始端到端)
4. [读取图片](#读取图片)
5. [runPipeline 参数](#runpipeline-参数)
6. [分步调用](#分步调用)
7. [图像预处理](#图像预处理)
8. [拼豆专用 Prep](#拼豆专用-prep)
9. [编辑与统计](#编辑与统计)
10. [API 一览](#api-一览)
11. [与 Pindou 网页的关系](#与-pindou-网页的关系)
12. [FAQ](#faq)

## 安装

```bash
npm install @wangdandan810012/bead-core
```

本地与 [pindou-web](https://github.com/whr810012/pindou) 联调时可用：

```bash
npm install file:../bead-core
```

---

## 核心概念

### 色板 `PaletteEntry[]`

库**不内置色板**，由调用方传入。每个色号含唯一 ID、显示色值，以及各品牌豆号：

```typescript
import type { PaletteEntry } from '@wangdandan810012/bead-core'

const palette: PaletteEntry[] = [
  {
    id: 'red-01',
    hex: '#E74C3C',
    codes: { MARD: 'A1', COCO: 'A1', MANMAN: 'A1', PANPAN: 'A1', MIXIAOWO: 'A1' },
  },
  {
    id: 'blue-01',
    hex: '#3498DB',
    codes: { MARD: 'B1', COCO: 'B1', MANMAN: 'B1', PANPAN: 'B1', MIXIAOWO: 'B1' },
  },
  {
    id: 'neutral-001',
    hex: '#FFFFFF',
    codes: { MARD: 'H1', COCO: 'H1', MANMAN: 'H1', PANPAN: 'H1', MIXIAOWO: 'H1' },
  },
]
```

`codes` 的键为 `BrandSystem`：`MARD` | `COCO` | `MANMAN` | `PANPAN` | `MIXIAOWO`。不使用某品牌时填空字符串即可。

### 像素数据

所有图像输入均为 **RGBA** 的 `Uint8ClampedArray`，长度 = `width × height × 4`，按行优先排列（与 Canvas `ImageData.data` 一致）。

### 输出网格 `MappedGrid`

二维数组 `MappedCell[][]`：

| 字段 | 说明 |
|------|------|
| `paletteId` | 匹配到的色板 ID |
| `hex` | 显示用十六进制色值 |
| `isExternal` | 可选；为 `true` 时表示外部背景，不计入拼豆数量，编辑时会跳过 |

工具函数：`cloneGrid(grid)`、`gridDimensions(grid)`。

---

## 快速开始（端到端）

完整流程：**准备迷你色板 → 构造/读取像素 → 预处理 → 生成图纸 → 裁边 → 统计**。

```typescript
import {
  prepareSourcePixels,
  runPipeline,
  computeColorStats,
  countTotalBeads,
  trimGrid,
  type PaletteEntry,
  type BrandSystem,
} from '@wangdandan810012/bead-core'

const palette: PaletteEntry[] = [
  {
    id: 'red-01',
    hex: '#E74C3C',
    codes: { MARD: 'A1', COCO: 'A1', MANMAN: 'A1', PANPAN: 'A1', MIXIAOWO: 'A1' },
  },
  {
    id: 'neutral-001',
    hex: '#FFFFFF',
    codes: { MARD: 'H1', COCO: 'H1', MANMAN: 'H1', PANPAN: 'H1', MIXIAOWO: 'H1' },
  },
]

// 示例：2×2 纯红块（实际项目请用 Canvas / sharp 读图，见下文）
const width = 2
const height = 2
const pixels = new Uint8ClampedArray([
  231, 76, 60, 255, 231, 76, 60, 255,
  231, 76, 60, 255, 231, 76, 60, 255,
])

const adjusted = prepareSourcePixels(
  pixels,
  width,
  height,
  { brightness: 0, contrast: 12, saturation: 0 },
  { denoise: false, sharpen: true },
)

const { grid, width: gridW, height: gridH } = runPipeline(adjusted, width, height, {
  gridWidth: 2,
  mode: 'average',
  mergeThreshold: 0,
  maxColors: 0,
  palette,
  backgroundPaletteIds: ['neutral-001'],
  excludedPaletteIds: [],
})

const trimmed = trimGrid(grid)
const brand: BrandSystem = 'MARD'
const stats = computeColorStats(trimmed, brand, (paletteId, b) => {
  const entry = palette.find((p) => p.id === paletteId)
  return entry?.codes[b] ?? paletteId
})

console.log(`网格 ${gridW}×${gridH}，共 ${countTotalBeads(trimmed)} 颗豆`)
console.log(stats)
```

---

## 读取图片

### 浏览器：Canvas

```typescript
import { runPipeline, type PaletteEntry } from '@wangdandan810012/bead-core'

async function imageToGrid(imageUrl: string, palette: PaletteEntry[]) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = imageUrl
  await img.decode()

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  return runPipeline(data, width, height, {
    gridWidth: 64,
    mode: 'average',
    mergeThreshold: 0,
    maxColors: 0,
    palette,
    backgroundPaletteIds: [],
    excludedPaletteIds: [],
  })
}
```

### Node.js：sharp

Node 本身不解码图像，需自行安装 `sharp`（**不是**本库依赖）：

```bash
npm install sharp
```

```typescript
import sharp from 'sharp'
import { runPipeline, type PaletteEntry } from '@wangdandan810012/bead-core'

async function fileToGrid(filePath: string, palette: PaletteEntry[]) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return runPipeline(new Uint8ClampedArray(data), info.width, info.height, {
    gridWidth: 64,
    mode: 'average',
    mergeThreshold: 0,
    maxColors: 0,
    palette,
    backgroundPaletteIds: [],
    excludedPaletteIds: [],
  })
}
```

---

## runPipeline 参数

`runPipeline` 按以下顺序执行（`flatTile: true` 时跳过合并）：

```
convertImageToPattern
  → (!flatTile) mergeSimilarRegions
  → (maxColors > 0) limitGridColors
  → markExternalBackground
  → remapExcludedColors
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `gridWidth` | `number` | 输出网格列数；行数 = `round(gridWidth × 原图高 / 原图宽)` |
| `mode` | `'average' \| 'dominant'` | 照片用 `average`；卡通/像素风用 `dominant` |
| `mergeThreshold` | `number` | CIEDE2000 色差阈值，合并相邻相似色块；`0` 关闭 |
| `maxColors` | `number` | 限制最终颜色种类；`0` 不限 |
| `palette` | `PaletteEntry[]` | 可用色板，不能为空 |
| `backgroundPaletteIds` | `string[]` | 从四边洪泛，标记为 `isExternal: true` |
| `excludedPaletteIds` | `string[]` | 排除色号，重映射到色板中最近色 |
| `flatTile` | `boolean?` | 为 `true` 时：不做预处理合并路径上的相似色合并，适合「一像素一豆」的 prep 结果 |

返回 `{ grid, width, height }`。

配色时库内部使用 CIEDE2000；对外可用 `colorDistance(rgb1, rgb2)` 与 `findClosestPaletteEntry(rgb, palette)`。

---

## 分步调用

不需要完整流水线时，可单独调用：

```typescript
import {
  convertImageToPattern,
  mergeSimilarRegions,
  markExternalBackground,
  limitGridColors,
  remapExcludedColors,
} from '@wangdandan810012/bead-core'

let grid = convertImageToPattern(pixels, width, height, {
  gridWidth: 64,
  mode: 'dominant',
  palette,
  excludedPaletteIds: [],
  despeckle: false, // 去除孤立杂点（仅 average 模式）
  flatTile: false,
})

grid = mergeSimilarRegions(grid, 5)
grid = limitGridColors(grid, palette, 20)
grid = markExternalBackground(grid, ['neutral-001'])
grid = remapExcludedColors(grid, palette, ['old-color-id'])
```

`mapImageToGrid` 是 `convertImageToPattern` 的别名。

---

## 图像预处理

在进流水线前可选调节源图：

```typescript
import {
  prepareSourcePixels,
  applyImageAdjustments,
  applyPhotoOptimize,
  DEFAULT_IMAGE_ADJUST,
  DEFAULT_PHOTO_OPTIMIZE,
} from '@wangdandan810012/bead-core'

const adjusted = prepareSourcePixels(
  pixels,
  width,
  height,
  { ...DEFAULT_IMAGE_ADJUST, contrast: 12 },
  { ...DEFAULT_PHOTO_OPTIMIZE, sharpen: true },
)

// 也可分步：
const step1 = applyImageAdjustments(pixels, width, height, DEFAULT_IMAGE_ADJUST)
const step2 = applyPhotoOptimize(step1, width, height, DEFAULT_PHOTO_OPTIMIZE)
```

| `ImageAdjust` | 含义 |
|---------------|------|
| `brightness` | 亮度偏移 |
| `contrast` | 对比度 |
| `saturation` | 饱和度 |

| `PhotoOptimize` | 含义 |
|-----------------|------|
| `denoise` | 降噪 |
| `sharpen` | 锐化 |

---

## 拼豆专用 Prep

将照片转为「大色块、硬边缘」的中间图，再按 **一像素一豆** 进流水线（通常配合 `flatTile: true`）：

```typescript
import {
  createBeadPrepPixels,
  createPixelArtPrepPixels,
  runPipeline,
  type PaletteEntry,
} from '@wangdandan810012/bead-core'

// 拼豆专用图（推荐日常照片）
const prep = createBeadPrepPixels(pixels, width, height, 80)
// prep.pixels / prep.width / prep.height / prep.gridWidth / prep.gridHeight

const { grid } = runPipeline(prep.pixels, prep.width, prep.height, {
  gridWidth: prep.gridWidth,
  mode: 'dominant',
  mergeThreshold: 0,
  maxColors: 0,
  palette,
  backgroundPaletteIds: [],
  excludedPaletteIds: [],
  flatTile: true,
})

// 经典像素风中间图
const pixelArt = createPixelArtPrepPixels(pixels, width, height, 64)
```

辅助分析与建议（可选）：

- `analyzeImageContent` / `isDetailSensitiveCartoon` / `countDistinctColors`
- `computePrepTargetDimensions` / `suggestPrepColorCount` / `suggestGridWidthForPrepImage` / `suggestPrepMergeThreshold`

算法细节见 [docs/algorithms](./docs/algorithms/README.md)。

---

## 编辑与统计

所有编辑函数返回**新网格**（不可变），不修改入参；起点为 `isExternal` 或区域内 external 格会被跳过。

```typescript
import {
  fillRegion,
  paintRect,
  trimGrid,
  flipGridHorizontal,
  flipGridVertical,
  cloneGrid,
  computeColorStats,
  countTotalBeads,
  countCompleted,
  getConnectedRegions,
} from '@wangdandan810012/bead-core'

grid = fillRegion(grid, row, col, 'red-01', '#E74C3C')
grid = paintRect(grid, row0, col0, row1, col1, 'blue-01', '#3498DB')
grid = trimGrid(grid)
grid = flipGridHorizontal(grid)
grid = flipGridVertical(grid)
const copy = cloneGrid(grid)

const stats = computeColorStats(grid, 'MARD', codeLookup)
const total = countTotalBeads(grid)
const done = countCompleted(grid, new Set(['0,0', '1,2']))
const regions = getConnectedRegions(grid, 'red-01')
```

---

## API 一览

与 `src/index.ts` 公开导出对齐：

| 分类 | 导出 | 说明 |
|------|------|------|
| 流水线 | `runPipeline` | 完整生成流程 |
| 转换 | `convertImageToPattern` / `mapImageToGrid` | 图片 → 网格 |
| 预处理 | `prepareSourcePixels` / `applyImageAdjustments` / `applyPhotoOptimize` | 源图调节 |
| 预处理 | `DEFAULT_IMAGE_ADJUST` / `DEFAULT_PHOTO_OPTIMIZE` | 默认参数 |
| Prep | `createBeadPrepPixels` / `createPixelArtPrepPixels` | 拼豆 / 像素风中间图 |
| Prep | `analyzeImageContent` 等 suggest 系列 | 内容分析与尺寸建议 |
| 合并 | `mergeSimilarRegions` | 相似色区域合并 |
| 背景 | `markExternalBackground` | 外部背景洪泛标记 |
| 限色 | `limitGridColors` | 限制最大颜色数 |
| 重映射 | `remapExcludedColors` | 排除色重映射 |
| 编辑 | `fillRegion` / `paintRect` / `normalizeRect` | 填充 / 矩形上色 |
| 编辑 | `trimGrid` / `flipGridHorizontal` / `flipGridVertical` | 裁边 / 翻转 |
| 工具 | `cloneGrid` / `gridDimensions` | 克隆 / 尺寸 |
| 统计 | `computeColorStats` / `countTotalBeads` / `countCompleted` / `getConnectedRegions` | 统计与分区 |
| 色彩 | `colorDistance` / `findClosestPaletteEntry` / `filterActivePalette` | CIEDE2000 色差与匹配 |
| 色彩 | `hexToRgb` / `rgbToHex` | 颜色转换 |
| 类型 | `PaletteEntry`、`MappedGrid`、`PipelineOptions`、`BeadPrepResult` 等 | TypeScript 类型 |

完整算法说明：[docs/algorithms](https://github.com/whr810012/bead-core/blob/main/docs/algorithms/README.md)。

---

## 与 Pindou 网页的关系

- [Pindou](https://dandanpindou.netlify.app) 在浏览器中调用同一套算法完成「上传 → 生成 → 精修 → 导出」。
- 色板、UI、项目存储由网页层负责；核心只处理像素与网格。
- 站内可对实现对照：主流水线封装、精修编辑工具、拼豆 prep。
- 许可证：MIT。

---

## FAQ

**适合什么场景？**  
需要把图片转成拼豆色号网格的 Web、小程序、Node 批处理；库不含 UI。

**有没有内置色板？**  
没有。请自备 `PaletteEntry[]`（可用自有品牌色号或开源色板数据）。

**如何安装？**  
`npm install @wangdandan810012/bead-core`。

**算法细节在哪？**  
仓库 [`docs/algorithms`](./docs/algorithms/README.md)。

**许可证？**  
MIT — 见 [LICENSE](./LICENSE)。

---

## 开发

```bash
git clone https://github.com/whr810012/bead-core.git
cd bead-core
npm install
npm test        # 运行测试
npm run build   # 编译到 dist/
```

## License

MIT — Copyright (c) 2026 蛋蛋 — 见 [LICENSE](./LICENSE)。

## 致谢

算法思路受以下开源项目启发（本库为独立 TypeScript 实现）：

- [Zippland/perler-beads](https://github.com/Zippland/perler-beads)
- [liangdabiao/perler-beads-ai](https://github.com/liangdabiao/perler-beads-ai)
