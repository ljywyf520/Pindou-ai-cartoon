# Codex Prompt：Q版像素人物生成功能（V3 - 萌系大头版）

## 一、目标风格（先看图再写代码！）

参考用户提供的两张萌系像素 Q 版图（迪丽热巴校园风版 + 粉色吊带裙版），风格关键词：

**整体感觉**：软萌、治愈、大头娃娃、精致像素画

**核心比例**：约 2-2.5 头身，头非常大，身体很小
- 头部高度约占人物总高度的 45-50%
- 身体 + 腿 只占 50-55%

**脸的特点**：
- 圆脸，但露出面积小（被头发遮住很多）
- 额头几乎全被刘海盖住
- 脸颊两侧被头发遮住 20-30%
- 脸看起来小巧精致

**眼睛（最重要！）**：
- 横向椭圆形，宽度 > 高度
- 虹膜很大，几乎占满眼睛内部，眼白只有边缘一圈
- 有明显的高光点（2个，一大一小）
- 上眼睑有睫毛（3-4 根小三角）
- 下眼线不明显或断开
- 两眼间距适中，不要太近也不要太远

**鼻子**：
- 几乎看不见，就 1-2 个像素点
- 位置在两眼之间偏下
- 颜色比肤色稍深

**嘴巴**：
- 很小，宽度约 6-8px
- 粉色/红色的小嘴唇
- 形状：扁扁的 U 形或微笑弧线

**腮红**：
- 眼睛下方两侧，圆形
- 粉红色，面积不大但明显
- 2-3 层渐变，柔和融入肤色

**头发**：
- 非常蓬松，两侧比脸宽出很多
- 多层颜色：主色 + 高光发丝 + 阴影
- 高光发丝是亮色的细线/小块，模拟反光
- 刘海遮住大部分额头
- 侧发遮住脸颊两侧
- 外轮廓有起伏，不是整齐的形状

**描边**：
- 外轮廓有一圈明显的黑色/深棕色描边
- 描边粗细均匀（约 2px）
- 内部细节一般不单独描边
- 有描边才像"贴纸/钥匙扣"的感觉

**身体**：
- 小小的，从头部下方开始
- 手臂自然下垂在身体两侧
- 服装要根据类型有细节（领口、袖口、褶皱）

---

## 二、画布规格

- 画布尺寸：**128×128 px**
- `ctx.imageSmoothingEnabled = false`
- 所有坐标取整数
- 人物居中，上下留白约 6-8px

### 人物尺寸参考（128 画布上）

```
总高度：约 112px（从头顶到脚底）
头部：约 56px 高（y=8 到 y=64）—— 占 50%
身体+腿：约 56px 高（y=58 到 y=120）—— 占 50%

头部宽度：约 70-75px（含头发两侧）
脸部宽度：约 45px（露出的部分）
身体宽度：约 50-55px
```

---

## 三、颜色系统

```javascript
// ===== 固定颜色 =====
const INK = '#2a1f1f';           // 深棕偏黑描边（外轮廓用）
const INK_LIGHT = '#4a3535';     // 浅棕描边（内部细节用）
const WHITE = '#fffbf7';         // 暖白（眼白/高光）
const PINK = '#f2a0a8';          // 腮红主色
const PINK_DARK = '#e08890';     // 腮红深色
const LIP = '#d46a78';           // 嘴唇色
const SHOE = '#3a2a2a';          // 鞋色
const GOLD = '#e8c070';          // 金色配饰

// ===== 从 traits 派生的颜色 =====
// 头发：三层色
const HAIR = traits.hairColor;       // 主色
const HAIR_HL = traits.hairHighlight; // 高光（亮 25%）
const HAIR_SH = traits.hairShadow;    // 阴影（暗 20%）

// 皮肤：三层色
const SKIN = traits.skinColor;       // 主色
const SKIN_SH = traits.skinShadow;   // 阴影（暗 14%）
const SKIN_BLUSH = traits.skinBlush; // 腮红基底（肤色偏红）

// 服装：三层色
const CLOTHES = traits.clothingColor;     // 主色
const CLOTHES_SH = traits.clothingShadow; // 阴影（暗 22%）
const CLOTHES_HL = traits.clothingHighlight; // 高光（亮 15%）
```

---

## 四、绘制步骤详解（从后到前）

