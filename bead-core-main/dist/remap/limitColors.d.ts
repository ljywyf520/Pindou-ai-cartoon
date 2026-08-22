import type { MappedGrid, PaletteEntry } from '../types.js';
/** 将 grid 中非背景格子的颜色种类压缩到 maxColors 以内（0 表示不限制） */
export declare function limitGridColors(grid: MappedGrid, palette: PaletteEntry[], maxColors: number): MappedGrid;
//# sourceMappingURL=limitColors.d.ts.map