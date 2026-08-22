import { describe, expect, it } from 'vitest'
import { createBeadPrepPixels } from '../src/prep/beadPrep.js'
import { createPixelArtPrepPixels } from '../src/prep/pixelArtPrep.js'
import {
  analyzeImageContent,
  countDistinctColors,
} from '../src/prep/imageAnalysis.js'
import {
  computePrepTargetDimensions,
  suggestGridWidthForPrepImage,
  suggestPrepColorCount,
} from '../src/prep/prepParams.js'

function solid(w: number, h: number, r: number, g: number, b: number) {
  const pixels = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    pixels[o] = r
    pixels[o + 1] = g
    pixels[o + 2] = b
    pixels[o + 3] = 255
  }
  return pixels
}

function splitImage(w: number, h: number) {
  const pixels = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const left = x < w / 2
      pixels[i] = left ? 220 : 20
      pixels[i + 1] = left ? 40 : 180
      pixels[i + 2] = left ? 40 : 220
      pixels[i + 3] = 255
    }
  }
  return pixels
}

describe('prep imageAnalysis', () => {
  it('detects flat cartoon-like content', () => {
    const pixels = solid(64, 64, 40, 180, 90)
    const hints = analyzeImageContent(pixels, 64, 64)
    expect(hints.isPhotoLike).toBe(false)
  })

  it('counts distinct colors', () => {
    const pixels = solid(16, 16, 255, 0, 0)
    expect(countDistinctColors(pixels, 16, 16)).toBe(1)
  })
})

describe('prep params', () => {
  it('computes target dimensions within maxGrid', () => {
    const hints = analyzeImageContent(splitImage(800, 600), 800, 600)
    const target = computePrepTargetDimensions(800, 600, hints, 256)
    expect(target.width).toBeLessThanOrEqual(256)
    expect(target.height).toBeLessThanOrEqual(256)
    expect(target.width).toBeGreaterThanOrEqual(40)
  })

  it('maps prep grid width 1:1 to pixel width', () => {
    expect(suggestGridWidthForPrepImage(160, 120, 256)).toBe(160)
  })

  it('computes higher prep dimensions for detail-sensitive cartoons', () => {
    const pixels = splitImage(240, 180)
    const hints = analyzeImageContent(pixels, 240, 180)
    const colors = countDistinctColors(pixels, 240, 180)
    const target = computePrepTargetDimensions(240, 180, hints, 256, colors)
    expect(target.width).toBeGreaterThanOrEqual(180)
    expect(target.height).toBeGreaterThanOrEqual(96)
  })

  it('adapts color budget to natural colors', () => {
    const hints = { variance: 30, isPhotoLike: false }
    expect(suggestPrepColorCount(hints, 10)).toBeGreaterThanOrEqual(10)
  })
})

describe('createBeadPrepPixels', () => {
  it('outputs grid dimensions matching pixel size', () => {
    const pixels = splitImage(120, 90)
    const result = createBeadPrepPixels(pixels, 120, 90, 256)
    expect(result.width).toBe(result.gridWidth)
    expect(result.height).toBe(result.gridHeight)
    expect(result.pixels.length).toBe(result.width * result.height * 4)
    expect(result.colorCount).toBeGreaterThan(0)
  })

  it('preserves two-region structure on simple split image', () => {
    const pixels = splitImage(80, 60)
    const result = createBeadPrepPixels(pixels, 80, 60, 256)
    const colors = countDistinctColors(result.pixels, result.width, result.height)
    expect(colors).toBeGreaterThanOrEqual(2)
    expect(colors).toBeLessThanOrEqual(24)
  })
})

describe('createPixelArtPrepPixels', () => {
  it('outputs grid dimensions matching pixel size', () => {
    const pixels = splitImage(120, 90)
    const result = createPixelArtPrepPixels(pixels, 120, 90, 256)
    expect(result.width).toBe(result.gridWidth)
    expect(result.height).toBe(result.gridHeight)
    expect(result.pixels.length).toBe(result.width * result.height * 4)
    expect(result.colorCount).toBeGreaterThan(0)
  })

  it('keeps solid color as single color after downscale', () => {
    const pixels = solid(100, 80, 40, 180, 90)
    const result = createPixelArtPrepPixels(pixels, 100, 80, 256)
    expect(countDistinctColors(result.pixels, result.width, result.height)).toBe(1)
  })

  it('preserves eye-like tiny dark features when downscaling', () => {
    const w = 80
    const h = 40
    const pixels = solid(w, h, 255, 230, 180)
    for (const x of [30, 31, 50, 51]) {
      const i = (12 * w + x) * 4
      pixels[i] = 0
      pixels[i + 1] = 0
      pixels[i + 2] = 0
    }
    const result = createPixelArtPrepPixels(pixels, w, h, 256)
    let darkCells = 0
    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const i = (y * result.width + x) * 4
        if (result.pixels[i] < 64) darkCells++
      }
    }
    expect(darkCells).toBeGreaterThanOrEqual(2)
  })
})
