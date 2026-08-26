const SEEDREAM_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

async function generateSeedream(request, env) {
  if (request.method !== 'POST') {
    return json({ error: '仅支持 POST 请求' }, 405, { Allow: 'POST' });
  }

  try {
    const { prompt, image, size = '1024x1024', model = 'doubao-seedream-4-0-250828' } = await request.json();
    if (!prompt || typeof prompt !== 'string') {
      return json({ error: '缺少生图提示词' }, 400);
    }
    if (!env.ARK_API_KEY) {
      return json({ error: '服务端未配置 ARK_API_KEY' }, 500);
    }

    const payload = {
      model,
      prompt,
      size,
      response_format: 'b64_json',
      watermark: false,
    };
    if (image) payload.image = [image];

    const upstream = await fetch(SEEDREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.ARK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await upstream.json();

    if (!upstream.ok) {
      console.error('Seedream API error:', result);
      return json(
        { error: result.error?.message || '生图失败', details: result.error },
        upstream.status,
      );
    }

    return json({
      image: result.data?.[0]?.b64_json,
      revised_prompt: result.data?.[0]?.revised_prompt,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Seedream proxy error:', error);
    return json({ error: `代理请求失败：${error.message}` }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/seedream') {
      return generateSeedream(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
