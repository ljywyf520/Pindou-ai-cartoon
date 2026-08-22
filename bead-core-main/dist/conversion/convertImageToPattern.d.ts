import type { MappedGrid, PaletteEntry, PixelationMode } from '../types.js';
export interface ConvertImageOptions {
    gridWidth: number;
    mode: PixelationMode;
    palette: PaletteEntry[];
    excludedPaletteIds: string[];
    /** 照片模式下去除孤立杂点，默认关闭（易抹细线） */
    despeckle?: boolean;
    /** 原图平铺：跳过预处理与智能采样，仅最近邻 + 色板匹配 */
    flatTile?: boolean;
}
/**
 * 图片转拼豆图纸 — 独立转换引擎
 *
 * 1. 预处理（照片轻锐化）
 * 2. 保边自适应降采样
 * 3. CIEDE2000 感知配色
 */
export declare function convertImageToPattern(pixels: Uint8ClampedArray, imgWidth: number, imgHeight: number, options: ConvertImageOptions): MappedGrid;
//# sourceMappingURL=convertImageToPattern.d.ts.map