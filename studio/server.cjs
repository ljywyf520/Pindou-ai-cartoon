const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4174);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * 读取 POST 请求体
 */
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

/**
 * 发送 JSON 响应
 */
function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(data));
}

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '');

  // ===== 豆包 Seedream API 代理 =====
  // 前端不能直接调 API（跨域 + API Key 暴露问题），走本地代理
  if (cleanPath === 'api/seedream' && request.method === 'POST') {
    try {
      const body = await readBody(request);
      const { prompt, image, size = '1024x1024', model = 'doubao-seedream-4-0-250828' } = JSON.parse(body);

      // 从环境变量读取 API Key（在启动脚本里设置）
      const apiKey = process.env.ARK_API_KEY;
      if (!apiKey) {
        sendJson(response, 500, { error: '未配置 ARK_API_KEY。请在启动脚本中设置 set ARK_API_KEY=你的key' });
        return;
      }

      // 组装请求体
      const requestPayload = {
        model,
        prompt,
        size,
        response_format: 'b64_json', // 直接返回 base64，省一次下载
        watermark: false,
      };

      // 如果传了参考图（图生图）
      if (image) {
        requestPayload.image = [image];
      }

      // 调用火山方舟 API
      const arkResponse = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestPayload),
      });

      const result = await arkResponse.json();

      if (!arkResponse.ok) {
        console.error('Seedream API 错误:', result);
        sendJson(response, arkResponse.status, {
          error: result.error?.message || '生图失败',
          details: result.error,
        });
        return;
      }

      // 返回图片 base64
      sendJson(response, 200, {
        image: result.data?.[0]?.b64_json,
        revised_prompt: result.data?.[0]?.revised_prompt,
        usage: result.usage,
      });
    } catch (err) {
      console.error('代理请求出错:', err);
      sendJson(response, 500, { error: '代理请求失败：' + err.message });
    }
    return;
  }

  // ===== 静态文件服务 =====
  const requested = url.pathname === '/' || cleanPath === 'studio' || cleanPath === 'studio/' ? 'studio/index.html' : cleanPath;
  const file = path.normalize(path.join(root, requested));
  if (!file.startsWith(root + path.sep) && file !== root) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream' });
    response.end(data);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`十三拼豆坊已启动：http://127.0.0.1:${port}`);
  if (process.env.ARK_API_KEY) {
    console.log('✅ Seedream API 已配置');
  } else {
    console.log('⚠️  未配置 ARK_API_KEY，AI Q版生成功能不可用');
  }
});
