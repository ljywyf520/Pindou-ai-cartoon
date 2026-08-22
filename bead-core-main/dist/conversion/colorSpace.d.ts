import type { Rgb } from '../types.js';
export declare function srgbToLinear(channel: number): number;
export declare function linearToSrgb(channel: number): number;
export declare function clampRgb(rgb: Rgb): Rgb;
export declare function linearAverageToSrgb(rLin: number, gLin: number, bLin: number, weight: number): Rgb | null;
export declare function relativeLuminance(rgb: Rgb): number;
//# sourceMappingURL=colorSpace.d.ts.map