// 图纸生成工具函数 - 使用 bead-core-main 专业算法
import { runPipeline, computeColorStats, prepareSourcePixels } from '../bead-core-main/dist/index.js';
import { palette, backgroundPaletteIds, colorName } from './palette.js';

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

  // 像素预处理：锐化（与原始 studio 版本一致）
  const pixels = prepareSourcePixels(
    imgData.data,
    imageWidth,
    imageHeight,
    { brightness: 0, contrast: 0, saturation: 0 },
    { denoise: false, sharpen: true }
  );

  // 使用 bead-core-main 的专业管线（和原始版本完全一致的参数）
  // 注意：backgroundPaletteIds 传空，不用内置的 flood fill（容易误删内部白色）
  const result = runPipeline(pixels, imageWidth, imageHeight, {
    gridWidth,
    mode: 'average',
    mergeThreshold,
    maxColors: 0,
    backgroundPaletteIds: [],
    excludedPaletteIds: [],
    palette,
    flatTile: false,
  });

  const grid = result.grid;

  // 智能去背景：用原始像素亮度计算图案边界（bounding box）
  // 比 flood fill 更安全，不会误删图案内部的白色
  if (ignoreEdgeWhite) {
    const gridH = grid.length;
    const gridW = grid[0]?.length || 0;
    let minRow = gridH, maxRow = -1, minCol = gridW, maxCol = -1;

    // 用原始像素的亮度来判断是否为图案内容
    // 纯白色（RGB 都 >= 253）才算背景，其他即使很白也算图案的一部分
    const isBgPixel = (r, g, b) => r >= 253 && g >= 253 && b >= 253;

    // 遍历每个格子，取格子中心像素判断
    for (let r = 0; r < gridH; r++) {
      for (let c = 0; c < gridW; c++) {
        const px = Math.floor((c + 0.5) * imageWidth / gridW);
        const py = Math.floor((r + 0.5) * imageHeight / gridH);
        const idx = (py * imageWidth + px) * 4;
        const pr = pixels[idx], pg = pixels[idx + 1], pb = pixels[idx + 2];
        if (!isBgPixel(pr, pg, pb)) {
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
          if (c < minCol) minCol = c;
          if (c > maxCol) maxCol = c;
        }
      }
    }

    // 边界外扩 1 格，避免边缘被切掉
    if (maxRow >= 0) {
      minRow = Math.max(0, minRow - 1);
      maxRow = Math.min(gridH - 1, maxRow + 1);
      minCol = Math.max(0, minCol - 1);
      maxCol = Math.min(gridW - 1, maxCol + 1);

      // 边界外的格子标记为外部背景
      for (let r = 0; r < gridH; r++) {
        for (let c = 0; c < gridW; c++) {
          const cell = grid[r][c];
          if (!cell) continue;
          const isOutside = r < minRow || r > maxRow || c < minCol || c > maxCol;
          if (isOutside) {
            cell.isExternal = true;
          }
        }
      }
    }
  }

  // 填补空单元格：未匹配到色板的格子自动匹配最近色（Q版/浅色区域缺色修复）
  let fixedCount = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell == null || cell === 0 || (typeof cell === 'object' && (cell.paletteId == null && cell.colorIndex == null && cell.index == null))) {
        const px = Math.floor(c * imageWidth / gridWidth);
        const py = Math.floor(r * imageHeight / grid.length);
        const idx = (py * imageWidth + px) * 4;
        const r1 = pixels[idx], g1 = pixels[idx + 1], b1 = pixels[idx + 2];
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
export function drawWatermark(ctx, width, height, text = '十三工坊 仅供预览') {
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

// 导出 CSV 色卡清单
export function exportCSV(stats, gridWidth, gridHeight, totalBeads) {
  const header = '色号,颜色名称,数量,HEX';
  const rows = stats.map((s) => `${s.code},${s.name},${s.count},${s.hex}`).join('\n');
  const meta = `\n\n图纸尺寸,${gridWidth} × ${gridHeight}\n拼豆总数,${totalBeads}`;
  return header + '\n' + rows + meta;
}
