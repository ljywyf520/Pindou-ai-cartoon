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

  // 智能去背景：用原始图像像素计算图案边界（bounding box）
  // 比 flood fill 更安全，不会误删图案内部的白色
  if (ignoreEdgeWhite) {
    const gridH = grid.length;
    const gridW = grid[0]?.length || 0;
    let minRow = gridH, maxRow = -1, minCol = gridW, maxCol = -1;

    // 用原始图像数据（锐化前）来判断
    // 阈值放宽到 240，避免 JPG 压缩导致白色背景偏灰被误判为内容
    const rawData = imgData.data;
    const isWhite = (r, g, b) => r >= 240 && g >= 240 && b >= 240;

    // 每个格子均匀采样 9 个点
    // 白色点占比 >= 70% 才认为是背景格子，否则算图案内容
    for (let r = 0; r < gridH; r++) {
      for (let c = 0; c < gridW; c++) {
        const cellW = imageWidth / gridW;
        const cellH = imageHeight / gridH;
        const samples = [];
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            const sx = Math.floor(c * cellW + cellW * (dx + 0.5) / 3);
            const sy = Math.floor(r * cellH + cellH * (dy + 0.5) / 3);
            samples.push([sx, sy]);
          }
        }
        let whiteCount = 0;
        for (const [sx, sy] of samples) {
          const idx = (sy * imageWidth + sx) * 4;
          if (isWhite(rawData[idx], rawData[idx + 1], rawData[idx + 2])) {
            whiteCount++;
          }
        }
        // 白色点少于 70% = 这个格子有图案内容
        if (whiteCount / samples.length < 0.7) {
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
          if (c < minCol) minCol = c;
          if (c > maxCol) maxCol = c;
        }
      }
    }

    // 边界外的格子直接置空（背景）
    if (maxRow >= 0) {
      minRow = Math.max(0, minRow - 1);
      maxRow = Math.min(gridH - 1, maxRow + 1);
      minCol = Math.max(0, minCol - 1);
      maxCol = Math.min(gridW - 1, maxCol + 1);

      for (let r = 0; r < gridH; r++) {
        for (let c = 0; c < gridW; c++) {
          const isOutside = r < minRow || r > maxRow || c < minCol || c > maxCol;
          if (isOutside) {
            grid[r][c] = null;
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
      if (!cell) continue;

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
