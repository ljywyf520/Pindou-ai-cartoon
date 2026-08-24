import { runPipeline, prepareSourcePixels, computeColorStats, countTotalBeads } from '../bead-core-main/dist/index.js';
import { palette, backgroundPaletteIds } from './palette.js';
import { generateChibi } from './chibiGenerator.js';
import { activateLicense, activateChibiLicense, getLicenseState, consumeExport, canGenerateChibi, consumeChibi, checkUrlCode } from './license.js';

const $ = (selector) => document.querySelector(selector);
const state = { image: null, grid: null, resultPalette: [], stats: [], rawResult: null, patternWidth: 0, patternHeight: 0, mode: 'photo', patternView: 'color', sourceZoom: 1, patternZoom: 1, mirrorX: false, flipY: false, enabled: new Set(palette.map((item) => item.id)), codesHidden: false, originalImage: null, baseGridWidth: 48 };

// ============================================================
// 授权 & 水印系统
// ============================================================
function drawWatermark(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#6B5B95';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.rotate(-Math.PI / 6);
  const text = '十三工坊 仅供预览';
  const spacing = 200;
  for (let y = -height; y < height * 2; y += spacing) {
    for (let x = -width; x < width * 2; x += spacing) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#6B5B95';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('十三工坊 仅供预览', width - 12, height - 12);
  ctx.restore();
}

function updateLicenseUI() {
  const ls = getLicenseState();
  const banner = $('#license-banner');
  const creditsDisplay = $('#credits-display');
  const exportBtns = document.querySelectorAll('#download-beads, #download-pattern');
  if (!banner || !creditsDisplay) return;

  if (ls.activated) {
    banner.className = 'license-banner active';
    if (ls.isPermanent) {
      banner.innerHTML = '<span class="license-badge permanent">永久会员</span><span>已激活 · 无限导出</span>';
      creditsDisplay.textContent = '无限';
    } else {
      banner.innerHTML = `<span class="license-badge times">按次用户</span><span>剩余导出次数：<b>${ls.credits}</b> 次</span>`;
      creditsDisplay.textContent = `${ls.credits} 次`;
    }
    exportBtns.forEach((btn) => { btn.disabled = false; btn.classList.remove('disabled'); });
  } else {
    banner.className = 'license-banner inactive';
    banner.innerHTML = '<span class="license-badge free">免费体验</span><span>预览带水印 · 导出需授权码</span>';
    creditsDisplay.textContent = '0 次';
    exportBtns.forEach((btn) => { btn.disabled = true; btn.classList.add('disabled'); });
  }

  const chibiInfo = canGenerateChibi();
  const chibiBtn = $('#chibi-generate');
  const chibiStatus = $('#chibi-status');
  if (chibiBtn) {
    if (chibiInfo.can) {
      chibiBtn.disabled = !state.image;
      if (chibiStatus) {
        const remainingText = `${chibiInfo.remaining} 次`;
        chibiStatus.className = 'chibi-status info';
        chibiStatus.textContent = `Q版生成剩余：${remainingText}（${chibiInfo.source}）`;
      }
    } else {
      chibiBtn.disabled = true;
      if (chibiStatus) {
        chibiStatus.className = 'chibi-status warn';
        chibiStatus.textContent = '免费Q版生成次数已用完，请激活Q版次数包后继续使用';
      }
    }
  }
}

function activateChibiFromInput() {
  const chibiInput = $('#chibi-license-input');
  const code = (chibiInput?.value?.trim() || '').trim();
  if (!code) {
    status('请输入Q版授权码');
    chibiInput?.focus();
    return;
  }
  const result = activateChibiLicense(code);
  if (result.success) {
    status(result.message);
    if (chibiInput) chibiInput.value = '';
    updateLicenseUI();
  } else {
    status('授权失败：' + result.error);
    chibiInput?.classList.add('error');
    setTimeout(() => { chibiInput?.classList.remove('error'); }, 2000);
  }
}

function showPaywallModal(source = 'export') {
  const modal = $('#paywall-modal');
  const title = $('#paywall-title');
  const desc = $('#paywall-desc');
  if (!modal) return;
  if (source === 'chibi') {
    title.textContent = 'Q版生成次数已用完';
    desc.textContent = '免费体验的 3 次 Q版生成已用完。激活授权码后可继续使用 AI Q版生成功能。';
  } else {
    title.textContent = '导出无水印图纸需要授权码';
    desc.textContent = '您可以一直免费预览图纸（带水印），导出无水印高清图纸需要授权码。';
  }
  modal.hidden = false;
}

function hidePaywallModal() {
  const modal = $('#paywall-modal');
  if (modal) modal.hidden = true;
}

function activateFromInput() {
  const licenseInput = $('#license-input');
  const paywallInput = $('#paywall-license-input');
  const code = (paywallInput?.value?.trim() || licenseInput?.value?.trim() || '').trim();
  if (!code) {
    status('请输入授权码');
    licenseInput?.focus();
    return;
  }
  const result = activateLicense(code);
  if (result.success) {
    status(result.message);
    if (licenseInput) licenseInput.value = '';
    if (paywallInput) paywallInput.value = '';
    updateLicenseUI();
    hidePaywallModal();
  } else {
    status('授权失败：' + result.error);
    licenseInput?.classList.add('error');
    paywallInput?.classList.add('error');
    setTimeout(() => { licenseInput?.classList.remove('error'); paywallInput?.classList.remove('error'); }, 2000);
  }
}
const input = $('#image-input'); const uploadBox = $('#upload-box'); const sourceCanvas = $('#source-canvas'); const patternCanvas = $('#pattern-canvas'); const sourceContext = sourceCanvas.getContext('2d');
const names = { white: '纯白', milk: '牛奶白', ivory: '象牙', cream: '奶油', stone: '石灰', silver: '银灰', grey: '雾灰', charcoal: '炭灰', black: '黑曜', blush: '腮红粉', pink: '樱粉', rose: '玫红', berry: '莓果红', red: '正红', brick: '砖红', coral: '珊瑚橙', apricot: '杏橙', orange: '南瓜橙', rust: '铁锈橙', butter: '黄油黄', lemon: '柠檬黄', mustard: '芥末黄', lime: '青柠绿', olive: '橄榄绿', sage: '鼠尾草', mint: '薄荷绿', jade: '玉石绿', green: '青草绿', forest: '森林绿', moss: '苔藓绿', ice: '冰川蓝', sky: '晴空蓝', denim: '牛仔蓝', sea: '海盐蓝', teal: '青绿', blue: '宝石蓝', cobalt: '钴蓝', navy: '深海蓝', midnight: '午夜蓝', lilac: '丁香紫', lavender: '薰衣草', violet: '紫罗兰', plum: '梅子紫', mauve: '灰紫', sand: '沙砾棕', camel: '焦糖棕', brown: '深棕', chestnut: '栗棕', espresso: '浓缩咖啡', peach: '蜜桃', lemonade: '柠檬汽水', aqua: '水蓝', petrol: '石油蓝', periwinkle: '长春花', orchid: '兰花紫', wine: '葡萄酒红', copper: '铜色', khaki: '卡其', graphite: '石墨', clear: '透明白' };
const humanName = (id) => palette.find((item) => item.id === id)?.name ?? names[id] ?? id; const selectedBrand = () => $('#brand-system').value;
// 【色号修复】所有输出优先读取颜色对象原始 code（如 A09、B11），缺失时才数字兜底。
// 色号只认色板对象的 code；没有 code 时才使用像素索引等兜底值，绝不把 id 当官方色号。
const codeForColor = (color, fallback = '') => String(color?.code || color?.codes?.[selectedBrand()] || fallback || color?.id || '');
function resolveColor(cell) {
  if (cell == null) return null;
  if (typeof cell === 'number') return state.resultPalette[cell] ?? palette[cell] ?? null;
  if (typeof cell === 'string') return state.resultPalette.find((item) => item.id === cell || item.code === cell) ?? palette.find((item) => item.id === cell || item.code === cell) ?? null;
  if (cell.paletteId != null) return state.resultPalette.find((item) => item.id === cell.paletteId) ?? palette.find((item) => item.id === cell.paletteId) ?? cell;
  if (cell.colorIndex != null || cell.paletteIndex != null || cell.index != null) return state.resultPalette[cell.colorIndex ?? cell.paletteIndex ?? cell.index] ?? cell;
  return cell;
}
const codeFor = (cell, fallback = '') => codeForColor(resolveColor(cell), fallback || cell?.paletteId || cell?.index);
const statCode = (item, index) => { const direct = String(item?.code || '').trim(); if (direct) return direct; return codeForColor(resolveColor(item?.paletteId ?? item?.index ?? index), item?.paletteId ?? item?.index ?? index); };
// 【本次修复：结果适配层】兼容 bear-code 的 pixelGrid/palette/colorStats 结构，以及仓库当前的 grid 结构。
function normalizeConversionResult(result, fallbackPalette) {
  const pixelGrid = result?.pixelGrid ?? result?.grid ?? [];
  const resultPalette = result?.palette ?? fallbackPalette;
  const directStats = Array.isArray(result?.colorStats) ? result.colorStats : null;
  state.rawResult = result;
  state.resultPalette = resultPalette;
  state.grid = pixelGrid;
  state.patternWidth = result?.width ?? pixelGrid[0]?.length ?? 0;
  state.patternHeight = result?.height ?? pixelGrid.length;
  if (directStats) {
    // 不过滤底层统计项；每一项的 code/hex/count 原样保留，只补 displayCode 供旧 UI 使用。
    state.stats = directStats.map((item, index) => ({ ...item, code: statCode(item, index), displayCode: statCode(item, index) }));
  } else {
    // 当前仓库构建产物没有 colorStats，使用公开统计函数作为兼容回退，不改变转换结果。
    const objectGrid = pixelGrid.length && typeof pixelGrid[0]?.[0] === 'object';
    if (objectGrid) {
      state.stats = computeColorStats(pixelGrid, selectedBrand(), (id) => codeForColor(resolveColor({ paletteId: id }), id)).map((item) => ({ ...item, code: codeForColor(resolveColor({ paletteId: item.paletteId }), item.paletteId), displayCode: codeForColor(resolveColor({ paletteId: item.paletteId }), item.paletteId) }));
    } else {
      const counts = new Map();
      pixelGrid.flat().forEach((cell) => { const color = resolveColor(cell); if (!color) return; const key = color.id ?? color.code ?? String(cell); const current = counts.get(key) || { paletteId: color.id, code: codeForColor(color, cell), hex: color.hex || '#fff', count: 0 }; current.count += 1; counts.set(key, current); });
      state.stats = Array.from(counts.values()).map((item) => ({ ...item, displayCode: item.code }));
    }
  }
  return { pixelGrid, resultPalette, colorStats: state.stats };
}
// 【本次色差修复】所有品牌下拉选项统一使用用户提供的实体色卡。
const activePalette = () => { const enabled = palette.filter((item) => state.enabled.has(item.id)); return enabled.length ? enabled : [palette[0]]; };
function status(message) { $('#status-line').textContent = message; }
function updateOutputs() { const width = Number($('#grid-width').value); $('#grid-width-output').textContent = width; $('#zoom-scale-output').textContent = `${$('#zoom-scale').value}%`; const max = Number($('#max-colors').value); $('#max-colors-output').textContent = max ? max : '不限'; const tolerance = Number($('#tolerance').value); $('#tolerance-output').textContent = tolerance < 8 ? '低' : tolerance < 24 ? '中' : '高'; const height = targetHeight(); $('#size-hint').textContent = `当前预计图纸：${width} × ${height} 格`; $('#size-warning').hidden = width * height <= 9000; }
// 【缺色修复】UI 的颜色容差不是 bear-code 的 ΔE 合并阈值。默认关闭区域合并，最高只传 2，避免浅肤色被合并成白色。
function mergeThresholdValue() { return Math.min(2, Math.floor(Number($('#tolerance').value) / 20)); }
function targetHeight() { if (!state.image) return 48; return Math.min(200, Math.max(8, Math.round(Number($('#grid-width').value) * state.image.naturalHeight / state.image.naturalWidth))); }
// 【本次手机适配】手机端 100% 初始视图按容器宽度缩放，放大后恢复可滚动的大图。
function setCanvasDisplay(canvas, zoom) { const wrap = canvas.parentElement; const mobile = window.matchMedia('(max-width: 820px)').matches; const available = wrap ? Math.max(1, wrap.clientWidth - 36) : canvas.width; const baseWidth = mobile ? Math.min(canvas.width, available) : canvas.width; const displayWidth = Math.max(1, Math.round(baseWidth * zoom)); const displayHeight = Math.max(1, Math.round(canvas.height * (displayWidth / Math.max(1, canvas.width)))); canvas.style.width = `${displayWidth}px`; canvas.style.height = `${displayHeight}px`; }
function drawSource() { if (!state.image) return; const scale = Math.min(1, 900 / Math.max(state.image.naturalWidth, state.image.naturalHeight)); sourceCanvas.width = Math.max(1, Math.round(state.image.naturalWidth * scale)); sourceCanvas.height = Math.max(1, Math.round(state.image.naturalHeight * scale)); sourceContext.imageSmoothingEnabled = true; sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height); sourceContext.drawImage(state.image, 0, 0, sourceCanvas.width, sourceCanvas.height); setCanvasDisplay(sourceCanvas, state.sourceZoom); $('#source-size').textContent = `${state.image.naturalWidth} × ${state.image.naturalHeight}`; }
function updatePreview() { const hasImage = Boolean(state.image); $('#empty-state').hidden = hasImage; $('#dual-preview').hidden = !hasImage; patternCanvas.hidden = !state.grid; $('#pattern-placeholder').hidden = Boolean(state.grid); if (hasImage) { setCanvasDisplay(sourceCanvas, state.sourceZoom); if (state.grid) setCanvasDisplay(patternCanvas, state.patternZoom); } }
function setImage(image) { state.image = image; state.grid = null; state.resultPalette = []; state.rawResult = null; state.stats = []; state.sourceZoom = 1; state.patternZoom = 1; state.mirrorX = false; state.flipY = false; state.baseGridWidth = Number($('#grid-width').value) || 48; drawSource(); updatePreview(); $('#generate').disabled = false; $('#replace-image').hidden = false; $('#image-tools').hidden = false; $('#upload-success').hidden = false; $('#results').hidden = true; $('#inline-stats').hidden = true; $('#canvas-size').textContent = `${image.naturalWidth} × ${image.naturalHeight} 像素`; status('图片已载入，请设置参数后生成图纸'); updateOutputs(); }
function loadImage(file) { if (!file || !file.type.startsWith('image/')) return; if (file.size > 20 * 1024 * 1024) { status('图片超过 20 MB，请压缩后再试'); return; } const url = URL.createObjectURL(file); const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); state.originalImage = image; setImage(image); }; image.onerror = () => { URL.revokeObjectURL(url); status('图片读取失败，请换一张图片'); }; image.src = url; }
function imageFromCanvas(canvas) { return new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.src = canvas.toDataURL('image/png'); }); }
async function rotateImage(direction) { if (!state.image) return; const source = state.image; const canvas = document.createElement('canvas'); canvas.width = source.naturalHeight; canvas.height = source.naturalWidth; const ctx = canvas.getContext('2d'); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(direction * Math.PI / 2); ctx.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2); setImage(await imageFromCanvas(canvas)); status('图片已旋转，可继续调整后生成图纸'); }
async function cropImage() { if (!state.image || $('#crop-ratio').value === 'original') { status('请选择一个裁剪比例'); return; } const [rw, rh] = $('#crop-ratio').value.split(':').map(Number); const source = state.image; const ratio = rw / rh; const sourceRatio = source.naturalWidth / source.naturalHeight; let cropWidth = source.naturalWidth; let cropHeight = source.naturalHeight; if (sourceRatio > ratio) cropWidth = Math.round(source.naturalHeight * ratio); else cropHeight = Math.round(source.naturalWidth / ratio); const sx = Math.round((source.naturalWidth - cropWidth) / 2); const sy = Math.round((source.naturalHeight - cropHeight) / 2); const canvas = document.createElement('canvas'); canvas.width = cropWidth; canvas.height = cropHeight; canvas.getContext('2d').drawImage(source, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight); setImage(await imageFromCanvas(canvas)); status(`已按 ${rw}:${rh} 居中裁剪`); }
function renderPalettePicker() { const picker = $('#palette-picker'); picker.innerHTML = palette.map((item) => `<button type="button" class="palette-chip ${state.enabled.has(item.id) ? 'active' : 'off'}" style="background:${item.hex}" data-palette-id="${item.id}" title="${humanName(item.id)} ${codeFor({ paletteId: item.id })}"></button>`).join(''); picker.querySelectorAll('.palette-chip').forEach((button) => button.addEventListener('click', () => { const id = button.dataset.paletteId; if (state.enabled.has(id)) { if (state.enabled.size <= 2) return; state.enabled.delete(id); } else state.enabled.add(id); renderPalettePicker(); })); $('#palette-toggle').textContent = state.enabled.size === palette.length ? '全不选' : '全选'; }
// 【本次迭代新增：图纸渲染模块】视图、镜像、翻转、网格和色号均在这里完成，不触碰底层算法。
function drawPattern(view = state.patternView, target = patternCanvas, options = {}) {
  if (!state.grid?.length) return { cell: 0, codesHidden: false };
  const grid = state.grid; const cols = grid[0].length; const rows = grid.length;
  // 打印视图使用固定大格子，滚动容器负责查看大图，保证每个格子都能显示完整色号。
  const cell = view === 'number' ? 32 : Math.max(10, Math.min(28, Math.floor(1120 / Math.max(cols, rows)))); const border = 0; const showGrid = options.showGrid ?? true; const showCodes = view === 'number'; const ctx = target.getContext('2d'); target.width = cols * cell + border * 2; target.height = rows * cell + border * 2; ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, target.width, target.height);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const sourceRow = state.flipY ? rows - 1 - r : r; const sourceCol = state.mirrorX ? cols - 1 - c : c; const rawCell = grid[sourceRow][sourceCol]; const item = resolveColor(rawCell); if (!item || (typeof rawCell === 'object' && rawCell.isExternal)) continue; const x = border + c * cell; const y = border + r * cell; const hex = item.hex || '#FFFFFF'; ctx.fillStyle = hex; ctx.fillRect(x, y, cell, cell); if (showCodes) { const code = codeFor(item, rawCell?.paletteId ?? rawCell); const rgb = (hex.match(/[A-Fa-f0-9]{2}/g) || ['FF', 'FF', 'FF']).map((value) => parseInt(value, 16)); const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000; ctx.fillStyle = luminance > 150 ? '#20231f' : '#FFFFFF'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(code, x + cell / 2, y + cell / 2); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'; } }
  if (showGrid) { ctx.strokeStyle = 'rgba(37,42,35,.3)'; ctx.lineWidth = Math.max(.5, cell * .06); ctx.beginPath(); for (let c = 0; c <= cols; c++) { ctx.moveTo(border + c * cell, border); ctx.lineTo(border + c * cell, border + rows * cell); } for (let r = 0; r <= rows; r++) { ctx.moveTo(border, border + r * cell); ctx.lineTo(border + cols * cell, border + r * cell); } ctx.stroke(); }
  // 5×5 分块线：淡紫色、稍粗，每 5 格一条
  const showBlockGrid = options.showBlockGrid ?? true;
  if (showBlockGrid && cols >= 5 && rows >= 5) {
    const blockSize = 5;
    ctx.strokeStyle = 'rgba(147, 130, 212, 0.85)';
    ctx.lineWidth = Math.max(1.5, cell * 0.12);
    ctx.beginPath();
    for (let c = 0; c <= cols; c += blockSize) {
      ctx.moveTo(border + c * cell, border);
      ctx.lineTo(border + c * cell, border + rows * cell);
    }
    for (let r = 0; r <= rows; r += blockSize) {
      ctx.moveTo(border, border + r * cell);
      ctx.lineTo(border + cols * cell, border + r * cell);
    }
    ctx.stroke();
  }
  state.patternWidth = cols; state.patternHeight = rows; state.codesHidden = false; return { cell, codesHidden: false };
}
// 【本次迭代新增：色卡统计模块】统计直接读取 bear-code 返回的 grid，外部留白不会计数。
function renderStats() { if (!state.grid) return; const total = state.stats.reduce((sum, item) => sum + Number(item.count || 0), 0); $('#stats-total').textContent = `共 ${total.toLocaleString('zh-CN')} 颗拼豆`; $('#stats-list').innerHTML = state.stats.map((item, index) => { const code = statCode(item, index); return `<div class="stat-row"><span class="stat-swatch" style="background:${item.hex || '#fff'}"></span><span><span class="stat-code">${code}</span><span class="stat-name">${humanName(item.paletteId || item.id || code)}</span></span><span class="stat-count">${item.count || 0} 颗</span></div>`; }).join(''); $('#inline-stats').hidden = false; $('#summary-size').textContent = `${state.patternWidth} × ${state.patternHeight}`; $('#summary-beads').textContent = total.toLocaleString('zh-CN'); $('#summary-colors').textContent = state.stats.length; $('#summary-brand').textContent = `${selectedBrand()} · ${$('#palette-source').selectedOptions[0].textContent}`; const board = Number($('#bead-size').value) === 2.6 ? 57 : 29; $('#summary-boards').textContent = `${Math.ceil(state.patternWidth / board)} × ${Math.ceil(state.patternHeight / board)}`; }
function renderCurrentPattern() { if (!state.grid) return; drawPattern(state.patternView); const ls = getLicenseState(); if (!ls.activated) { const ctx = patternCanvas.getContext('2d'); drawWatermark(ctx, patternCanvas.width, patternCanvas.height); } setCanvasDisplay(patternCanvas, state.patternZoom); $('#pattern-label').textContent = state.patternView === 'number' ? '拼豆图纸 · 打印图纸' : '拼豆图纸 · 彩色颗粒'; $('#pattern-note').textContent = state.patternView === 'number' ? '每格显示色卡原始色号' : '彩色方块，不显示色号'; $('#print-hint').hidden = true; $('#pattern-size').textContent = `${state.patternWidth} × ${state.patternHeight} 格`; }
function generate() { if (!state.image) return; $('#generate').disabled = true; $('#loading-line').hidden = false; $('#loading-line').textContent = '正在生成拼豆图纸，请稍候…'; status('正在匹配色板 · 大尺寸图片可能需要几秒'); requestAnimationFrame(() => { try { const gridWidth = Number($('#grid-width').value); const gridHeight = targetHeight(); const imageWidth = gridWidth * 5; const imageHeight = gridHeight * 5; if (gridWidth * gridHeight > 10000) $('#loading-line').textContent = '正在生成拼豆图纸，请稍候… · 正在处理大尺寸图纸'; const work = document.createElement('canvas'); work.width = imageWidth; work.height = imageHeight; const ctx = work.getContext('2d', { willReadFrequently: true }); const scale = Math.max(imageWidth / state.image.naturalWidth, imageHeight / state.image.naturalHeight); const drawWidth = state.image.naturalWidth * scale; const drawHeight = state.image.naturalHeight * scale; ctx.drawImage(state.image, (imageWidth - drawWidth) / 2, (imageHeight - drawHeight) / 2, drawWidth, drawHeight); const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight); // 【色差修复】不再额外增强对比度/饱和度，直接以原图颜色匹配实体色卡。
      const pixels = prepareSourcePixels(imageData.data, imageWidth, imageHeight, { brightness: 0, contrast: 0, saturation: 0 }, { denoise: false, sharpen: true });
      // 【此处接入bear-code项目转换接口函数】本次迭代只调整前端渲染，底层 bear-code 的 runPipeline 调用保持不变。
      const result = runPipeline(pixels, imageWidth, imageHeight, { gridWidth, mode: 'average', mergeThreshold: mergeThresholdValue(), maxColors: Number($('#max-colors').value), palette: activePalette(), backgroundPaletteIds: backgroundPaletteIds, excludedPaletteIds: [], flatTile: false });
      // 【Q版人物修复】填补空单元格：未匹配到色板的格子自动匹配最近色，避免白色/浅色区域缺色
      if (result?.pixelGrid || result?.grid) {
        const grid = result.pixelGrid || result.grid;
        const pal = activePalette();
        let fixedCount = 0;
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            const cell = grid[r][c];
            // 空单元格 / 没有匹配到色板的格子
            if (cell == null || cell === 0 || (typeof cell === 'object' && (cell.paletteId == null && cell.colorIndex == null && cell.index == null))) {
              // 取原始像素颜色，找最近的色板颜色
              const px = Math.floor(c * imageWidth / gridWidth);
              const py = Math.floor(r * imageHeight / grid.length);
              const idx = (py * imageWidth + px) * 4;
              const r1 = pixels[idx], g1 = pixels[idx + 1], b1 = pixels[idx + 2];
              let bestId = null, bestDist = Infinity;
              for (let p = 0; p < pal.length; p++) {
                const hex = pal[p].hex;
                const r2 = parseInt(hex.slice(1, 3), 16);
                const g2 = parseInt(hex.slice(3, 5), 16);
                const b2 = parseInt(hex.slice(5, 7), 16);
                const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
                const dist = dr * dr + dg * dg + db * db;
                if (dist < bestDist) { bestDist = dist; bestId = pal[p].id; }
              }
              if (bestId) {
                grid[r][c] = { paletteId: bestId };
                fixedCount++;
              }
            }
          }
        }
        if (fixedCount > 0) {
          console.log(`[Q版修复] 填补了 ${fixedCount} 个空单元格`);
        }
      }
      // 【此处接入bear-code项目转换接口函数】不修改 result；只在前端适配 pixelGrid/palette/colorStats 或当前 grid 返回结构。
      const normalized = normalizeConversionResult(result, activePalette()); state.patternView = 'number'; state.patternZoom = 1; document.querySelectorAll('.view-tab').forEach((item) => item.classList.toggle('active', item.dataset.view === 'number')); renderCurrentPattern(); renderStats(); updatePreview(); $('#results').hidden = false; $('#canvas-size').textContent = `${state.patternWidth} × ${state.patternHeight} 格`; status(`图纸已生成 · ${normalized.colorStats.reduce((sum, item) => sum + Number(item.count || 0), 0).toLocaleString('zh-CN')} 颗拼豆`);
    } catch (error) { console.error(error); status('生成失败，请更换图片或减少图纸尺寸'); } finally { $('#generate').disabled = false; $('#loading-line').hidden = true; } }); }