### Step 0: 背景
```
纯白填充 128×128
ctx.fillStyle = '#ffffff'
ctx.fillRect(0, 0, 128, 128)
```

---

### Step 1: 头发后层（最靠后的头发）

这是人物最宽的部分，从背后延伸下来。

**位置**：x ≈ 20-108，y ≈ 10-100（根据发型）

**绘制方式**：
- 用 HAIR 主色填充大片头发区域
- 底部和两侧用 HAIR_SH 做阴影（加深边缘）
- 外轮廓不是整齐的直线，有轻微起伏（模拟发丝感）

**发型差异**：

```
【long_wavy 长卷发】：
  头发从头顶向两侧蓬松展开，向下延伸到背部/腰部
  宽度约 80-90px，高度约 80-90px
  两侧轮廓有波浪形起伏（不是直线）
  底部也是波浪形（发尾卷曲感）

【long_straight 长直发】：
  类似长卷发，但两侧轮廓更直
  底部更平整

【short 短发】：
  只在头部周围，长度到下巴附近
  宽度约 70-75px，高度约 50px
  底部在 y=55 左右

【twin_tails 双马尾】：
  脸两侧各有一个大的马尾团（椭圆形）
  位置：左侧 x=18-38, y=45-75；右侧 x=90-110, y=45-75
  头顶部分还是短发/中长发

【ponytail 马尾】：
  头部后方偏一侧有一个马尾凸起
  大部分头发在头部后方
```

---

### Step 2: 脖子 + 服装 + 手臂

**脖子**：
```
位置：x=56-72, y=56-66
SKIN 色填充
两侧有 SKIN_SH 阴影
宽度约 16px，高度约 10px
```

**服装（根据 clothingType）**：

#### dress 连衣裙
```
从肩部（y=62）向下展开的 A 字形
顶部窄（约 45px 宽），底部宽（约 70-75px）
长度到 y=100 左右

绘制：
1. CLOTHES 主色填充整体 A 字形
2. 两侧和底部加 CLOTHES_SH 阴影（边缘加深）
3. 腰部位置（y=78）加一条 CLOTHES_SH 细线（腰带感）
4. 裙摆底部加 2-3 条 CLOTHES_HL 竖线（褶皱高光）
5. 领口（圆领/V领）用 CLOTHES_SH 画一圈细线
```

#### jacket_skirt 外套+裙子
```
上半身（y=62 到 y=82）：
  - 外套，CLOTHES 主色
  - 敞开的，中间露出内搭（WHITE 或浅色）
  - 翻领：CLOTHES_SH 色的三角形翻领
  - 袖口：CLOTHES_SH 色的袖口线
  - 外套口袋：CLOTHES_SH 色的小方块

下半身（y=80 到 y=98）：
  - 裙子，CLOTHES_SH 色
  - A 字形展开
  - 裙摆有竖线褶皱（CLOTHES_HL 色）
```

#### hoodie 卫衣
```
宽松上衣，y=62 到 y=90
CLOTHES 主色
袖子宽大
胸前口袋：CLOTHES_SH 色的横向小矩形
帽子：在头后，CLOTHES 色的半圆形
袖口和下摆：CLOTHES_SH 色的罗纹边
```

#### top_skirt 上衣+裙子
```
类似 jacket_skirt 但更简洁
上半身是短款上衣（不是外套）
下半身是裙子
```

#### top_pants 上衣+裤子
```
上半身：短款上衣
下半身：CLOTHES_SH 色的长裤
长度到 y=105
```

**手臂 + 手**：
```
从肩部两侧伸出，自然下垂姿势
上臂：CLOTHES 色（长袖）或 SKIN 色（短袖/无袖）
下臂：SKIN 色
手：小椭圆形，SKIN 色 + SKIN_SH 阴影

位置大约：
左臂：x=22-36, y=68-88
右臂：x=92-106, y=68-88
手的位置：x=24-34 和 x=94-104, y=82-88
```

---

### Step 3: 脸（重点！）

