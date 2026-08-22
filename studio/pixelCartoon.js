// pixelCartoon.js - 拼豆向像素卡通化预处理模块
// 全部处理在浏览器本地完成，使用 Canvas API，无需外部依赖
// 输入：HTMLImageElement → 处理 → 输出 HTMLCanvasElement

/**
 * 主处理函数：将图片转换为拼豆适配的平涂像素卡通风格
 * @param {HTMLImageElement} image - 源图片
 * @param {Object} options
 * @param {number} options.pixelSize - 像素颗粒尺寸 (4-120)
 * @param {number} options.maxColors - 最大颜色数量 (4-36)
 * @param {boolean} options.forceFlat - 强制平涂去渐变
 * @param {boolean} options.edgeEnhance - 轮廓强化
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function cartoonizePixelArt(image, options) {
  const { pixelSize, maxColors, forceFlat, edgeEnhance } = options;
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;

  // Step 1: 像素化（降采样 + 升采样，关闭抗锯齿）
  const pixelated = pixelate(image, pixelSize);
  const ctx = pixelated.getContext('2d', { willReadFrequently: true });
  let imageData = ctx.getImageData(0, 0, pixelated.width, pixelated.height);

  // Step 2: 颜色量化（K-means 色彩聚类）
  if (maxColors > 0 && maxColors < 256) {
    imageData = kMeansQuantize(imageData, pixelated.width, pixelated.height, maxColors);
  }

  // Step 3: 强制平涂去渐变（中值滤波，消除孤立像素）
  if (forceFlat) {
    imageData = flattenGradients(imageData, pixelated.width, pixelated.height);
  }

  // Step 4: 轮廓强化（Sobel 边缘检测 + 黑色描边）
  if (edgeEnhance) {
    const edgeData = edgeDetect(imageData, pixelated.width, pixelated.height);
    imageData = applyEdgeOverlay(imageData, edgeData, pixelated.width, pixelated.height);
  }

  ctx.putImageData(imageData, 0, 0);
  return pixelated;
}

/**
 * 像素化：降采样 + 升采样，imageSmoothingEnabled = false 实现硬边缘
 */
function pixelate(image, pixelSize) {
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const outW = Math.max(1, Math.round(srcW / pixelSize));
  const outH = Math.max(1, Math.round(srcH / pixelSize));

  const small = document.createElement('canvas');
  small.width = outW;
  small.height = outH;
  const smallCtx = small.getContext('2d');
  smallCtx.imageSmoothingEnabled = false;
  smallCtx.drawImage(image, 0, 0, outW, outH);

  const result = document.createElement('canvas');
  result.width = srcW;
  result.height = srcH;
  const resultCtx = result.getContext('2d');
  resultCtx.imageSmoothingEnabled = false;
  resultCtx.drawImage(small, 0, 0, srcW, srcH);

  return result;
}

/**
 * 降采样到指定尺寸（用于预览），保持硬边缘
 */
export function pixelatePreview(image, pixelSize, previewWidth) {
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const ratio = previewWidth / srcW;
  const previewHeight = Math.round(srcH * ratio);
  const outW = Math.max(1, Math.round(srcW / pixelSize));
  const outH = Math.max(1, Math.round(srcH / pixelSize));

  const small = document.createElement('canvas');
  small.width = outW;
  small.height = outH;
  const smallCtx = small.getContext('2d');
  smallCtx.imageSmoothingEnabled = false;
  smallCtx.drawImage(image, 0, 0, outW, outH);

  const result = document.createElement('canvas');
  result.width = previewWidth;
  result.height = previewHeight;
  const resultCtx = result.getContext('2d');
  resultCtx.imageSmoothingEnabled = false;
  resultCtx.drawImage(small, 0, 0, previewWidth, previewHeight);

  return result;
}

/**
 * K-means 颜色量化，将图片色彩压缩到 maxColors 种
 */
