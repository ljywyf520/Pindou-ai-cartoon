import { cellBounds } from '../conversion/cellBounds.js'
import { prepareSourcePixels } from '../image/adjustPixels.js'
import type { Rgb } from '../types.js'
import { analyzeImageContent, countDistinctColors } from './imageAnalysis.js'
import {
  computePrepTargetDimensions,
  suggestPrepColorCount,
} from './prepParams.js'

export interface BeadPrepResult {
  pixels: Uint8ClampedArray
  width: number
  height: number
  gridWidth: number
  gridHeight: number
  colorCount: number
}

interface ColorBucket {
  count: number
  edgeCount: number
  r: number
  g: number
  b: number
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function computeEdgeMap(pixels: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] < 128) {
        gray[y * width + x] = -1
        continue
      }
      gray[y * width + x] = luminance(pixels[i], pixels[i + 1], pixels[i + 2])
    }
  }

  const edge = new Float32Array(width * height)
  let max = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      if (gray[idx] < 0) continue

      const gx =
        -gray[(y - 1) * width + (x - 1)] +
        gray[(y - 1) * width + (x + 1)] +
        -2 * gray[y * width + (x - 1)] +
        2 * gray[y * width + (x + 1)] +
        -gray[(y + 1) * width + (x - 1)] +
        gray[(y + 1) * width + (x + 1)]

      const gy =
        -gray[(y - 1) * width + (x - 1)] +
        -2 * gray[(y - 1) * width + x] +
        -gray[(y - 1) * width + (x + 1)] +
        gray[(y + 1) * width + (x - 1)] +
        2 * gray[(y + 1) * width + x] +
        gray[(y + 1) * width + (x + 1)]

      const mag = Math.hypot(gx, gy)
      edge[idx] = mag
      if (mag > max) max = mag
    }
  }

  if (max > 0) {
    for (let i = 0; i < edge.length; i++) {
      if (edge[i] > 0) edge[i] = Math.min(1, edge[i] / max)
    }
  }
  return edge
}

function colorKey(r: number, g: number, b: number, bits = 4): string {
  const shift = 8 - bits
  return `${r >> shift},${g >> shift},${b >> shift}`
}

function buildWeightedHistogram(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  edgeMap: Float32Array,
): Map<string, ColorBucket> {
  const hist = new Map<string, ColorBucket>()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] < 128) continue
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const key = colorKey(r, g, b)
      const edgeBoost = edgeMap[y * width + x] > 0.25 ? 1 : 0
      const bucket = hist.get(key)
      if (bucket) {
        bucket.count++
        bucket.edgeCount += edgeBoost
        bucket.r += r
        bucket.g += g
        bucket.b += b
      } else {
        hist.set(key, { count: 1, edgeCount: edgeBoost, r, g, b })
      }
    }
  }
  return hist
}

function bucketScore(bucket: ColorBucket): number {
  return bucket.count + bucket.edgeCount * 4
}

function bucketMean(bucket: ColorBucket): Rgb {
  return {
    r: Math.round(bucket.r / bucket.count),
    g: Math.round(bucket.g / bucket.count),
    b: Math.round(bucket.b / bucket.count),
  }
}

function extractImportantColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  edgeMap: Float32Array,
  maxColors: number,
): Rgb[] {
  const hist = buildWeightedHistogram(pixels, width, height, edgeMap)
  const totalPixels = width * height
  const minArea = Math.max(6, Math.floor(totalPixels * 0.003))

  const ranked = [...hist.entries()]
    .map(([, bucket]) => ({ bucket, score: bucketScore(bucket), mean: bucketMean(bucket) }))
    .sort((a, b) => b.score - a.score)

  const picked: Rgb[] = []
  const seen = new Set<string>()

  const pushColor = (rgb: Rgb) => {
    const key = colorKey(rgb.r, rgb.g, rgb.b, 3)
    if (seen.has(key)) return
    seen.add(key)
    picked.push(rgb)
  }

  for (const item of ranked) {
    if (item.bucket.count >= minArea) pushColor(item.mean)
    if (picked.length >= maxColors) break
  }

  for (const item of ranked) {
    if (item.bucket.edgeCount >= 2) pushColor(item.mean)
    if (picked.length >= maxColors) break
  }

  for (const item of ranked) {
    pushColor(item.mean)
    if (picked.length >= maxColors) break
  }

  return picked
}

