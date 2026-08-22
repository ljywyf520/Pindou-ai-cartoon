import type { ImageContentHints } from './imageAnalysis.js'

export interface PrepTargetDimensions {
  width: number
  height: number
}

/**
 * 根据原图尺寸与内容复杂度，计算拼豆专用图目标像素尺寸（= 后续 1:1 格数）。
 */
export function computePrepTargetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  hints: ImageContentHints,
  maxGrid: number,
  distinctColors?: number,
): PrepTargetDimensions {
  const aspect = sourceWidth / sourceHeight
  const minEdge = Math.min(sourceWidth, sourceHeight)
  const detailSensitive = !hints.isPhotoLike && (distinctColors ?? 999) <= 32

  let targetShort: number
  if (detailSensitive) {
    if (minEdge <= 128) {
      targetShort = minEdge
    } else {
      targetShort = Math.round(minEdge / 1.1)
      targetShort = Math.max(96, Math.min(maxGrid, targetShort))
    }
  } else if (hints.isPhotoLike) {
    if (hints.variance > 200) targetShort = minEdge / 3.8
    else if (hints.variance > 120) targetShort = minEdge / 3.4
    else if (hints.variance > 80) targetShort = minEdge / 3.0
    else targetShort = minEdge / 2.8
    targetShort = Math.max(80, Math.min(220, Math.round(targetShort)))
  } else {
    targetShort = hints.variance > 50 ? minEdge / 3.8 : minEdge / 3.2
    targetShort = Math.max(80, Math.min(220, Math.round(targetShort)))
  }

  let width = aspect >= 1 ? Math.round(targetShort * aspect) : targetShort
  let height = aspect >= 1 ? targetShort : Math.round(targetShort / aspect)

  const scale = Math.min(1, maxGrid / width, maxGrid / height)
  width = Math.max(40, Math.round(width * scale))
  height = Math.max(40, Math.round(height * scale))

  return { width, height }
}

export function suggestPrepColorCount(hints: ImageContentHints, naturalColors = 0): number {
  let base: number
  if (hints.isPhotoLike) {
    base = hints.variance > 180 ? 24 : hints.variance > 100 ? 20 : 18
  } else {
    base = hints.variance > 50 ? 18 : 16
  }
  if (naturalColors > 0) {
    return Math.max(8, Math.min(32, Math.max(base, Math.min(naturalColors + 2, base + 6))))
  }
  return base
}

/** 拼豆专用图二次出图：每个源像素对应一格 */
export function suggestGridWidthForPrepImage(
  imgWidth: number,
  _imgHeight: number,
  maxGrid: number,
): number {
  return Math.max(40, Math.min(maxGrid, imgWidth))
}

export function suggestPrepMergeThreshold(colorCount: number, variance: number): number {
  if (colorCount <= 20) return 0
  if (colorCount > 28) return 2
  if (colorCount > 18) return 4
  if (variance > 40) return 5
  return 6
}