**脸的形状**：
```
椭圆形，宽度约 48px，高度约 42px
位置：x=40-88, y=22-64（中心 x=64, y=43）

绘制方式：
1. 用 drawPixelEllipse 画 SKIN 色的大椭圆（脸部主体）
2. 脸两侧加 SKIN_SH 阴影（边缘 2-3px 的加深）
3. 下巴底部也加 SKIN_SH 阴影
4. 额头和鼻梁区域保持 SKIN 亮色

注意：
- 脸是椭圆形的，绝对不能是方的
- 上宽下窄（额头宽，下巴稍尖）
- 不用额外描边，脸的边缘由头发和肤色自然形成
```

---

### Step 4: 头发前层（刘海 + 侧发）

这是让脸"变小变精致"的关键 —— 用头发遮住额头和脸颊两侧。

**刘海（额前头发）**：
```
覆盖额头上方约 60%（从发际线下来到 y=35 左右）
底部边缘不是直线，有碎发感（不规则的锯齿状）
中间可能有分缝（露出一点额头）

绘制：
1. HAIR 主色填充刘海主体
2. 加 2-3 缕 HAIR_HL 高光发丝（亮色的弯曲细线）
3. 刘海底部边缘做 1px 的 HAIR_SH 阴影（增加层次感）
```

**侧发（脸两侧的头发）**：
```
沿着脸两侧向下，遮住脸颊约 20-30% 的宽度
左侧：x=38-46, y=30-55
右侧：x=82-90, y=30-55

绘制：
1. HAIR 主色填充
2. 加 1-2 缕 HAIR_HL 高光
3. 靠近脸的一侧边缘柔和过渡
```

**发型差异**：
- 长卷发：侧发更长，延伸到下巴以下，边缘有波浪感
- 长直发：侧发长但边缘较直
- 短发：侧发短，到耳朵附近
- 双马尾：侧发短，马尾团在更外侧

---

### Step 5: 耳朵

```
从脸两侧的头发中露出一点点
位置：y=40-46 左右
形状：小半圆/小椭圆
颜色：SKIN 色，内侧 SKIN_SH 或 SKIN_BLUSH 加深
大小：约 6px 宽，8px 高

左耳：x=36-42
右耳：x=86-92
```

---

### Step 6: 眉毛

```
位置：眼睛上方，y=35-37 左右
形状：弯弯的细眉，像两座平缓的小山丘
颜色：HAIR_SH 色（发色阴影，不是黑色！）
长度：约 10-12px
粗细：中间稍粗，两端细
左右对称

注意：
- 眉毛不要太粗太黑，会显得凶
- 要细要弯，才萌
- 颜色用发色阴影色，更自然
```

---

### Step 7: 眼睛（核心中的核心！）

**眼睛是 Q 版可爱度的灵魂，一定要画好。**

#### 位置和大小
```
每只眼睛：宽约 16px，高约 12px（横向椭圆，宽 > 高）
两眼间距：约 12-14px
整体位置：脸部横向居中，纵向在 y=39-51

左眼中心：x=51, y=45
右眼中心：x=77, y=45
```

#### 眼睛结构（从外到内，共 7 层）

```
第 1 层：眼眶轮廓（INK 深棕偏黑）
  - 横向椭圆形轮廓
  - 上眼线稍粗（2px）
  - 下眼线较细（1px）且中间可以断开
  - 外眼角稍微上挑一点

第 2 层：眼白（WHITE 暖白）
  - 填充眼眶内部
  - 注意：眼白只有边缘一圈，大部分面积被虹膜占据
  - 眼白露出宽度约 2-3px

第 3 层：虹膜（HAIR_SH 或棕色系）
  - 大圆形，占眼睛高度的 75-80%
  - 位置稍微偏下（上眼白露得多，下眼白露得少）
  - 颜色：如果提取的瞳色明显就用瞳色，否则用深棕色
  - 虹膜内部可以有深浅变化（边缘稍深，中心稍浅）

第 4 层：瞳孔（INK 深棕/黑）
  - 虹膜中心的小圆
  - 直径约 5-6px
  - 不是正圆也可以，稍微竖一点

第 5 层：高光点（WHITE 白色）
  - 至少 2 个高光点
  - 主高光：眼睛上半部分偏外侧，较大（3-4px 椭圆）
  - 次高光：眼睛下半部分偏内侧，较小（1-2px）
  - 高光都偏同一侧（比如都偏左上），模拟光源方向

第 6 层：上睫毛（INK 色）
  - 上眼睑有 3-4 根小睫毛
  - 外眼角处的睫毛稍长稍粗
  - 形状：小三角形或短线，向外散开
  - 不要太多太密，3-4 根刚好

第 7 层：下眼睑（INK_LIGHT 浅棕）
  - 下眼线颜色浅，不是完整的线
  - 中间断开，只有内外眼角有一点
  - 显得更柔和
```

