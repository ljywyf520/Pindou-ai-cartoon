import type { PixelationMode, Rgb } from '../types.js';
export type SampleGrid = (Rgb | null)[][];
export declare function resampleImageToGrid(pixels: Uint8ClampedArray, imgWidth: number, imgHeight: number, gridWidth: number, gridHeight: number, mode: PixelationMode, flatTile?: boolean): SampleGrid;
//# sourceMappingURL=resample.d.ts.map