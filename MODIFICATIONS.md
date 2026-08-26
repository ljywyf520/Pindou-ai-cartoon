# 十三拼豆坊 Web App 改造记录

更新时间：2026-08-25

本文记录本轮将「十三拼豆坊 · 拼豆图纸转换器」从静态网站改造成 React + Vite Web App 第一步时完成的全部修改，以及当前尚未实现的功能。

## 1. 本轮完成范围

本轮完成的是产品拆解中的第 1 步：用户系统。

- 使用 React + Vite 建立可运行的前端项目。
- 接入 Zion 的真实账号认证接口。
- 支持用户名注册、登录和退出。
- 使用 Zion JWT 保存并恢复登录状态。
- 登录后从 Zion 数据库读取用户业务资料。
- 登录后自动创建或加载用户权益记录。
- 建立账户配额展示：剩余图纸导出次数、剩余 AI 生图次数、会员状态。
- 将 Netlify 发布目录切换为 Vite 的 `dist` 目录。
- 保留现有 `bead-core-main` 算法库、Seedream 后端代理和 `studio/` 资产，未重写这些已有资产。

## 2. Zion 后端配置

### 项目

- Zion 项目 ID：`mwLZrNjJ44A`
- 类型系统：`pre_type_system_refactor`
- 前端 GraphQL 接口：

  `https://zion-app.functorz.com/zero/mwLZrNjJ44A/api/graphql-v2`

认证使用 Zion 自带的 `account` 体系；业务权益不直接写入 account，而是写入自建的「用户」表。

### 「用户」表

已建立并同步到后端的业务表为「用户」，前端对应的 GraphQL 表名为 `user`。

| 业务字段 | GraphQL 字段 | 用途 |
| --- | --- | --- |
| 用户名 | `username` | 与 Zion account 用户名对应 |
| 剩余图纸导出次数 | `remaining_export_count` | 后续无水印导出扣减 |
| 剩余 AI 生图次数 | `remaining_ai_count` | 后续 Q 版生图扣减 |
| 会员状态 | `membership_status` | 记录免费、会员等状态 |

已配置用户名唯一约束：`user_username_key`。

新注册用户首次加载资料时，前端会写入以下默认值：

```text
remaining_export_count = 0
remaining_ai_count = 0
membership_status = free
```

### 权限

- `Anonymous User`：对「用户」表无权限。
- `Logged-in User`：只能读取和创建自己的用户记录。
- 前端访问业务表时携带 Zion JWT。

## 3. 前端文件修改

### `index.html`

新增 Vite/React 项目入口：

- 设置中文页面语言 `zh-CN`。
- 设置移动端 viewport。
- 设置页面标题：`十三拼豆坊 · 拼豆图纸转换器`。
- 挂载 `<div id="root"></div>`。
- 引入 `/src/main.jsx`。

### `src/main.jsx`

新增 React 入口文件：

- 使用 `ReactDOM.createRoot` 挂载应用。
- 使用 `React.StrictMode` 包裹根组件。
- 引入 `App` 和全局样式 `styles.css`。

### `src/App.jsx`

新增主页面和用户系统交互逻辑：

- 登录/注册模式切换。
- 用户名和密码表单。
- 注册按钮调用 Zion 真实注册接口。
- 登录按钮调用 Zion 真实登录接口。
- 登录成功后读取用户业务资料。
- 没有用户资料时自动创建「用户」记录。
- 页面刷新时从 `localStorage` 恢复 JWT 和用户名。
- 登录态失效时清理本地会话并提示用户重新登录。
- 登录后展示账户名、账户 ID、导出次数、AI 生图次数和会员状态。
- 提供退出登录按钮。
- 提供请求中、成功、失败和恢复登录态等状态提示。
- 对空用户名或空密码进行前端校验。

### `src/zion.js`

新增 Zion GraphQL 客户端封装：