---

### Step 8: 鼻子

```
非常小，几乎看不见
位置：两眼之间偏下，y=50-51
形状：就 2 个像素点（倒 V 形的简化）
颜色：SKIN_SH 色（比肤色稍暗）
大小：2px 宽，1-2px 高

注意：
- 鼻子一定要小，大鼻子毁所有
- 有时候甚至可以不画，靠腮红和眼睛就够了
```

---

### Step 9: 嘴巴

```
位置：鼻子正下方，y=54-56
大小：宽约 6-8px，高约 3-4px
形状：小小的微笑嘴
  - 上唇：INK_LIGHT 或 PINK_DARK 色的弯弯细线
  - 下唇/嘴唇：LIP 色的小色块
  - 整体像一个扁扁的 U 形

颜色：
  - 嘴线：PINK_DARK 或 INK_LIGHT
  - 嘴唇：LIP（比腮红稍深的红色）
  - 中间可以加 1px 的 WHITE 高光（水润感）

注意：
- 嘴巴要小，大嘴不好看
- 微笑的弧度要柔和
- 不要吐舌头，不要露牙齿
```

---

### Step 10: 腮红（萌系必备！）

```
位置：眼睛下方两侧，y=48-52 左右
形状：圆形/椭圆形
大小：每侧约 8-10px 宽，6-7px 高

绘制（3 层渐变）：
第 1 层（最外层）：SKIN_BLUSH，最浅，扩展到最大范围
第 2 层（中层）：PINK，中等大小
第 3 层（核心层）：PINK_DARK，最小，中心位置

注意：
- 腮红要柔和，不能太突兀
- 位置在眼睛正下方偏外侧一点
- 两边对称
- 没有腮红的 Q 版没有灵魂
```

---

### Step 11: 眼镜（如果 hasGlasses）

```
位置：覆盖在眼睛上，比眼睛稍大一圈
镜框：
  - 两个圆角矩形镜框
  - INK 色（深棕黑）
  - 镜框粗细 2px
  - 大小：每边比眼睛大 2-3px
鼻梁架：
  - 连接两个镜框的横梁
  - INK 色，1-2px 粗
镜片高光：
  - 每个镜片上方有一条 WHITE 或浅色的弧线高光
  - 模拟镜片反光
```

---

### Step 12: 项链（如果 hasNecklace）

```
位置：脖子上，y=60-63 左右
形状：一串小圆点（珍珠项链）
  - 5-7 个小圆点
  - 中间的珠子稍大（2-3px），两边的稍小（1-2px）
  - 呈弧形排列，贴合颈部曲线
颜色：WHITE 或 GOLD 色
  - 珍珠项链用 WHITE
  - 金色项链用 GOLD
```

---

### Step 13: 腿和鞋

#### 穿裙子时（dress / jacket_skirt / top_skirt）
```
两条小腿从裙子下方伸出
腿：SKIN 色
  - 细长形，约 8px 宽，12px 长
  - 位置：x=52-60 和 x=68-76, y=96-108
脚/鞋：SHOE 色
  - 小圆头鞋/玛丽珍鞋风格
  - 比腿稍宽（约 12px 宽，6px 高）
  - 鞋面上可以加 1 条 WHITE 或 GOLD 装饰带
  - 位置：y=108-114
```

#### 穿裤子时（top_pants / hoodie）
```
裤子：CLOTHES_SH 色
  - 两条裤腿，从上衣下方延伸
  - 长度到 y=105 左右
鞋：SHOE 色，在裤子下方
```

---

### Step 14: 细节点缀

```
- 头发高光发丝：在刘海和侧发上加 3-5 缕 HAIR_HL 色的弯曲细线
- 服装高光：服装凸起处加 CLOTHES_HL 色的短线/小点
- 领口细节：圆领/V领/翻领的线条
- 袖口细节：长袖的袖口罗纹
- 裙子褶皱：裙摆处的竖线
- 鞋子装饰：鞋面上的小装饰
```

---

### Step 15: 外轮廓描边（重要！）

