# 豆包 Seedream API 接入指南（Q版像素人物生成）

## 一、为什么选豆包 Seedream

- **效果好**：字节跳动自家的生图模型，对中文 prompt 理解好
- **支持图生图**：可以上传真人照片当参考，直接生成 Q 版
- **价格便宜**：Seedream 4.0 只要 0.2 元/张，还有免费额度（200 张）
- **接入简单**：标准 OpenAI 格式的 API，一个 HTTP 请求搞定

---

## 二、准备工作（5 分钟）

### Step 1: 注册火山引擎账号

去 https://www.volcengine.com/ 注册一个账号（用手机号就行）

### Step 2: 开通火山方舟（Ark）

进入火山方舟控制台：
https://console.volcengine.com/ark/region:ark+cn-beijing/overview

### Step 3: 开通模型服务

进入「模型广场」→ 搜索 "seedream" → 选择以下模型点击「开通」：

| 模型 | 推荐度 | 价格 | 免费额度 |
|------|--------|------|----------|
| `doubao-seedream-4-0-250828` | ⭐⭐⭐⭐ 性价比最高 | 0.20 元/张 | 200 张 |
| `doubao-seedream-5-0-lite-260128` | ⭐⭐⭐⭐⭐ 最新最好 | 0.22 元/张 | 50 张 |

建议先开通 `doubao-seedream-4-0-250828`，免费额度多，先试试效果。

### Step 4: 创建 API Key

进入「API Key 管理」：
https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey

点击「创建 API Key」，复制保存好（只显示一次！）

```
格式类似：812345678-1234-5678-abcd-abcdef123456
```

---

## 三、接入架构

```
用户上传照片
    ↓
前端 JS（浏览器）
    ↓ 图片 + 选项
本地 Node 代理（server.cjs 新增接口）
    ↓ 转发请求（带 API Key）
火山方舟 Seedream API
    ↓ 返回 Q 版像素图
本地代理 → 前端
    ↓
接现有 bead-core 转拼豆图纸
```

**为什么需要代理？**
1. API Key 不能暴露在前端（会被人盗用刷钱）
2. 浏览器直接调用有跨域（CORS）问题
3. 你的项目已经有 `server.cjs` 了，加一个接口就行

---

## 四、代码实现

### 4.1 后端：在 server.cjs 中加一个代理接口

在 `server.cjs` 中，`http.createServer` 回调里，在文件读取逻辑之前加：

```javascript
// ===== 豆包 Seedream API 代理 =====
// 在文件读取逻辑之前加入这段

if (cleanPath === 'api/seedream' && request.method === 'POST') {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', async () => {
    try {
      const { prompt, image, size = '1024x1024', model = 'doubao-seedream-4-0-250828' } = JSON.parse(body);
      
      // 从环境变量读取 API Key（不要硬编码！）
      const apiKey = process.env.ARK_API_KEY;
      if (!apiKey) {
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: '未配置 ARK_API_KEY 环境变量' }));
        return;
      }

      // 调用火山方舟 API
      const arkResponse = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          response_format: 'b64_json', // 直接返回 base64，省一次下载
          watermark: false,
          image: image ? [image] : undefined, // 图生图参考图（base64 或 url）
        }),
      });

      const result = await arkResponse.json();
      
      if (!arkResponse.ok) {
        response.writeHead(arkResponse.status, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: result.error?.message || '生图失败' }));
        return;
      }

      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        image: result.data?.[0]?.b64_json,
        usage: result.usage,
      }));
    } catch (err) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: err.message }));
    }
  });
  return;
}
```

### 4.2 设置 API Key

不要把 API Key 写在代码里！用环境变量。

#### 方式 A：改启动脚本（推荐）

修改 `启动豆格工坊.bat`，加一行环境变量：

```batch
@echo off
chcp 65001 >nul
set ARK_API_KEY=你的API_KEY写在这里
cd /d "%~dp0"
node studio/server.cjs
pause
```

#### 方式 B：新建 .env 文件

在项目根目录新建 `.env` 文件（记得加进 .gitignore）：

```
ARK_API_KEY=你的API_KEY写在这里
```

然后在 server.cjs 开头加：
```javascript
require('dotenv').config(); // 需要先 npm install dotenv
```

### 4.3 前端：新建 chibiGenerator.js

