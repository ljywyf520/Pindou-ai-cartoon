# Cloudflare Workers 免费部署

Cloudflare Worker 同时托管前端静态资源和 `/api/seedream` AI 生图接口，适配新版 Workers Builds 创建流程。

## 创建项目

1. 登录 Cloudflare Dashboard，进入 **Workers & Pages**，选择 **Create application**。
2. 选择 **Worker**，连接 GitHub 仓库 `ljywyf520/Pindou-ai-cartoon`。
3. 使用以下构建设置：

   | 设置 | 值 |
   | --- | --- |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | 留空 |

4. 部署完成后，在 Worker 的 **Settings > Variables and Secrets** 添加生产环境密钥：

   | 名称 | 值 |
   | --- | --- |
   | `ARK_API_KEY` | 火山引擎 Ark API Key |

5. 点击部署。部署成功后会得到一个 `*.workers.dev` 地址。

## 验证

- 用 `https://你的项目.workers.dev` 打开首页。
- 登录、生成图纸后，测试一次 AI Q 版生成。
- 浏览器开发者工具中，AI 请求应发送到同域名 `/api/seedream`，而不是 Vercel。

## 说明

- `ARK_API_KEY` 只能保存为 Cloudflare Secret，不能写进 `.env` 后提交 Git。
- Workers 有免费额度，适合测试和小规模使用；Seedream 的调用费用仍由火山引擎单独收取。
- Cloudflare 在中国大陆的访问稳定性因地区和网络而异。先用不同运营商的手机流量测试，再决定是否继续使用。