```
对整个人物的最外层轮廓加一圈 INK 色的描边（2px 粗）
描边只加在最外层，内部细节不描

作用：
- 让人物从白底中"跳出来"
- 有"贴纸/钥匙扣"的感觉
- 整体更精致更完整

实现方式：
  可以用算法描边（检测边缘像素后加深），
  或者在绘制每一步时就注意留出描边位。
  两种方式都可以，效果达到就行。
```

---

## 五、辅助函数

```javascript
// ===== 颜色工具 =====
function darkenColor(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return '#' + [r, g, b].map(c => Math.round(c * (1 - ratio)).toString(16).padStart(2, '0')).join('');
}

function lightenColor(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return '#' + [r, g, b].map(c => Math.min(255, Math.round(c + (255 - c) * ratio)).toString(16).padStart(2, '0')).join('');
}

function blendColor(hex, targetHex, ratio) {
  const r1 = parseInt(hex.slice(1, 3), 16), g1 = parseInt(hex.slice(3, 5), 16), b1 = parseInt(hex.slice(5, 7), 16);
  const r2 = parseInt(targetHex.slice(1, 3), 16), g2 = parseInt(targetHex.slice(3, 5), 16), b2 = parseInt(targetHex.slice(5, 7), 16);
  return '#' + [r1, g1, b1].map((c, i) => Math.round(c + ([r2, g2, b2][i] - c) * ratio).toString(16).padStart(2, '0')).join('');
}

// 生成腮红色（肤色偏红）
function deriveBlushColor(skinHex) {
  const r = parseInt(skinHex.slice(1, 3), 16);
  const g = parseInt(skinHex.slice(3, 5), 16);
  const b = parseInt(skinHex.slice(5, 7), 16);
  return '#' + [
    Math.min(255, Math.round(r * 1.15)),
    Math.round(g * 0.9),
    Math.round(b * 0.85)
  ].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ===== 像素形状绘制 =====

// 像素画圆
function drawPixelCircle(ctx, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
}

// 像素画椭圆
function drawPixelEllipse(ctx, cx, cy, rx, ry, color) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
}

// 像素画空心椭圆（描边用）
function drawPixelEllipseStroke(ctx, cx, cy, rx, ry, color, thickness = 1) {
  // 外椭圆 - 内椭圆 = 环
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const outer = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      const inner = (x * x) / ((rx - thickness) * (rx - thickness)) + (y * y) / ((ry - thickness) * (ry - thickness));
      if (outer <= 1 && inner > 1) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
}

// scanline 填充 polygon
function fillPixelPolygon(ctx, points, color) {
  // points: [[x,y], [x,y], ...]
  // 找到 y 的范围
  let minY = Infinity, maxY = -Infinity;
  points.forEach(p => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  
  ctx.fillStyle = color;
  for (let y = Math.round(minY); y <= Math.round(maxY); y++) {
    // 找到这一行与 polygon 边的所有交点
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const x = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
        intersections.push(Math.round(x));
      }
    }
    intersections.sort((a, b) => a - b);
    // 两两配对填充
    for (let i = 0; i < intersections.length; i += 2) {
      if (i + 1 < intersections.length) {
        ctx.fillRect(intersections[i], y, intersections[i + 1] - intersections[i], 1);
      }
    }
  }
}
```

---

## 六、特征提取算法（修正版）

### 肤色检测（更严格，排除灰色）

之前的肤色检测把灰头发/灰衣服识别成了肤色，导致生成的人物肤色偏灰。现在增加三道检查：

```javascript
function isSkin(r, g, b) {
  // 1. 基础 YCbCr 检查
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (cb < 77 || cb > 135 || cr < 133 || cr > 185) return false;
  
  // 2. HSV 检查
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  const v = max / 255;
  const s = max === 0 ? 0 : delta / max;
  if (v < 0.25 || v > 0.98) return false;
  if (s < 0.15) return false; // 饱和度太低的是灰色，排除！
  
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
  }
  if (h > 50 && h < 340) return false; // 色相不在红橙黄范围
  
  // 3. RGB 比例检查（正常肤色一定是 R > G > B）
  if (r <= g || g <= b) return false;
  
  // 4. 排除太暗的（接近黑色的不是肤色）
  if (r < 80) return false;
  
  return true;
}
```

### Fallback 默认肤色

