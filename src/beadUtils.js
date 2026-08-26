// 图纸生成工具函数 - 使用 bead-core-main 专业算法
import { runPipeline, computeColorStats, prepareSourcePixels } from '../bead-core-main/dist/index.js';
import { palette, colorName } from './palette.js';

const WHITE_BACKGROUND_RATIO = 0.78;

function isNearWhite(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 242 && max - min <= 18;
}

function hexRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbDistanceSquared(hexA, hexB) {
  const a = hexRgb(hexA);
  const b = hexRgb(hexB);
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

// 在原图采样网格上做边缘洪泛，避免把图案内部的白色一并当成背景。
function findExternalWhiteCells(rawData, imageWidth, imageHeight, gridWidth, gridHeight) {
  const white = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false));
  const cellW = imageWidth / gridWidth;
  const cellH = imageHeight / gridHeight;

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      let whiteCount = 0;
      const sampleSize = 5;
      for (let sy = 0; sy < sampleSize; sy++) {
        for (let sx = 0; sx < sampleSize; sx++) {
          const x = Math.min(imageWidth - 1, Math.floor((col + (sx + 0.5) / sampleSize) * cellW));
          const y = Math.min(imageHeight - 1, Math.floor((row + (sy + 0.5) / sampleSize) * cellH));
          const index = (y * imageWidth + x) * 4;
          if (isNearWhite(rawData[index], rawData[index + 1], rawData[index + 2])) whiteCount++;
        }
      }
      white[row][col] = whiteCount / (sampleSize * sampleSize) >= WHITE_BACKGROUND_RATIO;
    }
  }

  const external = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false));
  const queue = [];
  const enqueue = (row, col) => {
    if (!white[row]?.[col] || external[row][col]) return;
    external[row][col] = true;
    queue.push([row, col]);
  };
  for (let col = 0; col < gridWidth; col++) {
    enqueue(0, col);
    enqueue(gridHeight - 1, col);
  }
  for (let row = 0; row < gridHeight; row++) {
    enqueue(row, 0);
    enqueue(row, gridWidth - 1);
  }
  for (let index = 0; index < queue.length; index++) {
    const [row, col] = queue[index];
    enqueue(row - 1, col);
    enqueue(row + 1, col);
    enqueue(row, col - 1);
    enqueue(row, col + 1);
  }
  return external;
}

// 只清理没有同色邻居的孤立彩色格，避免抹掉白色细节和连续像素边缘。
function removeIsolatedColorNoise(grid) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const result = grid.map((row) => row.map((cell) => (cell ? { ...cell } : cell)));
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = grid[row][col];
      if (!cell || cell.isExternal || cell.paletteId === 'H2') continue;
      const neighbors = [];
      for (const [dr, dc] of directions) {
        const neighbor = grid[row + dr]?.[col + dc];
        if (neighbor && !neighbor.isExternal) neighbors.push(neighbor);
      }
      if (neighbors.some((neighbor) => neighbor.paletteId === cell.paletteId)) continue;
      const counts = new Map();
      for (const neighbor of neighbors) counts.set(neighbor.paletteId, (counts.get(neighbor.paletteId) || 0) + 1);
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!dominant || dominant[1] < 3) continue;
      const replacement = neighbors.find((neighbor) => neighbor.paletteId === dominant[0]);
      // 只替换与邻色接近的边缘色晕；黑色眼睛、彩色腮红等高对比细节要保留。
      if (replacement && rgbDistanceSquared(cell.hex, replacement.hex) <= 90 ** 2) {
        result[row][col] = { paletteId: replacement.paletteId, hex: replacement.hex };
      }
    }
  }
  return result;
}