// 【本次迭代新增：独立缩放模块】原图和图纸分别维护缩放比例，并同步到各自滚动容器。
function adjustZoom(kind, delta) { if (!state.image) return; const key = kind === 'source' ? 'sourceZoom' : 'patternZoom'; state[key] = Math.min(4, Math.max(.35, Number((state[key] + delta).toFixed(2)))); $(`#${kind}-zoom-label`).textContent = `${Math.round(state[key] * 100)}%`; if (kind === 'source') setCanvasDisplay(sourceCanvas, state.sourceZoom); else setCanvasDisplay(patternCanvas, state.patternZoom); }
function resetZoom(kind) { state[kind === 'source' ? 'sourceZoom' : 'patternZoom'] = 1; $(`#${kind}-zoom-label`).textContent = '100%'; if (kind === 'source') setCanvasDisplay(sourceCanvas, 1); else setCanvasDisplay(patternCanvas, 1); }
function csvText() { const rows = [['色号', '颜色十六进制', '颗粒数量'], ...state.stats.map((item, index) => [statCode(item, index), item.hex || '', item.count || 0])]; return '\ufeff' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n'); }
function downloadBlob(blob, filename) { const link = document.createElement('a'); link.download = filename; link.href = URL.createObjectURL(blob); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 500); }
// 【本次迭代新增：导出模块】按当前前端视图导出，并可将色卡清单拼接到图片底部。
function exportCanvas(view) { const canvas = document.createElement('canvas'); drawPattern(view, canvas, { showGrid: true, showBlockGrid: true }); if (!$('#append-list').checked || !state.stats.length) return canvas; const rowHeight = 28; const padding = 14; const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height + padding * 2 + 25 + state.stats.length * rowHeight; const ctx = out.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(canvas, 0, 0); ctx.fillStyle = '#f8faf5'; ctx.fillRect(0, canvas.height, out.width, out.height - canvas.height); ctx.fillStyle = '#263029'; ctx.font = '700 13px system-ui'; ctx.fillText(`色卡清单 · ${selectedBrand()}`, padding, canvas.height + 22); state.stats.forEach((item, index) => { const x = padding + (index % 3) * Math.max(150, Math.floor(out.width / 3)); const y = canvas.height + 45 + Math.floor(index / 3) * rowHeight; ctx.fillStyle = item.hex || '#fff'; ctx.fillRect(x, y - 11, 17, 17); ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.strokeRect(x + .5, y - 10.5, 16, 16); ctx.fillStyle = '#263029'; ctx.font = '700 11px system-ui'; ctx.fillText(`${statCode(item, index)} · ${item.count || 0}颗`, x + 24, y + 2); }); return out; }
function downloadImage(view, filename) { if (!state.grid) return; const ls = getLicenseState(); if (!ls.canExport) { showPaywallModal('export'); return; } const result = consumeExport(); if (!result.success) { showPaywallModal('export'); return; } downloadBlob(dataUrlToBlob(exportCanvas(view).toDataURL('image/png')), filename); status(result.remaining === -1 ? '导出成功 · 永久会员' : `导出成功 · 剩余 ${result.remaining} 次`); updateLicenseUI(); }
// 复制色卡清单到剪贴板
function copyList() {
  if (!state.stats?.length) return;
  const text = state.stats.map((item, i) => `${statCode(item, i)}  ${item.count || 0}颗  ${humanName(item.paletteId || item.id || i)}`).join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => status('色卡清单已复制到剪贴板')).catch(() => status('复制失败，请手动复制'));
  } else {
    status('浏览器不支持自动复制');
  }
}
function dataUrlToBlob(dataUrl) { const [head, body] = dataUrl.split(','); const bytes = atob(body); const array = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i); return new Blob([array], { type: head.match(/data:(.*?);/)?.[1] || 'image/png' }); }
function reset() { state.image = null; state.originalImage = null; state.grid = null; state.resultPalette = []; state.rawResult = null; state.stats = []; state.sourceZoom = 1; state.patternZoom = 1; state.mirrorX = false; state.flipY = false; state.enabled = new Set(palette.map((item) => item.id)); input.value = ''; $('#grid-width').value = 48; $('#zoom-scale').value = 100; state.baseGridWidth = 48; $('#max-colors').value = 0; $('#tolerance').value = 12; $('#results').hidden = true; $('#inline-stats').hidden = true; $('#generate').disabled = true; $('#replace-image').hidden = true; $('#image-tools').hidden = true; $('#upload-success').hidden = true; $('#dual-preview').hidden = true; $('#empty-state').hidden = false; $('#pattern-canvas').hidden = true; $('#canvas-size').textContent = '等待图片'; status('还没有生成图纸'); renderPalettePicker(); updateOutputs(); }

