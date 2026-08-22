# 像素风中间图（createPixelArtPrepPixels）

**源文件：** `src/prep/pixelArtPrep.ts`

## 作用

将普通 RGBA 照片转为**经典最近邻像素风**中间图（块状、硬边），作为二次像素化前的输入。输出不是 `MappedGrid`，也不做色板匹配。

与 `createBeadPrepPixels` 的差异：

| | 拼豆专用图 | 像素风 |
|--|--|--|
| 降采样 | 边缘加权主导色 + 渐进缩小 | 纯最近邻格心采样 |
| 限色 | K-means 量化 | 无 |
| 平滑 | 仅平滑内部区域 | 无 |

与 `runPipeline` 的关系：

```
原图 → createPixelArtPrepPixels → 像素风图（1 像素 = 1 格）→ runPipeline → 图纸
```

## 主入口

```typescript
createPixelArtPrepPixels(pixels, width, height, maxGrid): BeadPrepResult
```

### 输出（BeadPrepResult）

与 [bead-prep.md](./bead-prep.md) 相同：`pixels`、`width`/`height`、`gridWidth`/`gridHeight`、`colorCount`。

## 内部流程

```
analyzeImageContent           照片/卡通识别
        ↓
computePrepTargetDimensions   目标像素尺寸（与拼豆专用图相同尺度）
        ↓
analyzeFeatureColors           识别眼睛/腮红/项圈等稀有色
dilateTinyFeatures             微小特征 1px 膨胀
downscaleFeatureAware          特征色优先降采样
```

## 设计约束

- **经典像素观感**：不做锐化、降噪、K-means 或内部平滑
- **1:1 出图**：每个输出像素对应后续一格
- **不做色板匹配**：配色留给 `runPipeline`

## 相关文档

- [bead-prep.md](./bead-prep.md)
- [resample.md](./resample.md)
- [suggest-params.md](./suggest-params.md)（消费方二次出图参数）
