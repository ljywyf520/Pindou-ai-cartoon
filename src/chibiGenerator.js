/**
 * AI Q版像素人物生成器
 * 通过豆包 Seedream API 从真人照片生成 Q 版像素风人物
 */

// ============================================================
// 风格预设 —— 每套有独立的 prompt 模板
// ============================================================
export const stylePresets = {
  super_chibi: {
    name: '超萌大头Q版',
    desc: '首推！2头身超萌，效果最稳定',
    useRefDefault: false,
    buildPrompt: (options) => {
      const parts = [];
      parts.push('Q版卡通人物插画');
      parts.push('超级可爱');
      parts.push('软萌治愈系');
      parts.push('chibi风格');
      parts.push('2头身比例');
      parts.push('头超级大');
      parts.push('身体很小');
      parts.push('大头小身');
      parts.push('SD比例');
      parts.push('超大圆眼睛');
      parts.push('眼睛闪闪发光');
      parts.push('小嘴巴');
      parts.push('几乎没有鼻子');
      parts.push('圆圆的脸蛋');
      parts.push('粉嫩腮红');
      parts.push('微笑表情');
      if (options.hairStyle && hairStyles[options.hairStyle]) {
        parts.push(hairStyles[options.hairStyle].keyword);
      }
      if (options.hairColor) {
        parts.push(options.hairColor + '头发');
      }
      if (options.clothingType && clothingTypes[options.clothingType]) {
        parts.push(clothingTypes[options.clothingType].keyword);
      }
      if (options.customPrompt) {
        parts.push(options.customPrompt);
      }
      parts.push('全身立绘');
      parts.push('正面站姿');
      parts.push('纯白色背景');
      parts.push('孤立的人物');
      parts.push('精致可爱');
      parts.push('高完成度');
      parts.push('干净的线稿');
      parts.push('平涂上色');
      return parts.join('，');
    },
  },

  pixel_art: {
    name: '像素画Q版',
    desc: '马赛克格子，适合直接拼豆',
    useRefDefault: false,
    buildPrompt: (options) => {
      const parts = [];
      parts.push('像素艺术');
      parts.push('pixel art');
      parts.push('16位像素画');
      parts.push('马赛克格子');
      parts.push('像素化');
      parts.push('每一个像素清晰可见');
      parts.push('有限的颜色数量');
      parts.push('硬边缘');
      parts.push('无渐变');
      parts.push('纯色填充');
      parts.push('Q版可爱角色');
      parts.push('大头娃娃');
      parts.push('头很大');
      parts.push('身体很小');
      parts.push('2头身');
      parts.push('大眼睛');
      parts.push('小嘴巴');
      if (options.hairStyle && hairStyles[options.hairStyle]) {
        parts.push(hairStyles[options.hairStyle].keyword);
      }
      if (options.clothingType && clothingTypes[options.clothingType]) {
        parts.push(clothingTypes[options.clothingType].keyword);
      }
      if (options.customPrompt) {
        parts.push(options.customPrompt);
      }
      parts.push('全身像');
      parts.push('正面站立');
      parts.push('纯白色背景');
      parts.push('星露谷物语风格');
      parts.push('复古RPG游戏角色');
      return parts.join('，');
    },
  },

  photo_chibi: {
    name: '照片转Q版',
    desc: '参考照片特征，更像本人',
    useRefDefault: true,
    buildPrompt: (options) => {
      const parts = [];
      parts.push('把参考图中的人物变成Q版卡通形象');
      parts.push('chibi风格');
      parts.push('超级可爱');
      parts.push('软萌');
      parts.push('2头身比例');
      parts.push('头很大');
      parts.push('身体很小');
      parts.push('大头小身');
      parts.push('大大的圆眼睛');
      parts.push('小鼻子');
      parts.push('小嘴巴');
      parts.push('粉嫩腮红');
      parts.push('微笑');
      parts.push('保留参考图中人物的发型和发色');
      parts.push('保留参考图中人物的服装样式和颜色');
      if (options.customPrompt) {
        parts.push(options.customPrompt);
      }
      parts.push('全身立绘');
      parts.push('正面站姿');
      parts.push('纯白色背景');
      parts.push('精致插画');
      parts.push('干净简洁');
      parts.push('平涂上色');
      return parts.join('，');
    },
  },

  sticker: {
    name: '可爱贴纸风',
    desc: '简约平涂，像贴纸一样',
    useRefDefault: false,
    buildPrompt: (options) => {
      const parts = [];
      parts.push('可爱Q版贴纸');
      parts.push('简约插画风格');
      parts.push('扁平化设计');
      parts.push('干净简洁');
      parts.push('圆润造型');
      parts.push('大头小身');
      parts.push('2头身');
      parts.push('超大眼睛');
      parts.push('小嘴巴');
      parts.push('粉嫩腮红');
      parts.push('可爱表情');
      if (options.hairStyle && hairStyles[options.hairStyle]) {
        parts.push(hairStyles[options.hairStyle].keyword);
      }
      if (options.clothingType && clothingTypes[options.clothingType]) {
        parts.push(clothingTypes[options.clothingType].keyword);
      }
      if (options.customPrompt) {
        parts.push(options.customPrompt);
      }
      parts.push('全身像');
      parts.push('纯白色背景');
      parts.push('粗线条轮廓');
      parts.push('平涂颜色');
      parts.push('无渐变');
      parts.push('精致可爱');
      return parts.join('，');
    },
  },

  ac_style: {
    name: '动森风Q版',
    desc: '动物森友会风格，圆滚滚',
    useRefDefault: false,
    buildPrompt: (options) => {
      const parts = [];
      parts.push('动物森友会风格角色设计');
      parts.push('Animal Crossing style');
      parts.push('Q版可爱人物');
      parts.push('圆滚滚的造型');
      parts.push('大头');
      parts.push('身体小');
      parts.push('圆圆的脑袋');
      parts.push('大大的圆眼睛');
      parts.push('小鼻子');
      parts.push('微笑的嘴巴');
      parts.push('粉嫩腮红');
      if (options.hairStyle && hairStyles[options.hairStyle]) {
        parts.push(hairStyles[options.hairStyle].keyword);
      }
      if (options.clothingType && clothingTypes[options.clothingType]) {
        parts.push(clothingTypes[options.clothingType].keyword);
      }
      if (options.customPrompt) {
        parts.push(options.customPrompt);
      }
      parts.push('全身立绘');
      parts.push('正面站姿');
      parts.push('纯白色背景');
      parts.push('简洁干净');
      parts.push('卡通渲染');
      parts.push('可爱治愈');
      return parts.join('，');
    },
  },
};

