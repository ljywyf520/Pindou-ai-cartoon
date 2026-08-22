export interface ImageContentHints {
  variance: number
  isPhotoLike: boolean
}

/** 采样亮度方差，区分照片与卡通/插画 */
export function analyzeImageContent(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): ImageContentHints {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 32))
  let prevL = 0
  let variance = 0
  let samples = 0

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] < 128) continue
      const l = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
      if (samples > 0) {
        const d = l - prevL
        variance += d * d
      }
      prevL = l
      samples++
    }
  }

  const avgVariance = samples > 1 ? variance / (samples - 1) : 0
  return { variance: avgVariance, isPhotoLike: avgVariance > 100 }
}

/**
 * 少色卡通 / 线稿：细描边、白底角色等，降采样过猛会丢轮廓，需保留更高格数。
 */
export function isDetailSensitiveCartoon(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  hints?: ImageContentHints,
): boolean {
  const content = hints ?? analyzeImageContent(pixels, width, height)
  if (content.isPhotoLike) return false
  return countDistinctColors(pixels, width, height) <= 32
}

/** 统计图像中近似 distinct 颜色数（默认 5 bit 分桶） */
export function countDistinctColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bits = 5,
): number {
  const shift = 8 - bits
  const seen = new Set<string>()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] < 128) continue
      seen.add(`${pixels[i] >> shift},${pixels[i + 1] >> shift},${pixels[i + 2] >> shift}`)
    }
  }
  return seen.size
}
