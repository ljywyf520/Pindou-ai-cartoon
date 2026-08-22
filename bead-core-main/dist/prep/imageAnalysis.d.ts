export interface ImageContentHints {
    variance: number;
    isPhotoLike: boolean;
}
/** 采样亮度方差，区分照片与卡通/插画 */
export declare function analyzeImageContent(pixels: Uint8ClampedArray, width: number, height: number): ImageContentHints;
/**
 * 少色卡通 / 线稿：细描边、白底角色等，降采样过猛会丢轮廓，需保留更高格数。
 */
export declare function isDetailSensitiveCartoon(pixels: Uint8ClampedArray, width: number, height: number, hints?: ImageContentHints): boolean;
/** 统计图像中近似 distinct 颜色数（默认 5 bit 分桶） */
export declare function countDistinctColors(pixels: Uint8ClampedArray, width: number, height: number, bits?: number): number;
//# sourceMappingURL=imageAnalysis.d.ts.map