// ============================================================
// 发型选项
// ============================================================
export const hairStyles = {
  auto: { name: '自动', keyword: '' },
  long_wavy: { name: '长卷发', keyword: '长卷发' },
  long_straight: { name: '长直发', keyword: '长直发' },
  short_bob: { name: '波波头', keyword: '短发波波头' },
  short: { name: '短发', keyword: '短发' },
  twin_tails: { name: '双马尾', keyword: '双马尾' },
  ponytail: { name: '马尾辫', keyword: '马尾辫' },
  bangs: { name: '齐刘海', keyword: '齐刘海' },
};

// ============================================================
// 服装类型选项
// ============================================================
export const clothingTypes = {
  auto: { name: '自动', keyword: '' },
  dress: { name: '连衣裙', keyword: '连衣裙' },
  skirt_jacket: { name: '外套+裙子', keyword: '外套配裙子' },
  hoodie: { name: '卫衣', keyword: '连帽卫衣' },
  skirt_top: { name: '上衣+裙子', keyword: '上衣配裙子' },
  pants: { name: '上衣+裤子', keyword: '上衣配裤子' },
  school: { name: '校服', keyword: '校园制服' },
  casual: { name: '休闲装', keyword: '休闲服装' },
};

// ============================================================
// 模型选项
// ============================================================
export const models = {
  'doubao-seedream-4-0-250828': { name: 'Seedream 4.0（性价比）', price: '0.20元/张' },
  'doubao-seedream-5-0-lite-260128': { name: 'Seedream 5.0 Lite（最新）', price: '0.22元/张' },
};

// ============================================================
// 辅助函数
// ============================================================

function imageToBase64(image, maxSize = 1024) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function base64ToImage(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  });
}

// ============================================================
// 主函数
// ============================================================

export async function generateChibi(image, options = {}) {
  const style = stylePresets[options.style || 'super_chibi'];
  if (!style) throw new Error('未知风格：' + options.style);

  const prompt = style.buildPrompt(options);

  const requestBody = {
    prompt,
    model: options.model || 'doubao-seedream-4-0-250828',
    size: options.size || '1024x1024',
  };

  // 根据风格默认值 + 用户设置决定是否用参考图
  const useRef = options.useReference !== undefined
    ? options.useReference
    : (style.useRefDefault !== false);

  if (image && useRef) {
    requestBody.image = imageToBase64(image, 1024);
  }

  try {
    const endpoint = import.meta.env.VITE_SEEDREAM_ENDPOINT || '/api/seedream';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '生成失败');
    }

    const qImage = await base64ToImage(result.image);

    return {
      image: qImage,
      usage: result.usage,
      prompt: prompt,
      revised_prompt: result.revised_prompt,
    };
  } catch (err) {
    console.error('[chibiGenerator] 生成失败:', err);
    throw err;
  }
}

// ============================================================
// 导出列表
// ============================================================

export const styleList = Object.entries(stylePresets).map(([id, preset]) => ({
  id,
  name: preset.name,
  desc: preset.desc,
  useRefDefault: preset.useRefDefault !== false,
}));

export const hairStyleList = Object.entries(hairStyles).map(([id, data]) => ({
  id,
  name: data.name,
}));

export const clothingList = Object.entries(clothingTypes).map(([id, data]) => ({
  id,
  name: data.name,
}));

export const modelList = Object.entries(models).map(([id, data]) => ({
  id,
  name: data.name,
  price: data.price,
}));