input.addEventListener('change', () => loadImage(input.files[0])); $('#replace-image').addEventListener('click', () => input.click()); $('#rotate-left').addEventListener('click', () => rotateImage(-1)); $('#rotate-right').addEventListener('click', () => rotateImage(1)); $('#apply-crop').addEventListener('click', cropImage); $('#reset').addEventListener('click', reset); $('#generate').addEventListener('click', generate);
['dragenter', 'dragover'].forEach((event) => uploadBox.addEventListener(event, (e) => { e.preventDefault(); uploadBox.classList.add('dragging'); })); ['dragleave', 'drop'].forEach((event) => uploadBox.addEventListener(event, (e) => { e.preventDefault(); uploadBox.classList.remove('dragging'); })); uploadBox.addEventListener('drop', (e) => loadImage(e.dataTransfer.files[0]));
$('#zoom-scale').addEventListener('input', () => { const scale = Number($('#zoom-scale').value); const newWidth = Math.min(200, Math.max(16, Math.round(state.baseGridWidth * scale / 100))); $('#grid-width').value = newWidth; updateOutputs(); });
$('#grid-width').addEventListener('input', () => { const currentWidth = Number($('#grid-width').value); const scale = Math.round(currentWidth / state.baseGridWidth * 100); $('#zoom-scale').value = Math.min(400, Math.max(25, scale)); updateOutputs(); });
['max-colors', 'tolerance'].forEach((id) => $(`#${id}`).addEventListener('input', () => { updateOutputs(); }));
document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => { state.patternView = button.dataset.view; document.querySelectorAll('.view-tab').forEach((item) => item.classList.toggle('active', item === button)); renderCurrentPattern(); }));
['brand-system', 'palette-source', 'bead-size'].forEach((id) => $(`#${id}`).addEventListener('change', () => { if (id === 'brand-system') renderPalettePicker(); if (state.grid) { renderStats(); renderCurrentPattern(); } })); $('#palette-toggle').addEventListener('click', () => { state.enabled = state.enabled.size === palette.length ? new Set(['mard-h2']) : new Set(palette.map((item) => item.id)); renderPalettePicker(); });
$('#mirror-x').addEventListener('click', () => { state.mirrorX = !state.mirrorX; $('#mirror-x').classList.toggle('selected', state.mirrorX); renderCurrentPattern(); }); $('#flip-y').addEventListener('click', () => { state.flipY = !state.flipY; $('#flip-y').classList.toggle('selected', state.flipY); renderCurrentPattern(); });
[['source', 'in', .15], ['source', 'out', -.15], ['pattern', 'in', .15], ['pattern', 'out', -.15]].forEach(([kind, direction, amount]) => $(`#${kind}-zoom-${direction}`).addEventListener('click', () => adjustZoom(kind, amount))); $('#source-zoom-reset').addEventListener('click', () => resetZoom('source')); $('#pattern-zoom-reset').addEventListener('click', () => resetZoom('pattern'));
// 【本次查看体验修复】普通滚轮交给预览容器滚动；按住 Ctrl/Cmd 才缩放，避免大图无法上下浏览。
[['source-wrap', 'source'], ['pattern-wrap', 'pattern']].forEach(([id, kind]) => $(`#${id}`).addEventListener('wheel', (event) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); adjustZoom(kind, event.deltaY < 0 ? .12 : -.12); } }, { passive: false }));
// 【本次查看体验修复】支持拖动画布平移，解决大图滚动条细小或触屏难以拖动的问题。
[['source-wrap', 'source'], ['pattern-wrap', 'pattern']].forEach(([id]) => { const wrap = $(`#${id}`); let dragging = false; let startX = 0; let startY = 0; let scrollX = 0; let scrollY = 0; wrap.addEventListener('pointerdown', (event) => { if (event.button !== 0) return; dragging = true; startX = event.clientX; startY = event.clientY; scrollX = wrap.scrollLeft; scrollY = wrap.scrollTop; wrap.classList.add('is-panning'); wrap.setPointerCapture?.(event.pointerId); }); wrap.addEventListener('pointermove', (event) => { if (!dragging) return; wrap.scrollLeft = scrollX - (event.clientX - startX); wrap.scrollTop = scrollY - (event.clientY - startY); }); const stop = (event) => { if (!dragging) return; dragging = false; wrap.classList.remove('is-panning'); if (event.pointerId != null) wrap.releasePointerCapture?.(event.pointerId); }; wrap.addEventListener('pointerup', stop); wrap.addEventListener('pointercancel', stop); });
$('#copy-list').addEventListener('click', copyList); $('#download-beads').addEventListener('click', () => downloadImage('color', `拼豆彩色效果图-${state.patternWidth}x${state.patternHeight}.png`)); $('#download-pattern').addEventListener('click', () => downloadImage('number', `拼豆打印图纸-${state.patternWidth}x${state.patternHeight}.png`)); $('#download-csv').addEventListener('click', () => state.stats.length && downloadBlob(new Blob([csvText()], { type: 'text/csv;charset=utf-8' }), `拼豆色卡清单-${state.patternWidth}x${state.patternHeight}.csv`));
// 【本次查看体验新增】色卡统计面板可收起，也可拖动顶部把手调整高度，避免遮挡图纸预览。
$('#stats-collapse').addEventListener('click', () => { const panel = $('#inline-stats'); const collapsed = panel.classList.toggle('collapsed'); $('#stats-collapse').textContent = collapsed ? '展开' : '收起'; $('#stats-collapse').setAttribute('aria-expanded', String(!collapsed)); });
(() => { const panel = $('#inline-stats'); const handle = $('#stats-resize-handle'); let startY = 0; let startHeight = 0; let resizing = false; handle.addEventListener('pointerdown', (event) => { if (panel.classList.contains('collapsed')) return; resizing = true; startY = event.clientY; startHeight = panel.getBoundingClientRect().height; handle.setPointerCapture?.(event.pointerId); document.body.classList.add('resizing-stats'); }); handle.addEventListener('pointermove', (event) => { if (!resizing) return; const next = Math.max(82, Math.min(340, startHeight + startY - event.clientY)); panel.style.height = `${Math.round(next)}px`; }); const stop = (event) => { if (!resizing) return; resizing = false; handle.releasePointerCapture?.(event.pointerId); document.body.classList.remove('resizing-stats'); }; handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop); })();
renderPalettePicker(); updateOutputs();
window.addEventListener('resize', () => { if (state.image) { setCanvasDisplay(sourceCanvas, state.sourceZoom); if (state.grid) setCanvasDisplay(patternCanvas, state.patternZoom); } });