在 `studio/` 目录下新建 `chibiGenerator.js`：

```javascript
/**
 * Q版像素人物生成器
 * 通过豆包 Seedream API 从真人照片生成 Q 版像素风人物
 */

// ===== 风格预设 =====
const STYLE_PRESETS = {
  pixel_q: {
    name: 'Q版像素风',
    basePrompt: '像素风格Q版卡通人物，16-bit复古游戏画风，马赛克格子质感，低分辨率像素艺术，可爱萌系，大头娃娃，2头身比例，圆润造型，全身像，纯白色背景',
    negativePrompt: '写实，真人，照片，3D渲染，复杂背景，多人，文字，水印，模糊，变形，恐怖，丑陋，低质量',
  },
  chibi_simple: {
    name: '简约Q版',
    basePrompt: 'Q版卡通人物，简约可爱风格，圆润造型，大头小身，2头身，全身立绘，纯白色背景，平面插画风格，简洁干净',
    negativePrompt: '写实，复杂细节，复杂背景，多人，文字，水印',
  },
  pixel_16bit: {
    name: '16位像素风',
    basePrompt: '16-bit像素艺术风格人物，复古游戏角色设计，像素化，马赛克效果，有限色板，全身立绘，纯白色背景',
    negativePrompt: '写实，高清，照片，3D，复杂细节，渐变，模糊',
  },
};

// ===== 发型关键词映射 =====
const HAIR_STYLE_KEYWORDS = {
  long_wavy: '长卷发',
  long_straight: '长直发',
  short: '短发',
  twin_tails: '双马尾',
  ponytail: '马尾辫',
};

// ===== 服装关键词映射 =====
const CLOTHING_KEYWORDS = {
  dress: '连衣裙',
  jacket_skirt: '外套配裙子，校园风',
  hoodie: '连帽卫衣，休闲风',
  top_skirt: '上衣配裙子',
  top_pants: '上衣配裤子',
};

// ===== 组装 Prompt =====
function buildPrompt(options = {}) {
  const style = STYLE_PRESETS[options.style || 'pixel_q'];
  const parts = [style.basePrompt];

  // 发型
  if (options.hairStyle && HAIR_STYLE_KEYWORDS[options.hairStyle]) {
    parts.push(HAIR_STYLE_KEYWORDS[options.hairStyle]);
  }

  // 服装
  if (options.clothingType && CLOTHING_KEYWORDS[options.clothingType]) {
    parts.push(CLOTHING_KEYWORDS[options.clothingType]);
  }

  // 自定义描述
  if (options.customPrompt) {
    parts.push(options.customPrompt);
  }

  // 姿态
  parts.push('自然站立姿势，正面全身像');

  // 质量增强词
  parts.push('精致，高完成度，可爱，治愈');

  return {
    prompt: parts.join('，'),
    negativePrompt: style.negativePrompt,
  };
}

// ===== 图片转 Base64 =====
function imageToBase64(image, maxSize = 1024) {
  const canvas = document.createElement('canvas');
  
  // 缩放图片到合适大小
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  
  // 返回 data URL（含前缀的 base64）
  return canvas.toDataURL('image/jpeg', 0.85);
}

// ===== Base64 转 Image =====
function base64ToImage(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  });
}

// ===== 调用 Seedream API =====
export async function generateQVersion(image, options = {}) {
  const { prompt, negativePrompt } = buildPrompt(options);
  
  const requestBody = {
    prompt,
    model: options.model || 'doubao-seedream-4-0-250828',
    size: options.size || '1024x1024',
  };

  // 如果有参考图，加图生图参数
  if (image && options.useReference !== false) {
    requestBody.image = imageToBase64(image, 1024);
  }

  // 如果模型支持 negative_prompt 就加（Seedream 可能不直接支持，放 prompt 里用"不要"代替）
  // 这里先不用 negative_prompt 参数，改在 prompt 里描述

  try {
    const response = await fetch('/api/seedream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '生成失败');
    }

    // 返回图片对象
    const qImage = await base64ToImage(result.image);
    return {
      image: qImage,
      usage: result.usage,
    };
  } catch (err) {
    console.error('Q版生成失败:', err);
    throw err;
  }
}

// ===== 导出风格列表（给 UI 用） =====
export const styleList = Object.entries(STYLE_PRESETS).map(([id, preset]) => ({
  id,
  name: preset.name,
}));

// ===== 导出发型列表 =====
export const hairStyleList = Object.entries(HAIR_STYLE_KEYWORDS).map(([id, name]) => ({
  id,
  name,
}));

// ===== 导出服装列表 =====
export const clothingList = Object.entries(CLOTHING_KEYWORDS).map(([id, name]) => ({
  id,
  name,
}));
```

