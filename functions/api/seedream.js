const SEEDREAM_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

export async function onRequestPost({ request, env }) {
  try {
    const { prompt, image, size = '1024x1024', model = 'doubao-seedream-4-0-250828' } = await request.json();
    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: '缺少生图提示词' }, { status: 400 });
    }
    if (!env.ARK_API_KEY) {
      return Response.json({ error: '服务端未配置 ARK_API_KEY' }, { status: 500 });
    }

    const requestPayload = {
      model,
      prompt,
      size,
      response_format: 'b64_json',
      watermark: false,
    };
    if (image) requestPayload.image = [image];

    const arkResponse = await fetch(SEEDREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.ARK_API_KEY}`,
      },
      body: JSON.stringify(requestPayload),
    });
    const result = await arkResponse.json();

    if (!arkResponse.ok) {
      console.error('Seedream API error:', result);
      return Response.json(
        { error: result.error?.message || '生图失败', details: result.error },
        { status: arkResponse.status },
      );
    }

    return Response.json({
      image: result.data?.[0]?.b64_json,
      revised_prompt: result.data?.[0]?.revised_prompt,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Seedream proxy error:', error);
    return Response.json({ error: `代理请求失败：${error.message}` }, { status: 500 });
  }
}

export function onRequestGet() {
  return Response.json({ error: '仅支持 POST 请求' }, { status: 405, headers: { Allow: 'POST' } });
}
