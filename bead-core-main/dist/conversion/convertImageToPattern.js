import { filterActivePalette } from '../color/palette.js';
import { preprocessForConversion } from './enhance.js';
import { analyzeFeatureColors, dilateTinyFeatures } from './featureSample.js';
import { resampleImageToGrid } from './resample.js';
import { despeckleGridSimple, quantizeSamplesToGrid, snapPixelsToPalette } from './quantize.js';
/**
 * 图片转拼豆图纸 — 独立转换引擎
 *
 * 1. 预处理（照片轻锐化）
 * 2. 保边自适应降采样
 * 3. CIEDE2000 感知配色
 */
export function convertImageToPattern(pixels, imgWidth, imgHeight, options) {
    const { gridWidth, mode, palette, excludedPaletteIds, despeckle = false, flatTile = false } = options;
    const gridHeight = Math.max(1, Math.round((gridWidth * imgHeight) / imgWidth));
    const excluded = new Set(excludedPaletteIds);
    const activePalette = filterActivePalette(palette, excluded);
    const fallback = activePalette[0] ?? palette[0];
    if (activePalette.length === 0) {
        return Array.from({ length: gridHeight }, () => Array.from({ length: gridWidth }, () => ({
            paletteId: fallback.id,
            hex: fallback.hex,
            isExternal: true,
        })));
    }
    if (flatTile) {
        const samples = resampleImageToGrid(pixels, imgWidth, imgHeight, gridWidth, gridHeight, 'average', true);
        return quantizeSamplesToGrid(samples, activePalette, fallback, mode);
    }
    let prepared = preprocessForConversion(pixels, imgWidth, imgHeight, mode);
    if (mode === 'dominant') {
        prepared = snapPixelsToPalette(prepared, imgWidth, imgHeight, activePalette);
        if (gridWidth < imgWidth) {
            const analysis = analyzeFeatureColors(prepared, imgWidth, imgHeight);
            prepared = dilateTinyFeatures(prepared, imgWidth, imgHeight, analysis);
        }
    }
    const samples = resampleImageToGrid(prepared, imgWidth, imgHeight, gridWidth, gridHeight, mode);
    let grid = quantizeSamplesToGrid(samples, activePalette, fallback, mode);
    if (despeckle && mode === 'average') {
        grid = despeckleGridSimple(grid);
    }
    return grid;
}
