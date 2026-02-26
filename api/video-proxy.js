const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ error: 'Missing file query param' });

  try {
    const videoUrl = `${GEMINI_BASE_URL}/${filePath}`;
    const resp = await fetch(videoUrl, {
      headers: { 'x-goog-api-key': apiKey }
    });

    if (!resp.ok) throw new Error(`Google API returned ${resp.status}`);

    const contentType = resp.headers.get('content-type') || 'video/mp4';
    const buffer = Buffer.from(await resp.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Disposition', 'inline; filename="tour-video.mp4"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download video: ' + err.message });
  }
}
