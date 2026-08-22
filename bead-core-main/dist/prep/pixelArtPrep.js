import { cellBounds } from '../conversion/cellBounds.js';
import { analyzeFeatureColors, dilateTinyFeatures, sampleCellFeatureAware, } from '../conversion/featureSample.js';
import { analyzeImageContent, countDistinctColors, isDetailSensitiveCartoon, } from './imageAnalysis.js';
import { computePrepTargetDimensions } from './prepParams.js';
function readOpaqueRgb(pixels, imgWidth, x, y) {
    if (x < 0 || y < 0 || x >= imgWidth)
        return null;
    const i = (y * imgWidth + x) * 4;
    if (pixels[i + 3] < 128)
        return null;
    return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
}
function downscaleNearest(pixels, srcW, srcH, dstW, dstH) {
    const out = new Uint8ClampedArray(dstW * dstH * 4);
    for (let row = 0; row < dstH; row++) {
        for (let col = 0; col < dstW; col++) {
            const sx = Math.min(srcW - 1, Math.max(0, Math.round(((col + 0.5) * srcW) / dstW - 0.5)));
            const sy = Math.min(srcH - 1, Math.max(0, Math.round(((row + 0.5) * srcH) / dstH - 0.5)));
            const i = (row * dstW + col) * 4;
            const rgb = readOpaqueRgb(pixels, srcW, sx, sy);
            if (!rgb) {
                out[i + 3] = 0;
                continue;
            }
            out[i] = rgb.r;
            out[i + 1] = rgb.g;
            out[i + 2] = rgb.b;
            out[i + 3] = 255;
        }
    }
    return out;
}
function downscaleFeatureAware(pixels, srcW, srcH, dstW, dstH) {
    const analysis = analyzeFeatureColors(pixels, srcW, srcH);
    const out = new Uint8ClampedArray(dstW * dstH * 4);
    for (let row = 0; row < dstH; row++) {
        for (let col = 0; col < dstW; col++) {
            const { x0, y0, x1, y1 } = cellBounds(srcW, srcH, dstW, dstH, col, row);
            const i = (row * dstW + col) * 4;
            const rgb = sampleCellFeatureAware(pixels, srcW, x0, y0, x1, y1, analysis);
            if (!rgb) {
                out[i + 3] = 0;
                continue;
            }
            out[i] = rgb.r;
            out[i + 1] = rgb.g;
            out[i + 2] = rgb.b;
            out[i + 3] = 255;
        }
    }
    return out;
}
/**
 * 将 RGBA 像素转为经典像素风中间图（块状、无智能量化）。
 * 少色线稿：微小特征膨胀 + 特征色优先降采样，保留眼睛/腮红等细节。
 */
export function createPixelArtPrepPixels(pixels, width, height, maxGrid) {
    const hints = analyzeImageContent(pixels, width, height);
    const sourceColors = countDistinctColors(pixels, width, height);
    const detailSensitive = isDetailSensitiveCartoon(pixels, width, height, hints);
    const target = computePrepTargetDimensions(width, height, hints, maxGrid, sourceColors);
    let source = pixels;
    if (detailSensitive) {
        const analysis = analyzeFeatureColors(pixels, width, height);
        source = dilateTinyFeatures(pixels, width, height, analysis);
    }
    const needsDownscale = target.width !== width || target.height !== height;
    const simplified = needsDownscale && detailSensitive
        ? downscaleFeatureAware(source, width, height, target.width, target.height)
        : needsDownscale
            ? downscaleNearest(source, width, height, target.width, target.height)
            : new Uint8ClampedArray(source);
    const colorCount = countDistinctColors(simplified, target.width, target.height);
    return {
        pixels: simplified,
        width: target.width,
        height: target.height,
        gridWidth: target.width,
        gridHeight: target.height,
        colorCount,
    };
}
