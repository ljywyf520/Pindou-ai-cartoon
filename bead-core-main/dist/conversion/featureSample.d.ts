import type { Rgb } from '../types.js';
export interface FeatureColorAnalysis {
    featureKeys: Set<string>;
    backgroundKeys: Set<string>;
    tinyFeatureKeys: Set<string>;
}
/** 统计全图稀有色（眼睛、腮红、项圈等），排除大面积底色 */
export declare function analyzeFeatureColors(pixels: Uint8ClampedArray, width: number, height: number): FeatureColorAnalysis;
/**
 * 将眼睛、腮红等微小色块向外扩 1 像素，避免降采样时落在格缝上被吞掉。
 */
export declare function dilateTinyFeatures(pixels: Uint8ClampedArray, width: number, height: number, analysis: FeatureColorAnalysis): Uint8ClampedArray;
/**
 * 格内采样：稀有特征色（眼睛/腮红/项圈）> 描边 > 主色。
 */
export declare function sampleCellFeatureAware(pixels: Uint8ClampedArray, imgWidth: number, x0: number, y0: number, x1: number, y1: number, analysis: FeatureColorAnalysis): Rgb | null;
//# sourceMappingURL=featureSample.d.ts.map