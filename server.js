import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
// Allow embedding in iframes
app.use((req, res, next) => { res.removeHeader('X-Frame-Options'); next(); });
app.use(express.static(join(__dirname, 'public')));

const MCP_URL = 'https://ai.tourradar.com/mcp/main';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-3.0-generate-001';

// Claude API client (initialized lazily)
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-key-here') {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Persona definitions for script generation
const PERSONAS = {
  adventure_seeker: {
    name: 'Adventure Seeker',
    tone: 'energetic, bold, uses action verbs, speaks to thrill-seekers',
    style: 'Fast-paced, exciting, emphasizes unique experiences and adrenaline'
  },
  luxury_traveler: {
    name: 'Luxury Traveler',
    tone: 'sophisticated, refined, emphasizes exclusivity and comfort',
    style: 'Elegant, aspirational, focuses on premium experiences and indulgence'
  },
  family_explorer: {
    name: 'Family Explorer',
    tone: 'warm, inclusive, highlights family-friendly aspects and memories',
    style: 'Heartwarming, practical, emphasizes bonding and discovery together'
  },
  culture_enthusiast: {
    name: 'Culture Enthusiast',
    tone: 'curious, knowledgeable, passionate about history and local traditions',
    style: 'Educational yet entertaining, focuses on authenticity and depth'
  },
  budget_backpacker: {
    name: 'Budget Backpacker',
    tone: 'casual, relatable, emphasizes value and authentic local experiences',
    style: 'Down-to-earth, inspiring, shows that great travel is accessible'
  }
};

async function createClient() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: 'europe-tours-app', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

