import { describe, expect, it } from 'vitest'
import {
  analyzeFeatureColors,
  dilateTinyFeatures,
  sampleCellFeatureAware,
} from '../src/conversion/featureSample.js'
import { cellBounds } from '../src/conversion/cellBounds.js'

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

describe('featureSample', () => {
  it('detects tiny accent colors like eyes and collar', () => {
    const w = 40
    const h = 40
    const pixels = solid(w, h, 255, 230, 180)
    pixels[(10 * w + 20) * 4] = 0
    pixels[(10 * w + 20) * 4 + 1] = 0
    pixels[(10 * w + 20) * 4 + 2] = 0
    pixels[(25 * w + 20) * 4] = 220
    pixels[(25 * w + 20) * 4 + 1] = 40
    pixels[(25 * w + 20) * 4 + 2] = 40

    const analysis = analyzeFeatureColors(pixels, w, h)
    expect(analysis.featureKeys.size).toBeGreaterThanOrEqual(2)
    expect(analysis.tinyFeatureKeys.size).toBeGreaterThanOrEqual(2)
  })

  it('dilates tiny features into neighboring background pixels', () => {
    const w = 10
    const h = 10
    const pixels = solid(w, h, 255, 255, 255)
    const eyeX = 5
    const eyeY = 5
    const i = (eyeY * w + eyeX) * 4
    pixels[i] = 0
    pixels[i + 1] = 0
    pixels[i + 2] = 0

    const analysis = analyzeFeatureColors(pixels, w, h)
    const dilated = dilateTinyFeatures(pixels, w, h, analysis)
    const left = (eyeY * w + (eyeX - 1)) * 4
    expect(dilated[left]).toBe(0)
    expect(dilated[left + 1]).toBe(0)
    expect(dilated[left + 2]).toBe(0)
  })

  it('prefers feature color over fill in a mixed cell', () => {
    const w = 20
    const h = 4
    const pixels = solid(w, h, 255, 230, 180)
    for (let x = 8; x <= 11; x++) {
      const i = (2 * w + x) * 4
      pixels[i] = 0
      pixels[i + 1] = 0
      pixels[i + 2] = 0
    }
    const analysis = analyzeFeatureColors(pixels, w, h)
    const { x0, y0, x1, y1 } = cellBounds(w, h, 4, 4, 1, 2)
    const rgb = sampleCellFeatureAware(pixels, w, x0, y0, x1, y1, analysis)
    expect(rgb).not.toBeNull()
    expect(rgb!.r).toBeLessThan(32)
  })
})
