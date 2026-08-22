const SEEDREAM_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { prompt, image, size = '1024x1024', model = 'doubao-seedream-4-0-250828' } = body;

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '服务端未配置 ARK_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestPayload = {
      model,
      prompt,
      size,
      response_format: 'b64_json',
      watermark: false,
    };

    if (image) {
      requestPayload.image = [image];
    }

    const arkResponse = await fetch(SEEDREAM_URL, {
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
      return new Response(JSON.stringify({
        error: result.error?.message || '生图失败',
        details: result.error,
      }), {
        status: arkResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      image: result.data?.[0]?.b64_json,
      revised_prompt: result.data?.[0]?.revised_prompt,
      usage: result.usage,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('代理请求出错:', err);
    return new Response(JSON.stringify({ error: '代理请求失败：' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
