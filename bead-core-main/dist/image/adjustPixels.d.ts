export interface ImageAdjust {
    brightness: number;
    contrast: number;
    saturation: number;
}
export declare const DEFAULT_IMAGE_ADJUST: ImageAdjust;
export interface PhotoOptimize {
    denoise: boolean;
    sharpen: boolean;
}
export declare const DEFAULT_PHOTO_OPTIMIZE: PhotoOptimize;
export declare function applyImageAdjustments(pixels: Uint8ClampedArray, width: number, height: number, adjust: ImageAdjust): Uint8ClampedArray;
export declare function applyPhotoOptimize(pixels: Uint8ClampedArray, width: number, height: number, optimize: PhotoOptimize): Uint8ClampedArray;
export declare function prepareSourcePixels(pixels: Uint8ClampedArray, width: number, height: number, adjust: ImageAdjust, optimize: PhotoOptimize): Uint8ClampedArray;
//# sourceMappingURL=adjustPixels.d.ts.map