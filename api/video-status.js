const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  // Operation name comes as query param (URL-encoded)
  const opName = req.query.op;
  if (!opName) return res.status(400).json({ error: 'Missing operation name (op query param)' });

  try {
    const resp = await fetch(`${GEMINI_BASE_URL}/${opName}`, {
      headers: { 'x-goog-api-key': apiKey }
    });

    const data = await resp.json();
    if (data.error) {
      const msg = typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
      return res.json({ status: 'failed', error: msg });
    }

    if (data.done) {
      const samples = data.response?.generateVideoResponse?.generatedSamples || [];
      if (samples.length && samples[0].video?.uri) {
        const videoUri = samples[0].video.uri;
        // Return proxy URL instead of direct Google URL (needs auth)
        const filePath = videoUri.replace(GEMINI_BASE_URL + '/', '');
        const proxyUrl = `/api/video-proxy?file=${encodeURIComponent(filePath)}`;
        return res.json({ status: 'completed', video_url: proxyUrl });
      }
      return res.json({ status: 'failed', error: 'Video generation completed but no video returned' });
    }

    res.json({ status: 'processing' });
  } catch (err) {
    res.json({ status: 'failed', error: 'Failed to check status: ' + err.message });
  }
}