function sampleWeightedDominantRgb(
  pixels: Uint8ClampedArray,
  imgWidth: number,
  edgeMap: Float32Array | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Rgb | null {
  const buckets = new Map<string, { weight: number; r: number; g: number; b: number }>()
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * imgWidth + x) * 4
      if (pixels[i + 3] < 128) continue
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const key = `${r >> 3},${g >> 3},${b >> 3}`
      const edge = edgeMap ? edgeMap[y * imgWidth + x] : 0
      const weight = 1 + edge * 3
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.weight += weight
        bucket.r += r * weight
        bucket.g += g * weight
        bucket.b += b * weight
      } else {
        buckets.set(key, { weight, r: r * weight, g: g * weight, b: b * weight })
      }
    }
  }
  let best: { weight: number; r: number; g: number; b: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) best = bucket
  }
  if (!best) return null
  return {
    r: Math.round(best.r / best.weight),
    g: Math.round(best.g / best.weight),
    b: Math.round(best.b / best.weight),
  }
}

function downscaleDominant(
  pixels: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  edgeMap: Float32Array | null = null,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dstW * dstH * 4)
  for (let row = 0; row < dstH; row++) {
    for (let col = 0; col < dstW; col++) {
      const { x0, y0, x1, y1 } = cellBounds(srcW, srcH, dstW, dstH, col, row)
      const i = (row * dstW + col) * 4
      const rgb = sampleWeightedDominantRgb(pixels, srcW, edgeMap, x0, y0, x1, y1)
      if (!rgb) {
        out[i + 3] = 0
        continue
      }
      out[i] = rgb.r
      out[i + 1] = rgb.g
      out[i + 2] = rgb.b
      out[i + 3] = 255
    }
  }
  return out
}

function downscaleEdgeMap(
  edgeMap: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const out = new Float32Array(dstW * dstH)
  for (let row = 0; row < dstH; row++) {
    for (let col = 0; col < dstW; col++) {
      const { x0, y0, x1, y1 } = cellBounds(srcW, srcH, dstW, dstH, col, row)
      let max = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = edgeMap[y * srcW + x]
          if (v > max) max = v
        }
      }
      out[row * dstW + col] = max
    }
  }
  return out
}

function downscaleDominantProgressive(
  pixels: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  edgeMap: Float32Array,
): { pixels: Uint8ClampedArray; width: number; height: number; edgeMap: Float32Array } {
  let cur = pixels
  let w = srcW
  let h = srcH
  let curEdge = edgeMap

  while (w > dstW * 1.8 || h > dstH * 1.8) {
    const nextW = Math.max(dstW, Math.round(w * 0.55))
    const nextH = Math.max(dstH, Math.round(h * 0.55))
    cur = downscaleDominant(cur, w, h, nextW, nextH, curEdge)
    curEdge = downscaleEdgeMap(curEdge, w, h, nextW, nextH)
    w = nextW
    h = nextH
  }

  if (w !== dstW || h !== dstH) {
    cur = downscaleDominant(cur, w, h, dstW, dstH, curEdge)
    curEdge = downscaleEdgeMap(curEdge, w, h, dstW, dstH)
    w = dstW
    h = dstH
  }

  return { pixels: cur, width: w, height: h, edgeMap: curEdge }
}

function colorDistSq(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return dr * dr + dg * dg + db * db
}

function nearestCentroid(rgb: Rgb, centroids: Rgb[]): number {
  let best = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (let c = 0; c < centroids.length; c++) {
    const dist = colorDistSq(rgb, centroids[c])
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }
  return best
}

function kMeansQuantizeWithSeeds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  k: number,
  seeds: Rgb[],
): Rgb[] {
  const centroids = seeds.slice(0, k).map((c) => ({ ...c }))
  if (!centroids.length) return [{ r: 128, g: 128, b: 128 }]

  const samples: Rgb[] = []
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4096)))
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] < 128) continue
      samples.push({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] })
    }
  }
  if (!samples.length) return centroids

  while (centroids.length < k && centroids.length < samples.length) {
    let bestIdx = 0
    let bestDist = -1
    for (let i = 0; i < samples.length; i++) {
      let min = Number.POSITIVE_INFINITY
      for (const c of centroids) min = Math.min(min, colorDistSq(samples[i], c))
      if (min > bestDist) {
        bestDist = min
        bestIdx = i
      }
    }
    centroids.push({ ...samples[bestIdx] })
  }

  const assignments = new Array(samples.length).fill(0)
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < samples.length; i++) {
      assignments[i] = nearestCentroid(samples[i], centroids)
    }
    const sums = centroids.map(() => ({ count: 0, r: 0, g: 0, b: 0 }))
    for (let i = 0; i < samples.length; i++) {
      const bucket = sums[assignments[i]]
      bucket.count++
      bucket.r += samples[i].r
      bucket.g += samples[i].g
      bucket.b += samples[i].b
    }
    for (let c = 0; c < centroids.length; c++) {
      if (!sums[c].count) continue
      centroids[c] = {
        r: Math.round(sums[c].r / sums[c].count),
        g: Math.round(sums[c].g / sums[c].count),
        b: Math.round(sums[c].b / sums[c].count),
      }
    }
  }

  return centroids
}