// 将图片转换为拼豆网格（使用 bead-core-main 的专业算法）
export function convertImageToBeads(image, gridWidth, options = {}) {
  const { ignoreEdgeWhite = true, mergeThreshold = 0 } = options;
  const canvas = document.createElement('canvas');
  const imgW = image.naturalWidth;
  const imgH = image.naturalHeight;

  // 计算目标高度
  const gridHeight = Math.max(1, Math.round(gridWidth * imgH / imgW));

  // 原始版本：先放大到 gridWidth * 5，保证采样精度
  const imageWidth = gridWidth * 5;
  const imageHeight = gridHeight * 5;
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 先填充白色背景，避免 PNG 透明区域变成杂色
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, imageWidth, imageHeight);

  // 按比例缩放并居中绘制（保持原始比例，cover 模式，和原版一致）
  const scale = Math.max(imageWidth / imgW, imageHeight / imgH);
  const drawWidth = imgW * scale;
  const drawHeight = imgH * scale;
  ctx.drawImage(image, (imageWidth - drawWidth) / 2, (imageHeight - drawHeight) / 2, drawWidth, drawHeight);

  const imgData = ctx.getImageData(0, 0, imageWidth, imageHeight);

  // 像素画边缘不做锐化，避免高对比轮廓产生彩色光晕和孤立杂点。
  const pixels = prepareSourcePixels(
    imgData.data,
    imageWidth,
    imageHeight,
    { brightness: 0, contrast: 0, saturation: 0 },
    { denoise: false, sharpen: false }
  );

  // 使用 bead-core-main 的内置 flood fill 去背景
  // backgroundPaletteIds: 白色背景色的色板 ID
  const result = runPipeline(pixels, imageWidth, imageHeight, {
    gridWidth,
    // dominant 模式会在每个格内优先保留稀有特征色，避免细线、眼睛和高光被中心点采样吞掉。
    mode: 'dominant',
    mergeThreshold,
    maxColors: 0,
    // 背景改由原图采样网格判断，避免量化后内部白色与边缘背景混淆。
    backgroundPaletteIds: [],
    excludedPaletteIds: [],
    palette,
    flatTile: false,
  });

  let grid = result.grid;

  if (ignoreEdgeWhite) {
    const externalWhite = findExternalWhiteCells(
      imgData.data,
      imageWidth,
      imageHeight,
      result.width,
      result.height,
    );
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (externalWhite[row][col]) grid[row][col] = { ...grid[row][col], isExternal: true };
      }
    }
  }

  grid = removeIsolatedColorNoise(grid);

  // 填补空单元格：未匹配到色板的格子自动匹配最近色（Q版/浅色区域缺色修复）
  // 注意：白色背景（H2）被去背景后会变成 null，这些不填补，保持空白
  let fixedCount = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell == null || cell === 0 || (typeof cell === 'object' && (cell.paletteId == null && cell.colorIndex == null && cell.index == null))) {
        const px = Math.floor(c * imageWidth / gridWidth);
        const py = Math.floor(r * imageHeight / grid.length);
        const idx = (py * imageWidth + px) * 4;
        const r1 = pixels[idx], g1 = pixels[idx + 1], b1 = pixels[idx + 2];
        // 如果原始像素接近白色（是背景），不填补，保持为空
        if (r1 >= 250 && g1 >= 250 && b1 >= 250) continue;
        let bestId = null, bestHex = null, bestDist = Infinity;
        for (let p = 0; p < palette.length; p++) {
          const hex = palette[p].hex;
          const r2 = parseInt(hex.slice(1, 3), 16);
          const g2 = parseInt(hex.slice(3, 5), 16);
          const b2 = parseInt(hex.slice(5, 7), 16);
          const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) { bestDist = dist; bestId = palette[p].id; bestHex = hex; }
        }
        if (bestId) {
          grid[r][c] = { paletteId: bestId, hex: bestHex };
          fixedCount++;
        }
      }
    }
  }
  if (fixedCount > 0) {
    console.log(`[拼豆修复] 填补了 ${fixedCount} 个空单元格`);
  }

  // 计算颜色统计
  const codeLookup = (id) => {
    const entry = palette.find(p => p.id === id);
    return entry?.codes?.MARD || id;
  };
  const statsData = computeColorStats(grid, 'MARD', codeLookup);
  const stats = statsData.map((s) => ({
    paletteId: s.paletteId,
    code: s.displayCode,
    hex: s.hex,
    name: colorName(s.paletteId),
    count: s.count,
  }));

  let totalBeads = 0;
  for (const s of stats) totalBeads += s.count;

  return {
    grid,
    gridWidth: result.width,
    gridHeight: result.height,
    stats,
    totalBeads,
  };
}

