# 腾讯云国内测试部署

本方案将前端静态页面部署到 CloudBase 静态托管，并用腾讯云 SCF + API 网关提供 AI 生图接口。两者均有免费试用或免费额度，适合先验证国内访问；长期使用以腾讯云账户实际价格和备案要求为准。

## 1. 创建资源

1. 在腾讯云开通 CloudBase，创建环境并完成实名认证。
2. 在云函数 SCF 创建 HTTP 函数：
   - 函数名：`seedream`
   - 运行环境：Node.js 18 或更高
   - 执行方法：`index.main`
   - 代码：上传 `cloudbase/seedream/` 目录中的 `index.js`
3. 为该函数创建 API 网关 HTTP 触发器，记录生成的 HTTPS 调用地址。
4. 在函数环境变量中添加 `ARK_API_KEY`。不要把它添加到前端、Git 仓库或构建变量。

## 2. 构建前端

在项目根目录创建 `.env.production.local`，填写 API 网关地址：

```text
VITE_SEEDREAM_ENDPOINT=https://你的-api-网关地址
```

该地址是公开配置，可出现在浏览器代码中；只有 `ARK_API_KEY` 必须保密。

然后执行：

```powershell
npm run build
```

将生成的 `dist/` 目录上传至 CloudBase 静态网站托管。

## 3. 验证

1. 使用手机流量打开 CloudBase 提供的域名，确认无需 VPN。
2. 登录并生成拼豆图纸。
3. 测试一次 Q 版生图。

## 上线前安全项

当前生图接口接受公开请求。正式收费前，应在 API 网关增加限流，并在函数中校验登录令牌或用户权益，防止他人绕过前端直接调用接口消耗你的 Seedream 额度。