- 定义 Zion GraphQL 接口地址。
- 定义 `authenticateWithUsername` 认证 mutation。
- 定义按用户名读取用户资料的 query。
- 定义创建用户资料的 mutation。
- 自动发送 `Authorization: Bearer <JWT>` 请求头。
- 统一处理 HTTP 错误和 GraphQL 错误。
- 使用 `localStorage` 保存登录状态，键名为 `douge.zion.session`。
- 提供以下方法：

  - `authenticateWithUsername`
  - `fetchUserProfile`
  - `ensureUserProfile`
  - `readStoredSession`
  - `saveStoredSession`
  - `clearStoredSession`

### `src/styles.css`

新增第一版 Web App 视觉样式，沿用原有 `studio/` 的纸感和暖色方向：

- 米白纸张背景。
- 十三拼豆坊品牌色块标识。
- 暖色、绿色和蓝色 MARD 风格色彩点缀。
- 顶部品牌栏和 Zion 连接状态。
- 用户账户指标区域。
- 登录/注册切换标签。
- 表单、按钮、状态提示和响应式布局。
- 桌面端双栏布局，窄屏下自动切换为单栏布局。

## 4. 构建和部署配置

### `package.json`

新增本地 React + Vite 工程配置：

```json
{
  "name": "douge-factory-webapp",
  "private": true,
  "type": "module"
}
```

依赖：

- `react` `^18.3.1`
- `react-dom` `^18.3.1`
- `vite` `^5.4.10`

脚本：

- `npm run dev`
- `npm run build`
- `npm run preview`

### `package-lock.json`

由 npm 根据新的 React + Vite 依赖生成，用于固定本地安装版本。

### `.gitignore`

新增 `dist/` 忽略规则，避免将 Vite 构建产物作为源码提交。

### `netlify.toml`

已调整为：

- 发布目录从项目根目录改为 `dist`。
- 保留 Netlify Functions 目录 `netlify/functions`。
- 保留 `/api/seedream` 到 `/.netlify/functions/seedream` 的转发。
- 增加 SPA 通配回退，将前端路由回退到 `/index.html`。
- 删除旧的根路径跳转到 `/studio/` 配置，让新 Web App 成为默认首页。

## 5. 已保留的现有资产

以下资产本轮没有重写或删除：

- `bead-core-main/`：拼豆图纸转换 TypeScript 算法库。
- `netlify/functions/seedream.js`：Seedream 后端代理能力。
- `studio/`：原有页面、Q 版人物生成和视觉参考文件。

说明：`bead-core-main` 和 Seedream 权益扣减目前只是保留，尚未接入本轮用户配额流程，属于后续产品步骤。

## 6. 验证结果

已执行：

```bash
npm run build
```

结果：构建成功，Vite 正常生成：

- `dist/index.html`
- `dist/assets/index-BDjZWb6w.js`
- `dist/assets/index-CmwrNVmi.css`

本地预览命令：

```bash
npm run preview -- --host 0.0.0.0 --port 4173
```

当前可用地址：

- `http://localhost:4173/`
- `http://127.0.0.1:4173/`
- `http://192.168.0.8:4173/`

首页、JavaScript 和 CSS 资源均已通过本地 HTTP 请求验证，返回状态为 `200`。

## 7. 当前尚未完成的功能

以下功能没有在本轮提前实现：

1. 独立的用户中心和兑换记录列表。
2. 兑换码生成、兑换和使用记录。
3. 图纸导出次数校验、扣减和水印权限。
4. AI Q 版人物生成次数校验、扣减和生成记录。
5. 管理员后台。
6. 订单系统。
7. 微信/支付宝支付和支付回调自动发放权益。

下一步应在确认本轮注册、登录、退出和 Zion 用户表读写无误后，再实现用户中心。

## 8. 当前使用方式

在项目目录执行：

```bash
npm install
npm run dev
```

如果只需要预览已经构建好的版本：

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

注册和登录时，页面会直接请求 Zion；因此需要网络可访问 Zion 接口。Zion 后台可用于查看「用户」表、账户记录和权限配置。

## 9. 结论

当前项目已经从原来的静态页面入口切换为 React + Vite Web App 入口，并完成了第一个真实后端功能：Zion 用户注册、登录、退出和账户资料读写。

它现在是一个可继续扩展的 Web App 基础版本，但还不是完整的付费产品。兑换码、权限扣减、管理员后台和支付需要按产品拆解顺序继续实现。
