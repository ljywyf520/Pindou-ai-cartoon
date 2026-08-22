import type { PaletteEntry, Rgb } from '../types.js';
/** 用 CIEDE2000（ΔE）在色板中找最接近真实豆色的条目 */
export declare function findClosestPaletteEntry(target: Rgb, palette: PaletteEntry[]): PaletteEntry;
export declare function filterActivePalette(palette: PaletteEntry[], excludedIds: Set<string>): PaletteEntry[];
//# sourceMappingURL=palette.d.ts.map