// Discover available tools
app.get('/api/tools', async (req, res) => {
  try {
    const client = await createClient();
    const { tools } = await client.listTools();
    await client.close();
    res.json(tools);
  } catch (err) {
    console.error('Tools error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Search Europe tours
app.get('/api/tours', async (req, res) => {
  const { q = 'Europe', destination = 'Europe', style } = req.query;
  try {
    const client = await createClient();
    const { tools } = await client.listTools();
    console.log('Available tools:', tools.map(t => t.name));

    // Find a search tool
    const searchTool =
      tools.find(t => t.name === 'search_tours') ||
      tools.find(t => t.name.toLowerCase().includes('search')) ||
      tools.find(t => t.name.toLowerCase().includes('tour')) ||
      tools[0];

    if (!searchTool) {
      await client.close();
      return res.status(404).json({ error: 'No search tool found', tools: tools.map(t => t.name) });
    }

    console.log('Using tool:', searchTool.name, 'Schema:', JSON.stringify(searchTool.inputSchema, null, 2));

    // Build args based on the tool's input schema properties
    const schema = searchTool.inputSchema?.properties || {};
    const args = {};
    for (const [key, def] of Object.entries(schema)) {
      const lk = key.toLowerCase();
      if (lk.includes('destination') || lk.includes('location') || lk.includes('region') || lk.includes('country')) {
        args[key] = destination;
      } else if (lk.includes('query') || lk.includes('search') || lk.includes('text') || lk.includes('keyword')) {
        args[key] = q;
      } else if (lk.includes('style') && style) {
        args[key] = style;
      }
    }
    // If no args mapped, try common defaults
    if (Object.keys(args).length === 0) {
      args.destination = destination;
      args.query = q;
    }

    console.log('Calling tool with args:', args);
    const result = await client.callTool({ name: searchTool.name, arguments: args });
    await client.close();
    res.json({ tool: searchTool.name, result });
  } catch (err) {
    console.error('Tours error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generic tool call proxy
app.post('/api/call', async (req, res) => {
  const { tool, args } = req.body;
  try {
    const client = await createClient();
    const result = await client.callTool({ name: tool, arguments: args || {} });
    await client.close();
    res.json(result);
  } catch (err) {
    console.error('Call error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Video Creator API endpoints ────────────────────────────────────

// Generate a social media video script via Claude API
app.post('/api/generate-script', async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured. Add it to .env and restart.' });
  }
  const { tourName, tourDescription, destinations, persona, imageDescriptions } = req.body;
  if (!tourName || !persona || !imageDescriptions?.length) {
    return res.status(400).json({ error: 'Missing required fields: tourName, persona, imageDescriptions' });
  }
  const p = PERSONAS[persona];
  if (!p) {
    return res.status(400).json({ error: `Unknown persona: ${persona}` });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a social media video scriptwriter for travel tours. You create compelling 12-second video scripts that match a specific persona's voice and tone.

Persona: ${p.name}
Tone: ${p.tone}
Style: ${p.style}

You will receive information about a tour and 5 images that will be used in the video. Create a script that:
1. Opens with a hook (2 seconds)
2. Has 5 scenes, one per image (approximately 2 seconds each)
3. Ends with a call-to-action
4. Total duration must be exactly 12 seconds

Respond ONLY with valid JSON in this exact format (no markdown fences):
{
  "hook": "Opening text shown on screen",
  "scenes": [
    { "image_index": 0, "narration": "Voiceover text for this scene", "on_screen_text": "Short overlay text", "duration_seconds": 2.0 }
  ],
  "cta": "Closing call-to-action text",
  "full_prompt": "Complete prompt for video generation AI describing the visual style, transitions, pacing, and mood for a cinematic travel video using these 5 images"
}`,
      messages: [{
        role: 'user',
        content: `Tour: ${tourName}
Description: ${tourDescription || 'A guided group tour'}
Destinations: ${(destinations || []).join(', ') || 'Various'}

Images (in sequence order):
${imageDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Create a 12-second social media video script for this tour.`
      }]
    });

    let text = message.content[0].text;
    // Strip markdown code fences if present
    text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const script = JSON.parse(text);
    res.json({ script });
  } catch (err) {
    console.error('Script generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate script: ' + err.message });
  }
});

// Create video via Google Gemini Veo API
app.post('/api/create-video', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured. Add it to .env and restart.' });

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

    const veoResp = await fetch(`${GEMINI_BASE_URL}/models/${VEO_MODEL}:predictLongRunning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        instances: [{ prompt, image: { bytesBase64Encoded: b64, mimeType: mime } }],
        parameters: { aspectRatio: '16:9' }
      })
    });
    const data = await veoResp.json();
    if (!veoResp.ok || data.error) {
      const msg = data?.error?.message || data?.error || JSON.stringify(data);
      return res.status(500).json({ error: String(msg) });
    }
    res.json({ operation_name: data.name });
  } catch (err) {
    console.error('Video creation error:', err.message);
    res.status(500).json({ error: 'Failed to create video: ' + err.message });
  }
});

// Poll Veo video generation status
app.get('/api/video-status', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

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
        const filePath = samples[0].video.uri.replace(GEMINI_BASE_URL + '/', '');
        return res.json({ status: 'completed', video_url: `/api/video-proxy?file=${encodeURIComponent(filePath)}` });
      }
      return res.json({ status: 'failed', error: 'No video returned' });
    }
    res.json({ status: 'processing' });
  } catch (err) {
    res.json({ status: 'failed', error: err.message });
  }
});

// Proxy video download (Google API requires auth header)
app.get('/api/video-proxy', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ error: 'Missing file query param' });

  try {
    const resp = await fetch(`${GEMINI_BASE_URL}/${filePath}`, {
      headers: { 'x-goog-api-key': apiKey }
    });
    if (!resp.ok) throw new Error(`Google API returned ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="tour-video.mp4"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download video: ' + err.message });
  }
});

// ── Server start ───────────────────────────────────────────────────

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`TourRadar app running → http://localhost:${PORT}`);
  console.log(`  Video Creator → http://localhost:${PORT}/create.html`);
  if (!anthropic) console.warn('  ⚠ ANTHROPIC_API_KEY not set — script generation disabled');
  if (!process.env.GEMINI_API_KEY) console.warn('  ⚠ GEMINI_API_KEY not set — video creation disabled');
});