### 4.4 在 app.js 中接入

在 `app.js` 顶部加 import：

```javascript
import { generateQVersion, styleList, hairStyleList, clothingList } from './chibiGenerator.js';
```

然后添加"生成Q版"按钮的点击事件处理：

```javascript
// ===== Q版人物生成 =====
async function generateQVersionImage() {
  if (!state.image) return;
  
  const style = $('#chibi-style').value;
  const hairStyle = $('#chibi-hair').value;
  const clothingType = $('#chibi-clothing').value;
  const customPrompt = $('#chibi-prompt').value;
  const useRef = $('#chibi-use-ref').checked;
  
  $('#chibi-generate').disabled = true;
  $('#chibi-status').textContent = '正在生成 Q 版像素人物，请稍候（约 5-10 秒）…';
  
  try {
    const result = await generateQVersion(state.image, {
      style,
      hairStyle: hairStyle || undefined,
      clothingType: clothingType || undefined,
      customPrompt,
      useReference: useRef,
    });
    
    // 把生成的 Q 版图设为当前图片
    state.originalImage = result.image;
    setImage(result.image);
    
    $('#chibi-status').textContent = 'Q 版人物生成成功！可以继续调整参数后生成拼豆图纸';
  } catch (err) {
    $('#chibi-status').textContent = '生成失败：' + err.message;
  } finally {
    $('#chibi-generate').disabled = false;
  }
}
```

### 4.5 在 index.html 中加 UI

在合适的位置（比如图片预处理区域旁边）加 Q 版生成面板：

```html
<div class="preprocess-section" id="chibi-section">
  <div class="section-title">✨ AI Q版人物生成</div>
  
  <div class="control-row">
    <label class="control-label">风格</label>
    <select id="chibi-style">
      <option value="pixel_q">Q版像素风（推荐）</option>
      <option value="chibi_simple">简约Q版</option>
      <option value="pixel_16bit">16位像素风</option>
    </select>
  </div>
  
  <div class="control-row">
    <label class="control-label">发型</label>
    <select id="chibi-hair">
      <option value="">自动识别</option>
      <option value="long_wavy">长卷发</option>
      <option value="long_straight">长直发</option>
      <option value="short">短发</option>
      <option value="twin_tails">双马尾</option>
      <option value="ponytail">马尾辫</option>
    </select>
  </div>
  
  <div class="control-row">
    <label class="control-label">服装</label>
    <select id="chibi-clothing">
      <option value="">自动识别</option>
      <option value="dress">连衣裙</option>
      <option value="jacket_skirt">外套+裙子</option>
      <option value="hoodie">卫衣</option>
      <option value="top_skirt">上衣+裙子</option>
      <option value="top_pants">上衣+裤子</option>
    </select>
  </div>
  
  <div class="control-row">
    <label class="control-label">自定义描述</label>
    <input type="text" id="chibi-prompt" placeholder="例如：粉色连衣裙，可爱，戴眼镜" class="control-input">
  </div>
  
  <div class="control-row">
    <label class="control-label">
      <input type="checkbox" id="chibi-use-ref" checked>
      使用照片参考（更像本人）
    </label>
  </div>
  
  <button type="button" id="chibi-generate" class="primary-btn">🎨 生成 Q 版像素人物</button>
  
  <div id="chibi-status" class="status-line"></div>
</div>
```

---

## 五、Prompt 优化技巧

### 5.1 核心 Prompt 模板

```
像素风格Q版卡通人物，16-bit复古游戏画风，马赛克格子质感，
低分辨率像素艺术，可爱萌系，大头娃娃，2头身比例，圆润造型，
全身像，纯白色背景，{发型描述}，{服装描述}，
自然站立姿势，正面全身像，精致，高完成度，可爱，治愈
```

### 5.2 增强效果的关键词

根据需要加这些词：

