const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-3.0-generate-001';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const { image_urls, prompt } = req.body;
  if (!image_urls?.length || !prompt) {
    return res.status(400).json({ error: 'Missing required fields: image_urls, prompt' });
  }

  try {
    // Download first image and convert to base64
    const imgResp = await fetch(image_urls[0]);
    if (!imgResp.ok) throw new Error(`Failed to download image: ${imgResp.status}`);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const b64 = imgBuffer.toString('base64');
    const mime = imgResp.headers.get('content-type') || 'image/jpeg';

    // Build Veo request
    const veoBody = {
      instances: [{
        prompt,
        image: { bytesBase64Encoded: b64, mimeType: mime }
      }],
      parameters: { aspectRatio: '16:9' }
    };

    const veoResp = await fetch(`${GEMINI_BASE_URL}/models/${VEO_MODEL}:predictLongRunning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(veoBody)
    });

    const data = await veoResp.json();
    if (!veoResp.ok || data.error) {
      const msg = data?.error?.message || data?.error || JSON.stringify(data);
      return res.status(500).json({ error: String(msg) });
    }

    const opName = data.name;
    if (!opName) return res.status(500).json({ error: 'No operation name returned from Veo API' });

    res.json({ operation_name: opName });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create video: ' + err.message });
  }
}
