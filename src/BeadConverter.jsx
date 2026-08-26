import React, { useEffect, useRef, useState, useCallback } from 'react';
import { convertImageToBeads, drawPatternCanvas, drawWatermark, exportCSV } from './beadUtils.js';

const DEFAULT_GRID_WIDTH = 48;
const WATERMARK_TEXT = '十三工坊 仅供预览';

export default function BeadConverter({ userProfile, onExportUsed, session, presetImage }) {
  const [image, setImage] = useState(null);
  const [gridWidth, setGridWidth] = useState(DEFAULT_GRID_WIDTH);
  const [baseGridWidth, setBaseGridWidth] = useState(DEFAULT_GRID_WIDTH);
  const [result, setResult] = useState(null);
  const [cellSize, setCellSize] = useState(20);
  const [showCodes, setShowCodes] = useState(true);
  const [ignoreWhiteBg, setIgnoreWhiteBg] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // 当从 Q 版页面传图过来时，自动加载
  useEffect(() => {
    if (presetImage && presetImage !== image) {
      setImage(presetImage);
      setBaseGridWidth(DEFAULT_GRID_WIDTH);
      setGridWidth(DEFAULT_GRID_WIDTH);
      setResult(null);
      setUploadSuccess(true);
    }
  }, [presetImage]);

  const fileInputRef = useRef(null);
  const patternCanvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);

  const isPermanent = userProfile?.membership_status === 'permanent';
  const canExport = session && userProfile && (isPermanent || userProfile.remaining_export_count > 0);
  const remainingExports = isPermanent ? '无限' : userProfile?.remaining_export_count ?? 0;

  // 缩放比例
  const zoomPercent = Math.round((gridWidth / baseGridWidth) * 100);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setImage(img);
      setBaseGridWidth(DEFAULT_GRID_WIDTH);
      setGridWidth(DEFAULT_GRID_WIDTH);
      setResult(null);
      setUploadSuccess(true);
    };
    img.src = URL.createObjectURL(file);
  }, []);

  const generatePattern = useCallback(async () => {
    if (!image) return;
    setIsGenerating(true);

    // 模拟一点延迟，让用户知道在处理
    await new Promise((r) => setTimeout(r, 100));

    try {
      const res = convertImageToBeads(image, gridWidth, { ignoreEdgeWhite: ignoreWhiteBg });
      setResult(res);

      // 自动调整格子大小，让图纸适配预览区
      const maxPreviewW = 600;
      const maxPreviewH = 700;
      const cellW = Math.floor(maxPreviewW / res.gridWidth);
      const cellH = Math.floor(maxPreviewH / res.gridHeight);
      const autoCellSize = Math.max(6, Math.min(30, Math.min(cellW, cellH)));
      setCellSize(autoCellSize);
    } finally {
      setIsGenerating(false);
    }
  }, [image, gridWidth]);

  // 图片加载后自动生成
  useEffect(() => {
    if (image && !result) {
      generatePattern();
    }
  }, [image, result, generatePattern]);

  // 格数变化时重新生成
  useEffect(() => {
    if (image && result) {
      const timer = setTimeout(() => {
        generatePattern();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [gridWidth, ignoreWhiteBg, image, result, generatePattern]);

  // 绘制图纸
  useEffect(() => {
    if (!result || !patternCanvasRef.current) return;
    drawPatternCanvas(patternCanvasRef.current, result.grid, {
      cellSize,
      showGrid: true,
      showChunkLines: true,
      showCodes,
      chunkSize: 5,
    });

    // 未登录或无次数时加水印
    if (!canExport) {
      const ctx = patternCanvasRef.current.getContext('2d');
      drawWatermark(ctx, result.gridWidth * cellSize, result.gridHeight * cellSize, WATERMARK_TEXT);
    }
  }, [result, cellSize, showCodes, canExport]);

  // 绘制原图
  useEffect(() => {
    if (!image || !sourceCanvasRef.current) return;
    const canvas = sourceCanvasRef.current;
    const maxW = 280;
    const scale = Math.min(1, maxW / image.naturalWidth);
    canvas.width = image.naturalWidth * scale;
    canvas.height = image.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }, [image]);

  const handleZoomChange = (e) => {
    const percent = Number(e.target.value);
    const newWidth = Math.max(10, Math.min(300, Math.round(baseGridWidth * percent / 100)));
    setGridWidth(newWidth);
  };

  const handleGridWidthChange = (e) => {
    const val = Number(e.target.value);
    if (val >= 10 && val <= 300) {
      setGridWidth(val);
    }
  };

  const handleExportPNG = async () => {
    if (!result || !canExport) return;

    // 如果不是永久会员，扣减次数
    if (!isPermanent) {
      const success = await onExportUsed?.();
      if (!success) return;
    }

    // 高清导出：cellSize 加大
    const exportCanvas = document.createElement('canvas');
    drawPatternCanvas(exportCanvas, result.grid, {
      cellSize: Math.max(20, cellSize),
      showGrid: true,
      showChunkLines: true,
      showCodes: true,
      chunkSize: 5,
    });

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `拼豆图纸_${result.gridWidth}x${result.gridHeight}.png`;
    link.href = dataUrl;
    link.click();
    setShowExportModal(false);
  };

  const handleExportCSV = () => {
    if (!result) return;
    const csv = exportCSV(result.stats, result.gridWidth, result.gridHeight, result.totalBeads);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `色卡清单_${result.gridWidth}x${result.gridHeight}.csv`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!image) {
    return (
      <div className="upload-section">
        <div
          className="upload-box"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith('image/')) {
              const dt = new DataTransfer();
              dt.items.add(file);
              fileInputRef.current.files = dt.files;
              handleFileChange({ target: { files: dt.files } });
            }
          }}
        >
          <div className="upload-icon">🧩</div>
          <div className="upload-title">上传图片开始转换</div>
          <div className="upload-desc">支持 JPG / PNG，拖到这里或点击选择</div>
          <button type="button" className="primary-button">
            选择图片
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <div className="bead-workspace">
      {/* 左侧：原图 + 参数 */}
      <div className="bead-sidebar">
        <div className="source-preview">
          <div className="section-title">原图</div>
          <canvas ref={sourceCanvasRef} className="source-canvas" />
          {uploadSuccess && (
            <div className="upload-success-msg">已上传 ✓ 下滑查看</div>
          )}
          <button
            type="button"
            className="text-button replace-btn"
            onClick={() => {
              setImage(null);
              setResult(null);
              setUploadSuccess(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            更换图片
          </button>
        </div>

        {result && (
          <>
            <div className="param-section">
              <div className="section-title">图纸设置</div>

              <div className="param-row">
                <label>缩放比例</label>
                <div className="slider-wrap">
                  <input
                    type="range"
                    min="25"
                    max="400"
                    value={zoomPercent}
                    onChange={handleZoomChange}
                  />
                  <span className="slider-value">{zoomPercent}%</span>
                </div>
              </div>

              <div className="param-row">
                <label>横向格数</label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={gridWidth}
                  onChange={handleGridWidthChange}
                  className="num-input"
                />
              </div>

              <div className="param-row">
                <label>纵向格数</label>
                <span className="grid-info">
                  {result.gridHeight} 格（自动计算）
                </span>
              </div>

              <div className="param-row">
                <label>显示色号</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showCodes}
                    onChange={(e) => setShowCodes(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </div>

              <div className="param-row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label>忽略白色背景</label>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'normal' }}>
                    图案内部有白色时建议关闭，避免误删
                  </span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={ignoreWhiteBg}
                    onChange={(e) => setIgnoreWhiteBg(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </div>
            </div>

            <div className="param-section">
              <div className="section-title">导出</div>
              <div className="export-info">
                <div>剩余导出：<strong>{remainingExports}</strong></div>
                <div>图纸尺寸：{result.gridWidth} × {result.gridHeight}</div>
                <div>拼豆总数：{result.totalBeads}</div>
              </div>

              <button
                type="button"
                className="primary-button export-btn"
                onClick={() => setShowExportModal(true)}
                disabled={!canExport}
              >
                {canExport ? '📥 导出无水印图纸' : '🔒 导出无水印图纸'}
              </button>

              {!canExport && (
                <p className="export-hint">
                  {session ? '次数不足，请先购买/充值导出次数。' : '登录后购买导出次数即可下载无水印图纸。'}
                </p>
              )}

              <button
                type="button"
                className="secondary-button export-btn"
                onClick={handleExportCSV}
              >
                📋 导出色卡清单 (CSV)
              </button>
            </div>

            <div className="param-section">
              <div className="section-title">色卡统计</div>
              <div className="stats-list">
                {result.stats.slice(0, 15).map((item) => (
                  <div key={item.paletteId} className="stat-item">
                    <span
                      className="stat-color"
                      style={{ backgroundColor: item.hex }}
                    />
                    <span className="stat-code">{item.code}</span>
                    <span className="stat-name">{item.name}</span>
                    <span className="stat-count">{item.count}</span>
                  </div>
                ))}
                {result.stats.length > 15 && (
                  <div className="stat-more">+ {result.stats.length - 15} 种颜色</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 右侧：图纸预览 */}
      <div className="bead-preview">
        {isGenerating && (
          <div className="generating-hint">生成中…</div>
        )}
        {result && (
          <div className="pattern-scroll">
            <canvas ref={patternCanvasRef} className="pattern-canvas" />
          </div>
        )}
      </div>

      {/* 导出确认弹窗 */}
      {showExportModal && result && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>确认导出</h3>
            <p>将消耗 <strong>1 次</strong>导出次数，导出后不支持退款。</p>
            <p>当前剩余：<strong>{remainingExports}</strong> 次</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowExportModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleExportPNG}
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
