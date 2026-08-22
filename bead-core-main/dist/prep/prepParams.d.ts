import type { ImageContentHints } from './imageAnalysis.js';
export interface PrepTargetDimensions {
    width: number;
    height: number;
}
/**
 * 根据原图尺寸与内容复杂度，计算拼豆专用图目标像素尺寸（= 后续 1:1 格数）。
 */
export declare function computePrepTargetDimensions(sourceWidth: number, sourceHeight: number, hints: ImageContentHints, maxGrid: number, distinctColors?: number): PrepTargetDimensions;
export declare function suggestPrepColorCount(hints: ImageContentHints, naturalColors?: number): number;
/** 拼豆专用图二次出图：每个源像素对应一格 */
export declare function suggestGridWidthForPrepImage(imgWidth: number, _imgHeight: number, maxGrid: number): number;
export declare function suggestPrepMergeThreshold(colorCount: number, variance: number): number;
//# sourceMappingURL=prepParams.d.ts.map