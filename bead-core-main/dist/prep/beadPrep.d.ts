export interface BeadPrepResult {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    gridWidth: number;
    gridHeight: number;
    colorCount: number;
}
/**
 * 将 RGBA 像素转为拼豆专用图（大色块、硬边缘、少渐变）。
 * 输出每个像素对应一粒豆，gridWidth/height 与 width/height 一致。
 */
export declare function createBeadPrepPixels(pixels: Uint8ClampedArray, width: number, height: number, maxGrid: number): BeadPrepResult;
//# sourceMappingURL=beadPrep.d.ts.map