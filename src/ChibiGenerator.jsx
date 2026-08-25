import React, { useState, useRef } from 'react';
import {
  generateChibi,
  styleList,
  hairStyleList,
  clothingList,
  stylePresets,
} from './chibiGenerator.js';

export default function ChibiGenerator({ userProfile, session, onChibiUsed, onConvertToBeads }) {
  const [sourceImage, setSourceImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [style, setStyle] = useState('super_chibi');
  const [hairStyle, setHairStyle] = useState('auto');
  const [clothingType, setClothingType] = useState('auto');
  const [customPrompt, setCustomPrompt] = useState('');
  const [useReference, setUseReference] = useState(stylePresets.super_chibi.useRefDefault !== false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);
  const sourceCanvasRef = useRef(null);

  const remainingChibi = userProfile?.remaining_ai_count ?? 0;
  const canGenerate = session && userProfile && userProfile.remaining_ai_count > 0;

  // 切换风格时同步更新参考图默认值
  const handleStyleChange = (styleId) => {
    setStyle(styleId);
    const preset = stylePresets[styleId];
    if (preset) {
      setUseReference(preset.useRefDefault !== false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      setResultImage(null);
      setErrorMsg('');
    };
    img.src = URL.createObjectURL(file);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setErrorMsg('');

    try {
      // 先生成，成功后再扣次数（避免生成失败白白损失次数）
      const result = await generateChibi(sourceImage, {
        style,
        hairStyle,
        clothingType,
        customPrompt: customPrompt.trim() || undefined,
        useReference,
      });

      // 生成成功，扣减次数
      const success = await onChibiUsed?.();
      if (!success) {
        setErrorMsg('生成成功，但次数扣减失败，请联系管理员');
      }

      setResultImage(result.image);
    } catch (err) {
      setErrorMsg(err.message || '生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConvertToBeads = () => {
    if (resultImage && onConvertToBeads) {
      onConvertToBeads(resultImage);
    }
  };

  // 绘制原图预览
  React.useEffect(() => {
    if (!sourceImage || !sourceCanvasRef.current) return;
    const canvas = sourceCanvasRef.current;
    const maxW = 280;
    const scale = Math.min(1, maxW / sourceImage.naturalWidth);
    canvas.width = sourceImage.naturalWidth * scale;
    canvas.height = sourceImage.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  }, [sourceImage]);

  if (!sourceImage) {
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
          <div className="upload-icon">🎨</div>
          <div className="upload-title">上传照片生成 Q 版</div>
          <div className="upload-desc">上传真人照片，AI 自动生成超萌 Q 版形象</div>
          <button type="button" className="primary-button">
            选择照片
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
          <button
            type="button"
            className="text-button replace-btn"
            onClick={() => {
              setSourceImage(null);
              setResultImage(null);
              setErrorMsg('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            更换照片
          </button>
        </div>

        <div className="param-section">
          <div className="section-title">风格选择</div>
          <div className="style-grid">
            {styleList.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`style-card ${style === s.id ? 'active' : ''}`}
                onClick={() => handleStyleChange(s.id)}
              >
                <div className="style-name">{s.name}</div>
                <div className="style-desc">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="param-section">
          <div className="section-title">参数设置</div>

          <div className="param-row">
            <label>发型</label>
            <select
              value={hairStyle}
              onChange={(e) => setHairStyle(e.target.value)}
              className="select-input"
            >
              {hairStyleList.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div className="param-row">
            <label>服装</label>
            <select
              value={clothingType}
              onChange={(e) => setClothingType(e.target.value)}
              className="select-input"
            >
              {clothingList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="param-row">
            <label>参考原图</label>
            <label className="switch">
              <input
                type="checkbox"
                checked={useReference}
                onChange={(e) => setUseReference(e.target.checked)}
              />
              <span className="switch-slider" />
            </label>
          </div>

          <div className="param-row param-row-column">
            <label>自定义描述</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="可选：补充描述，比如'戴眼镜、背书包'等"
              className="text-input"
              rows={2}
              maxLength={100}
            />
            <div className="char-count">{customPrompt.length}/100</div>
          </div>
        </div>

        <div className="param-section">
          <div className="section-title">生成</div>
          <div className="export-info">
            <div>剩余 Q 版：<strong>{remainingChibi}</strong></div>
          </div>

          {errorMsg && (
            <div className="notice error" style={{ marginBottom: '12px' }}>
              <span>✕</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            className="primary-button export-btn"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spin">◌</span>
                <span>生成中…</span>
              </>
            ) : (
              <>
                ✨ 生成 Q 版形象
              </>
            )}
          </button>

          {!canGenerate && (
            <p className="export-hint">
              {session ? '次数不足，请先购买/充值 Q 版生成次数。' : '登录后即可使用 Q 版生成功能。'}
            </p>
          )}

          {resultImage && (
            <button
              type="button"
              className="secondary-button export-btn"
              onClick={handleConvertToBeads}
            >
              🧩 转拼豆图纸
            </button>
          )}
        </div>
      </div>

      {/* 右侧：结果预览 */}
      <div className="bead-preview">
        {isGenerating && (
          <div className="generating-hint">
            <div className="chibi-loading-spin">◌</div>
            <div>AI 正在绘制 Q 版形象，请稍候…</div>
            <div className="hint-sub">通常需要 5-10 秒</div>
          </div>
        )}
        {resultImage && !isGenerating && (
          <div className="pattern-scroll">
            <img
              src={resultImage.src}
              alt="Q版生成结果"
              className="result-image"
            />
          </div>
        )}
        {!resultImage && !isGenerating && (
          <div className="empty-preview">
            <div className="empty-icon">🎨</div>
            <div>设置好参数后点击生成</div>
          </div>
        )}
      </div>
    </div>
  );
}