如果检测出来的肤色饱和度太低或颜色太奇怪，直接用默认的亚洲人肤色：
```javascript
const DEFAULT_SKIN = '#f5d0c5';
```

### 其他特征提取（发色/服装色等）保持不变

---

## 七、UI 部分（保持不变）

UI 结构和样式与 V2 相同，包含：
- 照片上传入口
- 检测结果 4 格展示（发色/肤色/服装色/发型）
- 手动微调控件（5 种发型、5 种服装、3 个颜色选择器、眼镜/项链/钥匙扣开关）
- 实时预览
- 应用为当前图片 / 重新生成按钮

---

## 八、重要提醒（给 Codex 的）

### 风格把控优先级

1. **头一定要大** — 占整体 45-50%，头大才 Q
2. **脸一定要圆** — 椭圆脸，不用方的
3. **眼睛要大但眼白要少** — 虹膜占满才萌，眼白多像瞪着
4. **鼻子要几乎看不见** — 2px 就够了
5. **腮红一定要有** — 萌系灵魂
6. **头发要蓬松有层次** — 三层色 + 高光发丝
7. **外轮廓要有描边** — 才像贴纸/钥匙扣
8. **描边用深棕不用纯黑** — 更柔和

### 绝对不要做的事

1. 不要画方脸 — 像机器人
2. 不要大眼白 — 像受惊/僵尸
3. 不要大鼻子 — 毁所有
4. 不要吐舌头/露牙齿 — 很奇怪
5. 不要用纯黑色描边 — 太硬
6. 不要头发单色块 — 像头盔
7. 不要眉毛太粗太黑 — 像生气
8. 不要身体比例太大 — 头小身子大不萌

---

## 九、完整 Prompt（直接复制给 Codex）

### 任务

请**完全重写** `studio/chibiGenerator.js` 中的 Q版人物绘制部分。之前的版本太丑了（方脸、大眼白、灰肤色、像机器人），需要改成用户指定的萌系大头像素风格。

### 目标风格（重要！先理解）

参考用户提供的两张萌系像素 Q 版图（迪丽热巴校园风版、粉色吊带裙版）。核心特征：

- **大头小身**：约 2-2.5 头身，头占整体 45-50%
- **脸小而圆**：脸被头发遮住很多（刘海+侧发），露出面积小，椭圆脸
- **横向大眼**：眼睛是横向椭圆，虹膜很大占满眼睛，眼白只有边缘一圈，有 2 个高光点，上睫毛 3-4 根
- **鼻子极小**：1-2px，几乎看不见
- **小嘴微笑**：6-8px 宽，粉色嘴唇
- **圆形腮红**：眼睛下方两侧，3 层渐变粉色
- **蓬松头发**：三层色（主+高+阴），有高光发丝，遮住额头和脸颊两侧
- **外轮廓描边**：深棕黑色 2px 粗描边，像贴纸
- **整体感觉**：软萌、治愈、精致、像大头娃娃

### 文件结构

```
拼豆网页/
└── studio/
    ├── chibiGenerator.js  # 【完全重写绘制部分】
    ├── index.html         # 如果已经加了 UI 就不用改
    ├── app.js             # 如果已经接好了就不用改
    └── styles.css         # 如果已经加了样式就不用改
```

### 技术栈

纯 vanilla JS + Canvas API，ES Module，零外部依赖。

### 需要重写的核心：drawChibi() 函数

#### 画布设置
- 128×128
- `ctx.imageSmoothingEnabled = false`
- 所有坐标取整数

#### 颜色系统
```
INK = '#2a1f1f'          // 深棕偏黑（外轮廓描边）
INK_LIGHT = '#4a3535'    // 浅棕（内部细节）
WHITE = '#fffbf7'        // 暖白（眼白/高光）
PINK = '#f2a0a8'         // 腮红主色
PINK_DARK = '#e08890'    // 腮红深色
LIP = '#d46a78'          // 嘴唇色
SHOE = '#3a2a2a'         // 鞋色
GOLD = '#e8c070'         // 金色
HAIR/HAIR_HL/HAIR_SH     // 头发三层色（从 traits）
SKIN/SKIN_SH/SKIN_BLUSH  // 皮肤三层色（从 traits）
CLOTHES/CLOTHES_SH/CLOTHES_HL // 服装三层色（从 traits）
```

