import { cellBounds } from './cellBounds.js';
import { analyzeFeatureColors, sampleCellFeatureAware } from './featureSample.js';
function readOpaqueRgb(pixels, imgWidth, x, y) {
    if (x < 0 || y < 0 || x >= imgWidth)
        return null;
    const i = (y * imgWidth + x) * 4;
    if (pixels[i + 3] < 128)
        return null;
    return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
}
/**
 * 最近邻格心采样 — 与 canvas imageSmoothingEnabled=false 缩放到格网等价。
 * 不做区域平均，避免边缘被抹糊。
 */
function sampleCellNearest(pixels, imgWidth, imgHeight, col, row, gridWidth, gridHeight) {
    const sx = Math.min(imgWidth - 1, Math.max(0, Math.round(((col + 0.5) * imgWidth) / gridWidth - 0.5)));
    const sy = Math.min(imgHeight - 1, Math.max(0, Math.round(((row + 0.5) * imgHeight) / gridHeight - 0.5)));
    return readOpaqueRgb(pixels, imgWidth, sx, sy);
}
/** 格内众数：仅当单格覆盖较多源像素时（卡通粗格） */
function sampleCellDominant(pixels, imgWidth, x0, y0, x1, y1) {
    const buckets = new Map();
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * imgWidth + x) * 4;
            if (pixels[i + 3] < 128)
                continue;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const key = `${r >> 3},${g >> 3},${b >> 3}`;
            const bucket = buckets.get(key);
            if (bucket) {
                bucket.count++;
                bucket.r += r;
                bucket.g += g;
                bucket.b += b;
            }
            else {
                buckets.set(key, { count: 1, r, g, b });
            }
        }
    }
    let best = null;
    for (const bucket of buckets.values()) {
        if (!best || bucket.count > best.count)
            best = bucket;
    }
    if (!best)
        return null;
    return {
        r: Math.round(best.r / best.count),
        g: Math.round(best.g / best.count),
        b: Math.round(best.b / best.count),
    };
}
const DOMINANT_CELL_PIXEL_THRESHOLD = 6;
export function resampleImageToGrid(pixels, imgWidth, imgHeight, gridWidth, gridHeight, mode, flatTile = false) {
    const featureAnalysis = mode === 'dominant' && !flatTile ? analyzeFeatureColors(pixels, imgWidth, imgHeight) : null;
    const grid = [];
    for (let row = 0; row < gridHeight; row++) {
        const line = [];
        for (let col = 0; col < gridWidth; col++) {
            const { x0, y0, x1, y1 } = cellBounds(imgWidth, imgHeight, gridWidth, gridHeight, col, row);
            const cellPixels = (x1 - x0) * (y1 - y0);
            let rgb;
            if (flatTile) {
                rgb = sampleCellNearest(pixels, imgWidth, imgHeight, col, row, gridWidth, gridHeight);
            }
            else if (mode === 'dominant' && cellPixels >= 2 && featureAnalysis) {
                rgb =
                    sampleCellFeatureAware(pixels, imgWidth, x0, y0, x1, y1, featureAnalysis) ??
                        sampleCellNearest(pixels, imgWidth, imgHeight, col, row, gridWidth, gridHeight);
            }
            else if (mode === 'dominant' && cellPixels >= DOMINANT_CELL_PIXEL_THRESHOLD) {
                rgb =
                    sampleCellDominant(pixels, imgWidth, x0, y0, x1, y1) ??
                        sampleCellNearest(pixels, imgWidth, imgHeight, col, row, gridWidth, gridHeight);
            }
            else {
                rgb = sampleCellNearest(pixels, imgWidth, imgHeight, col, row, gridWidth, gridHeight);
            }
            line.push(rgb);
        }
        grid.push(line);
    }
    return grid;
}
