import type { Rgb } from '../types.js';
export interface LabColor {
    L: number;
    a: number;
    b: number;
}
/** sRGB → CIELAB (D65) */
export declare function rgbToLab(rgb: Rgb): LabColor;
/** CIEDE2000 ΔE（与 PerlerBeads 等工具常用的感知色差一致） */
export declare function deltaE2000(lab1: LabColor, lab2: LabColor): number;
export declare function getCachedLab(rgb: Rgb): LabColor;
/** 感知色差（ΔE2000），用于配色与区域合并 */
export declare function perceptualColorDistance(rgb1: Rgb, rgb2: Rgb): number;
//# sourceMappingURL=ciede2000.d.ts.map