#### 人物比例（128 画布上）
- 总高：约 112px（头顶到脚底）
- 头部：约 56px（占 50%）
- 身体+腿：约 56px（占 50%）
- 头部宽度：约 70-75px（含头发）

#### 绘制顺序（从后到前，共 15 步）

1. **背景** — 纯白填充

2. **头发后层** — 最靠后的大片头发
   - 长发：延伸到背部，宽 80-90px
   - 短发：只在头部周围
   - 双马尾：两侧各一个马尾团
   - HAIR 主色 + HAIR_SH 边缘阴影

3. **脖子 + 服装 + 手臂**
   - 脖子：SKIN 色，16px 宽
   - 服装根据 clothingType：
     - dress：A 字形连衣裙，有腰带线，裙摆褶皱
     - jacket_skirt：敞开外套 + 格子裙，翻领
     - hoodie：宽松卫衣 + 口袋
     - top_skirt：短上衣 + 裙子
     - top_pants：上衣 + 裤子
   - 手臂自然下垂，小手

4. **脸** — 椭圆脸（drawPixelEllipse）
   - 宽 48px，高 42px
   - SKIN 主色 + SKIN_SH 两侧阴影
   - 上宽下窄
   - 不描边，由头发形成自然边界

5. **头发前层** — 刘海 + 侧发（关键！遮住脸的大部分）
   - 刘海：遮住额头 60%，底部碎发感，2-3 缕高光
   - 侧发：遮住脸颊 20-30%，加高光
   - 脸露出得少才精致

6. **耳朵** — 小椭圆，SKIN 色，从头发中露出一点

7. **眉毛** — 细细的弯眉，HAIR_SH 色，不要太粗太黑

8. **眼睛**（重点！7 层结构）
   - 每只眼：宽 16px，高 12px（横向椭圆）
   - 7 层：INK 眼眶 → WHITE 眼白 → 大虹膜 → INK 瞳孔 → WHITE 高光（2个）→ INK 上睫毛 → INK_LIGHT 下眼睑
   - 虹膜占眼睛高度 75-80%，眼白只有边缘一圈
   - 高光偏同一侧（左上）
   - 上睫毛 3-4 根，外眼角稍长

9. **鼻子** — 极小，2px，SKIN_SH 色，几乎看不见

10. **嘴巴** — 小微笑嘴，6-8px 宽，LIP 色，不吐舌头不露牙

11. **腮红** — 眼睛下方两侧，圆形，3 层渐变（SKIN_BLUSH → PINK → PINK_DARK）

12. **眼镜**（如果有）— 圆角矩形镜框 + 鼻梁架 + 镜片高光

13. **项链**（如果有）— 脖子上一串 5-7 个白色小圆点（珍珠）

14. **腿 + 鞋** — 小腿从裙/裤下伸出，小圆头鞋

15. **外轮廓描边** — 整个人物最外层 2px INK 色描边，像贴纸

#### 辅助函数
- `darkenColor` / `lightenColor` / `blendColor` / `deriveBlushColor`
- `drawPixelCircle` / `drawPixelEllipse` / `drawPixelEllipseStroke`
- `fillPixelPolygon`（scanline 填充）

### 肤色检测修正

之前的肤色检测把灰头发识别成了肤色，生成了灰皮肤的丧尸脸。请修正：

1. 增加饱和度下限：S < 0.15 的直接排除（灰色不是肤色）
2. 增加 RGB 比例检查：正常肤色一定是 R > G > B，否则排除
3. 增加色相检查：H 不在 0-50 度范围内排除
4. 如果检测到的肤色饱和度太低或颜色异常，使用默认肤色 `#f5d0c5`

### 风格把控红线（绝对不能违反）

1. ❌ 不能画方脸 — 必须是椭圆脸
2. ❌ 不能大眼白 — 虹膜要大，眼白要少
3. ❌ 不能大鼻子 — 2px 就够了
4. ❌ 不能用纯黑描边 — 用深棕 `#2a1f1f`
5. ❌ 不能头发单色块 — 要有三层色和高光发丝
6. ❌ 不能眉毛粗黑 — 要细要弯，用发色阴影色
7. ❌ 不能吐舌头露牙齿 — 只要微笑嘴
8. ❌ 不能身体比头大 — 头身比至少 1:1，最好 2:1
