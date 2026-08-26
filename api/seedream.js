const SEEDREAM_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { prompt, image, size = '1024x1024', model = 'doubao-seedream-4-0-250828' } = req.body;

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '服务端未配置 ARK_API_KEY' });
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
      return res.status(arkResponse.status).json({
        error: result.error?.message || '生图失败',
        details: result.error,
      });
    }

    return res.status(200).json({
      image: result.data?.[0]?.b64_json,
      revised_prompt: result.data?.[0]?.revised_prompt,
      usage: result.usage,
    });
  } catch (err) {
    console.error('代理请求出错:', err);
    return res.status(500).json({ error: '代理请求失败：' + err.message });
  }
}
