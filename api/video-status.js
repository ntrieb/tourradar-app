export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'CREATOMATE_API_KEY not configured' });

  const renderId = req.query.id;
  if (!renderId) return res.status(400).json({ error: 'Missing render ID (id query param)' });

  try {
    const resp = await fetch(`https://api.creatomate.com/v2/renders/${renderId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.message || data?.error || JSON.stringify(data);
      return res.json({ status: 'failed', error: msg });
    }

    switch (data.status) {
      case 'succeeded':
        return res.json({
          status: 'completed',
          video_url: data.url,
          snapshot_url: data.snapshot_url,
          duration: data.duration,
          file_size: data.file_size
        });

      case 'failed':
        return res.json({
          status: 'failed',
          error: data.error_message || 'Video rendering failed'
        });

      case 'planned':
      case 'waiting':
      case 'transcribing':
      case 'rendering':
      default:
        return res.json({ status: 'processing' });
    }
  } catch (err) {
    res.json({ status: 'failed', error: 'Failed to check status: ' + err.message });
  }
}