// ============================================================
// AI Q版人物生成
// ============================================================

let chibiCurrentStyle = 'pixel_cute';

// 风格卡片切换
document.querySelectorAll('#chibi-style-grid .chibi-preset-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#chibi-style-grid .chibi-preset-card').forEach((c) => c.classList.remove('active'));
    card.classList.add('active');
    chibiCurrentStyle = card.dataset.style;
  });
});

// 自定义描述字数统计
document.getElementById('chibi-prompt').addEventListener('input', (e) => {
  document.getElementById('chibi-prompt-count').textContent = `${e.target.value.length} 字`;
});

// 生成 Q 版人物
document.getElementById('chibi-generate').addEventListener('click', async () => {
  if (!state.image) return;
  const chibiInfo = canGenerateChibi();
  if (!chibiInfo.can) { showPaywallModal('chibi'); return; }

  const btn = document.getElementById('chibi-generate');
  const statusEl = document.getElementById('chibi-status');
  const hairStyle = document.getElementById('chibi-hair').value;
  const clothingType = document.getElementById('chibi-clothing').value;
  const customPrompt = document.getElementById('chibi-prompt').value;
  const useRef = document.getElementById('chibi-use-ref').checked;

  btn.disabled = true;
  statusEl.className = 'chibi-status';
  statusEl.innerHTML = '<span class="chibi-loading"></span>正在生成 Q 版像素人物，请稍候（约 5-10 秒）…';

  try {
    const result = await generateChibi(state.image, {
      style: chibiCurrentStyle,
      hairStyle: hairStyle === 'auto' ? undefined : hairStyle,
      clothingType: clothingType === 'auto' ? undefined : clothingType,
      customPrompt: customPrompt || undefined,
      useReference: useRef,
    });

    state.originalImage = state.image;
    setImage(result.image);

    const consumed = consumeChibi();
    statusEl.className = 'chibi-status success';
    const remainingText = consumed.remaining === -1 ? '无限' : `${consumed.remaining} 次`;
    statusEl.textContent = `✅ 生成成功！Q版剩余：${remainingText}`;
    updateLicenseUI();
  } catch (err) {
    statusEl.className = 'chibi-status error';
    statusEl.textContent = '❌ 生成失败：' + err.message;
    console.error('Q版生成失败:', err);
  } finally {
    btn.disabled = false;
  }
});

// 图片变化时同步 Q 版面板状态
const chibiOrigSetImage = setImage;
setImage = function(image) {
  chibiOrigSetImage(image);
  const hasImage = Boolean(state.image);
  const chibiSection = document.getElementById('chibi-section');
  if (chibiSection) {
    chibiSection.hidden = !hasImage;
    document.getElementById('chibi-generate').disabled = !hasImage;
  }
};

// ============================================================
// 初始化授权系统
// ============================================================
checkUrlCode();
updateLicenseUI();

$('#license-activate')?.addEventListener('click', activateFromInput);
$('#license-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') activateFromInput(); });
$('#chibi-activate')?.addEventListener('click', activateChibiFromInput);
$('#chibi-license-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') activateChibiFromInput(); });
$('#paywall-close')?.addEventListener('click', hidePaywallModal);
$('#paywall-activate')?.addEventListener('click', activateFromInput);
$('#paywall-license-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') activateFromInput(); });