| 效果 | 关键词 |
|------|--------|
| 更可爱更萌 | 超可爱，萌系，治愈系，软萌 |
| 更像素 | 8-bit像素，16-bit像素，像素艺术，马赛克格子 |
| 更精致 | 精致细节，高完成度，精细像素画 |
| 特定风格 | 宝可梦风格，星露谷物语风格，RPG角色 |
| 姿势 | 双手比耶，叉腰，挥手，跳跃 |
| 表情 | 微笑，开心，眨眼，害羞 |

### 5.3 负面 Prompt（避免的东西）

```
写实，真人，照片，3D渲染，复杂背景，多人，文字，水印，
模糊，变形，恐怖，丑陋，低质量，不完整，断肢，比例失调
```

### 5.4 不同风格的 Prompt 示例

#### 风格 1：像素 Q 版（默认，最适合拼豆）

```
像素风格Q版卡通女孩，16-bit复古游戏画风，马赛克格子质感，
低分辨率像素艺术，可爱萌系，大头娃娃，2头身比例，圆润造型，
长卷发，粉色连衣裙，
自然站立姿势，正面全身像，纯白色背景，
精致，高完成度，可爱，治愈
```

#### 风格 2：简约 Q 版（更像贴纸）

```
Q版卡通人物，简约可爱风格，圆润造型，大头小身，2头身，
全身立绘，纯白色背景，平面插画风格，简洁干净，
短发，卫衣牛仔裤，
自然站立，微笑表情，精致可爱
```

#### 风格 3：RPG 游戏风

```
16-bit像素艺术风格角色，复古RPG游戏人物，像素化，
马赛克效果，有限色板，全身立绘，
可爱女孩，长发，连衣裙，
正面站姿，纯白色背景，游戏角色设计
```

---

## 六、常见问题

### Q: 生成的不像本人怎么办？

A: 勾选"使用照片参考"，Seedream 会以照片为参考生成。如果还是不像，可以：
- 把自定义描述里加上外貌特征（比如"戴眼镜"、"齐刘海"、"高马尾"）
- 换用 `doubao-seedream-5-0-lite` 模型（理解参考图能力更强）

### Q: 生成太慢了？

A: 一般 5-10 秒一张，属于正常速度。可以在 UI 上加个加载动画。

### Q: 免费额度用完了怎么办？

A: 付费很便宜，0.2 元一张。也可以注册多个账号换着用（不推荐）。

### Q: 能一次生成多张让用户选吗？

A: 可以！Seedream 4.0+ 支持组图生成，加 `max_images` 参数就行，最多 15 张。不过要注意：
- 多张会多花钱（按张数计费）
- 生成时间更长

### Q: API Key 安全吗？

A: 放在 server.cjs 里通过环境变量读取，前端拿不到，是安全的。但注意：
- 不要把 API Key 提交到 GitHub
- 不要把带 API Key 的代码发给别人
- 用 `.gitignore` 忽略 `.env` 文件

### Q: 生成的图可以直接转拼豆图纸吗？

A: 可以！生成的 Q 版图会直接替换当前图片，然后用户点"生成图纸"就能转拼豆了。
建议网格宽度设 30-50 格比较合适（Q版图细节不算特别多）。

---

## 七、进阶优化

### 7.1 自动试多张选最好的

可以一次生成 3-4 张，让用户选最喜欢的一张转图纸。

### 7.2 保存生成历史

把用户生成过的 Q 版图存到 localStorage，方便回看和对比。

### 7.3 更多风格预设

可以加更多风格，比如：
- 宝可梦风格
- 星露谷物语风格
- 动物森友会风格
- 粘土人风格
- 积木人风格

### 7.4 批量生成

如果用户有一堆照片，可以批量生成 Q 版再批量转拼豆。

---

## 八、快速测试

开通 API Key 之后，可以先用 curl 测试一下能不能用：

```bash
curl --location "https://ark.cn-beijing.volces.com/api/v3/images/generations" ^
--header "Content-Type: application/json" ^
--header "Authorization: Bearer 你的API_KEY" ^
--data "{\"model\":\"doubao-seedream-4-0-250828\",\"prompt\":\"像素风格Q版卡通女孩，可爱萌系，大头娃娃，长卷发，粉色连衣裙，全身像，纯白色背景\",\"size\":\"1024x1024\",\"response_format\":\"url\",\"watermark\":false}"
```

如果返回了图片 URL，说明 API 通了，可以继续接前端。
