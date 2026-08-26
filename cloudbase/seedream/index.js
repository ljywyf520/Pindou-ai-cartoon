const SEEDREAM_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body, statusCode = 200) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

// Tencent Cloud SCF HTTP function entry: index.main
exports.main = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return response({}, 204);
  if (method !== 'POST') return response({ error: '仅支持 POST 请求' }, 405);

  try {
    const input = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
    const { prompt, image, size = '1024x1024', model = 'doubao-seedream-4-0-250828' } = input;
    if (!prompt || typeof prompt !== 'string') return response({ error: '缺少生图提示词' }, 400);
    if (!process.env.ARK_API_KEY) return response({ error: '服务端未配置 ARK_API_KEY' }, 500);

    const payload = { model, prompt, size, response_format: 'b64_json', watermark: false };
    if (image) payload.image = [image];

    const upstream = await fetch(SEEDREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ARK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      return response({ error: result.error?.message || '生图失败', details: result.error }, upstream.status);
    }

    return response({
      image: result.data?.[0]?.b64_json,
      revised_prompt: result.data?.[0]?.revised_prompt,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Seedream proxy error:', error);
    return response({ error: `代理请求失败：${error.message}` }, 500);
  }
};
