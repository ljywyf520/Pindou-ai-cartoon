import type { Rgb } from '../types.js';
export declare function hexToRgb(hex: string): Rgb | null;
export declare function rgbToHex(rgb: Rgb): string;
/** 感知色差 ΔE2000（与拼豆行业工具一致的配色度量） */
export declare function colorDistance(rgb1: Rgb, rgb2: Rgb): number;
//# sourceMappingURL=oklab.d.ts.map