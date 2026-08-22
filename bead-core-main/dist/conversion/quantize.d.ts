import { findClosestPaletteEntry } from '../color/palette.js';
import type { MappedGrid, PaletteEntry, PixelationMode, Rgb } from '../types.js';
import type { SampleGrid } from './resample.js';
export declare class PaletteMatcher {
    private readonly entries;
    private readonly labs;
    constructor(entries: PaletteEntry[]);
    match(rgb: Rgb): PaletteEntry;
}
/** 卡通模式：先将源图像素对齐到色板纯色，消除灰边后再降采样，颜色更准更利落 */
export declare function snapPixelsToPalette(pixels: Uint8ClampedArray, width: number, height: number, palette: PaletteEntry[]): Uint8ClampedArray;
export declare function quantizeSamplesToGrid(samples: SampleGrid, palette: PaletteEntry[], fallback: PaletteEntry, mode: PixelationMode): MappedGrid;
/** 去除孤立杂点：当前格与多数邻域不一致且无同色邻居时，改为主邻色 */
export declare function despeckleGridSimple(grid: MappedGrid): MappedGrid;
export { findClosestPaletteEntry };
//# sourceMappingURL=quantize.d.ts.map