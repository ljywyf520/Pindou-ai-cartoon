import type { BeadPrepResult } from './beadPrep.js';
/**
 * 将 RGBA 像素转为经典像素风中间图（块状、无智能量化）。
 * 少色线稿：微小特征膨胀 + 特征色优先降采样，保留眼睛/腮红等细节。
 */
export declare function createPixelArtPrepPixels(pixels: Uint8ClampedArray, width: number, height: number, maxGrid: number): BeadPrepResult;
//# sourceMappingURL=pixelArtPrep.d.ts.map