function kMeansQuantize(imageData, width, height, maxColors) {
  const data = imageData.data;
  const totalPixels = width * height;

  const sampleRate = Math.min(1, 20000 / totalPixels);
  const pixels = [];
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    if (data[idx + 3] < 128) continue;
    if (sampleRate < 1 && Math.random() > sampleRate) continue;
    pixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }
  if (pixels.length < 2) return imageData;

  const k = Math.min(maxColors, pixels.length);
  if (k < 2) return imageData;

  const centroids = [];
  const step = Math.max(1, Math.floor((pixels.length - 1) / (k - 1)));
  for (let j = 0; j < k; j++) {
    const p = pixels[Math.min(j * step, pixels.length - 1)];
    centroids.push({ r: p.r, g: p.g, b: p.b });
  }

  const assignments = new Uint16Array(pixels.length);
  for (let iter = 0; iter < 20; iter++) {
    let changed = 0;
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      let minDist = Infinity;
      let best = 0;
      for (let j = 0; j < k; j++) {
        const c = centroids[j];
        const dr = p.r - c.r;
        const dg = p.g - c.g;
        const db = p.b - c.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) { minDist = dist; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed++; }
    }
    if (changed < pixels.length * 0.001) break;

    const sums = new Array(k);
    for (let j = 0; j < k; j++) sums[j] = { r: 0, g: 0, b: 0, count: 0 };
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i], j = assignments[i];
      sums[j].r += p.r; sums[j].g += p.g; sums[j].b += p.b; sums[j].count++;
    }
    for (let j = 0; j < k; j++) {
      if (sums[j].count > 0) {
        centroids[j].r = Math.round(sums[j].r / sums[j].count);
        centroids[j].g = Math.round(sums[j].g / sums[j].count);
        centroids[j].b = Math.round(sums[j].b / sums[j].count);
      }
    }
  }

  const lookup = new Uint8Array(k * 3);
  for (let j = 0; j < k; j++) {
    lookup[j * 3] = centroids[j].r;
    lookup[j * 3 + 1] = centroids[j].g;
    lookup[j * 3 + 2] = centroids[j].b;
  }

  const output = new Uint8ClampedArray(data);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    if (data[idx + 3] < 128) continue;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    let minDist = Infinity, best = 0;
    for (let j = 0; j < k; j++) {
      const dr = r - lookup[j * 3], dg = g - lookup[j * 3 + 1], db = b - lookup[j * 3 + 2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) { minDist = dist; best = j; }
    }
    output[idx] = lookup[best * 3];
    output[idx + 1] = lookup[best * 3 + 1];
    output[idx + 2] = lookup[best * 3 + 2];
  }

  return new ImageData(output, width, height);
}

/**
 * 强制平涂去渐变：3x3 邻域众数滤波
 */
function flattenGradients(imageData, width, height) {
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const colorCounts = new Map();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = (ny * width + nx) * 4;
            const key = ((data[nidx] / 16) | 0) * 65536 + ((data[nidx + 1] / 16) | 0) * 256 + ((data[nidx + 2] / 16) | 0);
            colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
          }
        }
      }
      let maxCount = 0, bestKey = null;
      for (const [key, count] of colorCounts) {
        if (count > maxCount) { maxCount = count; bestKey = key; }
      }
      if (bestKey != null) {
        const r = ((bestKey / 65536) | 0) * 16 + 8;
        const g = (((bestKey / 256) | 0) & 255) * 16 + 8;
        const b = (bestKey & 255) * 16 + 8;
        output[idx] = Math.min(255, r);
        output[idx + 1] = Math.min(255, g);
        output[idx + 2] = Math.min(255, b);
      }
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Sobel 边缘检测
 */
function edgeDetect(imageData, width, height) {
  const data = imageData.data;
  const gray = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  const edges = new Float32Array(width * height);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sumX = 0, sumY = 0, ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const g = gray[(y + dy) * width + (x + dx)];
          sumX += g * gx[ki];
          sumY += g * gy[ki];
          ki++;
        }
      }
      edges[y * width + x] = Math.sqrt(sumX * sumX + sumY * sumY);
    }
  }

  return edges;
}

/**
 * 将边缘检测结果以黑色描边叠加到图像上
 */
function applyEdgeOverlay(imageData, edgeData, width, height) {
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  let sum = 0, count = 0;
  for (let i = 0; i < width * height; i++) {
    sum += edgeData[i];
    if (edgeData[i] > 0) count++;
  }
  const threshold = count > 0 ? (sum / count) * 1.2 : 30;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (edgeData[y * width + x] > threshold) {
        output[idx] = 0;
        output[idx + 1] = 0;
        output[idx + 2] = 0;
      }
    }
  }

  return new ImageData(output, width, height);
}