// 在 Canvas 上绘制拼豆图纸
export function drawPatternCanvas(canvas, grid, options = {}) {
  const {
    cellSize = 20,
    showGrid = true,
    showChunkLines = true,
    showCodes = false,
    chunkSize = 5,
  } = options;

  const gridHeight = grid.length;
  const gridWidth = grid[0]?.length || 0;

  canvas.width = gridWidth * cellSize;
  canvas.height = gridHeight * cellSize;
  const ctx = canvas.getContext('2d');

  // 填充白色背景（避免 PNG 透明区域显示为黑色）
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 填充每个格子
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      // 外部背景格不属于拼豆，预览和导出时都跳过。
      if (!cell || cell.isExternal) continue;

      const hex = cell.hex || '#ffffff';
      ctx.fillStyle = hex;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

      if (showCodes && cellSize >= 10) {
        const code = cell.paletteId || '';
        const codeLen = code.length;
        // 动态字号：字符越多字号越小，确保不爆格
        let fontSize;
        if (codeLen <= 2) {
          fontSize = Math.floor(cellSize * 0.42);
        } else if (codeLen === 3) {
          fontSize = Math.floor(cellSize * 0.36);
        } else {
          fontSize = Math.floor(cellSize * 0.30);
        }
        fontSize = Math.max(7, fontSize);
        ctx.fillStyle = getContrastColor(hex);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code, x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
      }
    }
  }

  // 画网格线
  if (showGrid && cellSize >= 6) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= gridWidth; x++) {
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, gridHeight * cellSize);
    }
    for (let y = 0; y <= gridHeight; y++) {
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(gridWidth * cellSize, y * cellSize + 0.5);
    }
    ctx.stroke();
  }

  // 画 5×5 分块线
  if (showChunkLines && cellSize >= 4) {
    ctx.strokeStyle = 'rgba(147, 130, 212, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= gridWidth; x += chunkSize) {
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, gridHeight * cellSize);
    }
    for (let y = 0; y <= gridHeight; y += chunkSize) {
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(gridWidth * cellSize, y * cellSize + 0.5);
    }
    ctx.stroke();
  }
}

// 计算对比色（黑或白）
function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
}

// 绘制水印
export function drawWatermark(ctx, width, height, text = '十三拼豆坊 仅供预览') {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const stepX = 260;
  const stepY = 160;
  const angle = -22 * Math.PI / 180;

  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
}

// 导出带色卡清单的图纸（下方留白显示颜色+色号+数量）
export function exportPatternWithLegend(grid, stats, options = {}) {
  const {
    cellSize = 20,
    showGrid = true,
    showChunkLines = true,
    showCodes = true,
    chunkSize = 5,
  } = options;

  const gridHeight = grid.length;
  const gridWidth = grid[0]?.length || 0;
  const patternWidth = gridWidth * cellSize;

  // 色卡区域参数
  const legendPadding = 20;
  const legendItemHeight = 24;
  const legendItemGap = 8;
  const colorBoxSize = 18;
  const legendTitleHeight = 28;
  const legendCols = 2; // 两列显示
  const colWidth = Math.floor((patternWidth - legendPadding * 2 - 20) / legendCols);

  const legendRows = Math.ceil(stats.length / legendCols);
  const legendHeight = legendTitleHeight + legendRows * (legendItemHeight + legendItemGap) + legendPadding * 2;

  const canvas = document.createElement('canvas');
  const totalHeight = gridHeight * cellSize + legendHeight;
  canvas.width = patternWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  // 白色背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 先画图
  const patternCanvas = document.createElement('canvas');
  drawPatternCanvas(patternCanvas, grid, {
    cellSize,
    showGrid,
    showChunkLines,
    showCodes,
    chunkSize,
  });
  ctx.drawImage(patternCanvas, 0, 0);

  // 色卡标题
  const legendY = gridHeight * cellSize;
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`颜色清单（共 ${stats.length} 色，${stats.reduce((s, c) => s + c.count, 0)} 颗）`, legendPadding, legendY + legendPadding);

  // 色卡条目
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  stats.forEach((stat, idx) => {
    const col = idx % legendCols;
    const row = Math.floor(idx / legendCols);
    const x = legendPadding + col * (colWidth + 20);
    const y = legendY + legendPadding + legendTitleHeight + row * (legendItemHeight + legendItemGap);

    // 颜色方块
    ctx.fillStyle = stat.hex;
    ctx.fillRect(x, y, colorBoxSize, colorBoxSize);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, colorBoxSize - 1, colorBoxSize - 1);

    // 色号 + 名称 + 数量
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textX = x + colorBoxSize + 8;
    const textY = y + colorBoxSize / 2;
    ctx.fillText(`${stat.code}  ${stat.name}`, textX, textY);

    // 数量右对齐
    ctx.textAlign = 'right';
    ctx.fillStyle = '#666666';
    ctx.fillText(`${stat.count}颗`, x + colWidth, textY);
  });

  return canvas;
}

// 导出 CSV 色卡清单
export function exportCSV(stats, gridWidth, gridHeight, totalBeads) {
  const header = '色号,颜色名称,数量,HEX';
  const rows = stats.map((s) => `${s.code},${s.name},${s.count},${s.hex}`).join('\n');
  const meta = `\n\n图纸尺寸,${gridWidth} × ${gridHeight}\n拼豆总数,${totalBeads}`;
  return header + '\n' + rows + meta;
}