function applyPalette(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centroids: Rgb[],
  edgeMap: Float32Array,
  original: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] < 128) {
        out[i + 3] = 0
        continue
      }
      const rgb = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] }
      const orig = { r: original[i], g: original[i + 1], b: original[i + 2] }
      let ci = nearestCentroid(rgb, centroids)

      const edge = edgeMap[y * width + x]
      if (edge > 0.32) {
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ] as const
        let maxContrast = -1
        let bestCi = ci
        for (let c = 0; c < centroids.length; c++) {
          let contrast = 0
          for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const ni = (ny * width + nx) * 4
            if (original[ni + 3] < 128) continue
            contrast += colorDistSq(centroids[c], {
              r: original[ni],
              g: original[ni + 1],
              b: original[ni + 2],
            })
          }
          if (contrast > maxContrast) {
            maxContrast = contrast
            bestCi = c
          }
        }
        ci = bestCi
        const seedCi = nearestCentroid(orig, centroids)
        if (colorDistSq(orig, centroids[seedCi]) < colorDistSq(orig, centroids[ci]) * 1.6) {
          ci = seedCi
        }
      }

      out[i] = centroids[ci].r
      out[i + 1] = centroids[ci].g
      out[i + 2] = centroids[ci].b
      out[i + 3] = 255
    }
  }
  return out
}

function smoothInteriorOnly(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  edgeMap: Float32Array,
  edgeThreshold = 0.3,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const i = idx * 4
      if (pixels[i + 3] < 128 || edgeMap[idx] >= edgeThreshold) continue

      const counts = new Map<string, { count: number; r: number; g: number; b: number }>()
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIdx = ny * width + nx
          if (edgeMap[nIdx] >= edgeThreshold) continue
          const ni = nIdx * 4
          if (pixels[ni + 3] < 128) continue
          const key = `${pixels[ni]},${pixels[ni + 1]},${pixels[ni + 2]}`
          const bucket = counts.get(key)
          if (bucket) bucket.count++
          else counts.set(key, { count: 1, r: pixels[ni], g: pixels[ni + 1], b: pixels[ni + 2] })
        }
      }
      let best = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] }
      let bestCount = 0
      for (const bucket of counts.values()) {
        if (bucket.count > bestCount) {
          bestCount = bucket.count
          best = bucket
        }
      }
      if (bestCount >= 5) {
        out[i] = best.r
        out[i + 1] = best.g
        out[i + 2] = best.b
      }
    }
  }
  return out
}

/**
 * 将 RGBA 像素转为拼豆专用图（大色块、硬边缘、少渐变）。
 * 输出每个像素对应一粒豆，gridWidth/height 与 width/height 一致。
 */
export function createBeadPrepPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  maxGrid: number,
): BeadPrepResult {
  const hints = analyzeImageContent(pixels, width, height)
  const sourceColors = countDistinctColors(pixels, width, height)
  const target = computePrepTargetDimensions(width, height, hints, maxGrid, sourceColors)

  const prepared = prepareSourcePixels(
    pixels,
    width,
    height,
    hints.isPhotoLike
      ? { brightness: 1, contrast: 12, saturation: 2 }
      : { brightness: 0, contrast: 8, saturation: 0 },
    { denoise: hints.isPhotoLike, sharpen: hints.isPhotoLike },
  )
  const edgeMap = computeEdgeMap(prepared, width, height)

  const downscaled = downscaleDominantProgressive(
    prepared,
    width,
    height,
    target.width,
    target.height,
    edgeMap,
  )

  const naturalColors = countDistinctColors(
    downscaled.pixels,
    downscaled.width,
    downscaled.height,
  )
  const colorBudget = suggestPrepColorCount(hints, naturalColors)

  const importantColors = extractImportantColors(
    downscaled.pixels,
    downscaled.width,
    downscaled.height,
    downscaled.edgeMap,
    colorBudget,
  )
  const paletteSize = Math.max(importantColors.length, Math.min(colorBudget, naturalColors + 2))

  const centroids = kMeansQuantizeWithSeeds(
    downscaled.pixels,
    downscaled.width,
    downscaled.height,
    paletteSize,
    importantColors,
  )

  let simplified = applyPalette(
    downscaled.pixels,
    downscaled.width,
    downscaled.height,
    centroids,
    downscaled.edgeMap,
    downscaled.pixels,
  )
  simplified = smoothInteriorOnly(
    simplified,
    downscaled.width,
    downscaled.height,
    downscaled.edgeMap,
  )

  const colorCount = countDistinctColors(simplified, downscaled.width, downscaled.height)

  return {
    pixels: simplified,
    width: downscaled.width,
    height: downscaled.height,
    gridWidth: downscaled.width,
    gridHeight: downscaled.height,
    colorCount,
  }
}
