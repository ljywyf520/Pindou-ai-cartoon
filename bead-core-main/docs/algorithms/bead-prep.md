# 拼豆专用图（createBeadPrepPixels）

**源文件：** `src/prep/beadPrep.ts`、`src/prep/imageAnalysis.ts`、`src/prep/prepParams.ts`

## 作用

将普通 RGBA 照片转为**拼豆专用参考图**（大色块、硬边缘、少渐变），作为二次像素化前的中间输入。输出不是 `MappedGrid`，也不做色板匹配。

与 `runPipeline` 的关系：

```
原图 → createBeadPrepPixels → 专用图（1 像素 = 1 格）→ runPipeline → 图纸
```

## 主入口

```typescript
createBeadPrepPixels(pixels, width, height, maxGrid): BeadPrepResult
```

### 输出（BeadPrepResult）

| 字段 | 说明 |
|------|------|
| `pixels` | 简化后的 RGBA |
| `width` / `height` | 专用图像素尺寸 |
| `gridWidth` / `gridHeight` | 与像素尺寸相同，供 1:1 格数 |
| `colorCount` | 实际主色数量 |

## 内部流程

```
analyzeImageContent           照片/卡通识别
        ↓
computePrepTargetDimensions   按复杂度计算目标像素尺寸
        ↓
prepareSourcePixels           降噪/锐化/对比度
        ↓
computeEdgeMap (Sobel)        轮廓保护
        ↓
downscaleDominantProgressive  边缘加权主导色降采样
        ↓
extractImportantColors        面积+轮廓加权主色
        ↓
kMeansQuantizeWithSeeds       确定性量化
        ↓
applyPalette + smoothInteriorOnly（仅平滑内部）
```

## 参数辅助（prepParams.ts）

| 函数 | 说明 |
|------|------|
| `computePrepTargetDimensions` | 目标短边 80–220px，受 `maxGrid` 约束 |
| `suggestPrepColorCount` | 自适应色数预算 8–32 |
| `suggestGridWidthForPrepImage` | 二次出图格宽 = 图像像素宽 |
| `suggestPrepMergeThreshold` | 按专用图色数建议合并阈值 |

## 设计约束

- **重要颜色不丢**：主色直方图优先保留大面积色与轮廓色
- **大体轮廓不变**：Sobel 边缘加权降采样 + 边缘像素不平滑
- **不做色板匹配**：配色留给后续 `runPipeline`

## 相关文档

- [adjust-pixels.md](./adjust-pixels.md)
- [resample.md](./resample.md)
- [suggest-params.md](./suggest-params.md)（消费方二次出图参数）
