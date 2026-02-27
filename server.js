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

// Claude API client (initialized lazily)
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-key-here') {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Persona definitions for script generation
const PERSONAS = {
  sara_connected_wanderer: {
    name: 'Sara: The Connected Wanderer',
    age: '27-40',
    tone: 'polished, aspirational, authentic, speaks to self-improvement and enriching experiences',
    style: 'Curated and thoughtful, balances adventure with comfort, emphasizes safety, quality, and reliability'
  },
  michael_susan_leisure_lovers: {
    name: 'Michael & Susan: Leisure Lovers',
    age: '55+',
    tone: 'warm, refined, reassuring, speaks to bucket-list dreams and cultural richness',
    style: 'Elegant and relaxed, emphasizes smaller groups, high-end accommodations, hassle-free logistics, and rich cultural experiences'
  },
  ava_experience_explorer: {
    name: 'Ava: The Experience Explorer',
    age: '18-27',
    tone: 'energetic, trendy, social media-savvy, speaks to FOMO and visual excitement',
    style: 'Fun and social, emphasizes Instagrammable moments, group dynamics, affordability, and ease of booking'
  },
  peter_anne_cultural_adventurers: {
    name: 'Peter & Anne: Cultural Adventurers',
    age: '40-60',
    tone: 'knowledgeable, active, appreciative, speaks to well-rounded cultural experiences',
    style: 'Balanced adventure and culture, emphasizes all-inclusive packages, high-quality accommodations, hiking, biking, and cultural events'
  }
};

// Persona-specific Creatomate video templates
const PERSONA_TEMPLATES = {
  sara_connected_wanderer: {
    font: 'Montserrat', fontWeight: 700,
    accentColor: '#E8A87C', ctaBg: 'rgba(232,168,124,0.85)',
    transition: 'fade', transitionDuration: 0.5,
    sceneDuration: 2.0,
    animations: [
      { startScale: '100%', endScale: '120%' },
      { startScale: '120%', endScale: '100%', startX: '40%', endX: '60%' },
      { startScale: '100%', endScale: '120%', startX: '60%', endX: '40%' },
      { startScale: '120%', endScale: '100%' },
      { startScale: '100%', endScale: '115%', startX: '45%', endX: '55%' }
    ]
  },
  michael_susan_leisure_lovers: {
    font: 'Playfair Display', fontWeight: 700,
    accentColor: '#C9B037', ctaBg: 'rgba(201,176,55,0.85)',
    transition: 'fade', transitionDuration: 0.8,
    sceneDuration: 2.5,
    animations: [
      { startScale: '105%', endScale: '115%' },
      { startScale: '115%', endScale: '105%', startX: '55%', endX: '45%' },
      { startScale: '100%', endScale: '110%' },
      { startScale: '110%', endScale: '100%', startX: '45%', endX: '55%' },
      { startScale: '105%', endScale: '112%' }
    ]
  },
  ava_experience_explorer: {
    font: 'Poppins', fontWeight: 800,
    accentColor: '#FF6B6B', ctaBg: 'rgba(255,107,107,0.85)',
    transition: 'slide', transitionDuration: 0.4,
    sceneDuration: 1.5,
    animations: [
      { startScale: '100%', endScale: '130%' },
      { startScale: '130%', endScale: '100%', startX: '35%', endX: '65%' },
      { startScale: '100%', endScale: '125%', startX: '65%', endX: '35%' },
      { startScale: '125%', endScale: '100%', startX: '40%', endX: '60%' },
      { startScale: '100%', endScale: '130%', startX: '60%', endX: '40%' }
    ]
  },
  peter_anne_cultural_adventurers: {
    font: 'Lora', fontWeight: 700,
    accentColor: '#2D6A4F', ctaBg: 'rgba(45,106,79,0.85)',
    transition: 'fade', transitionDuration: 0.6,
    sceneDuration: 2.0,
    animations: [
      { startScale: '100%', endScale: '118%' },
      { startScale: '118%', endScale: '100%', startX: '55%', endX: '45%' },
      { startScale: '100%', endScale: '115%', startX: '40%', endX: '55%' },
      { startScale: '115%', endScale: '100%' },
      { startScale: '100%', endScale: '120%', startX: '55%', endX: '45%' }
    ]
  }
};

function buildCreatomateSource(imageUrls, script, personaId) {
  const tpl = PERSONA_TEMPLATES[personaId] || PERSONA_TEMPLATES.sara_connected_wanderer;
  const elements = [];

  // Build 5 image elements on track 1 (sequential)
  imageUrls.forEach((url, i) => {
    const anim = tpl.animations[i] || { startScale: '100%', endScale: '120%' };
    const panAnim = {
      type: 'pan',
      start_scale: anim.startScale,
      end_scale: anim.endScale,
      easing: 'linear'
    };
    if (anim.startX) panAnim.start_x = anim.startX;
    if (anim.endX) panAnim.end_x = anim.endX;

    const imgEl = {
      type: 'image',
      track: 1,
      duration: tpl.sceneDuration,
      source: url,
      clip: true,
      animations: [panAnim]
    };
    if (i > 0) {
      imgEl.transition = {
        type: tpl.transition,
        duration: tpl.transitionDuration
      };
    }
    elements.push(imgEl);
  });

  // Calculate effective scene times
  const sceneTimes = [];
  let t = 0;
  for (let i = 0; i < imageUrls.length; i++) {
    sceneTimes.push(t);
    t += tpl.sceneDuration;
    if (i > 0) t -= tpl.transitionDuration;
  }

  // Hook text overlay
  if (script.hook) {
    elements.push({
      type: 'text',
      track: 2,
      time: 0,
      duration: tpl.sceneDuration,
      text: script.hook.toUpperCase(),
      y: '20%',
      width: '85%',
      height: '15%',
      x_alignment: '50%',
      y_alignment: '50%',
      font_family: tpl.font,
      font_weight: tpl.fontWeight,
      font_size_maximum: '9 vmin',
      fill_color: '#ffffff',
      shadow: { color: 'rgba(0,0,0,0.6)', blur: 5, x: 0, y: 2 },
      animations: [
        { type: 'text-slide', duration: 0.4, easing: 'quadratic-out', scope: 'element', direction: '0°' }
      ]
    });
  }

  // Scene text overlays
  const scenes = script.scenes || [];
  scenes.forEach((scene, i) => {
    if (!scene.on_screen_text) return;
    const sceneStart = sceneTimes[i] || 0;
    if (i === 0 && script.hook) return; // hook covers first scene

    elements.push({
      type: 'text',
      track: 2,
      time: sceneStart,
      duration: tpl.sceneDuration * 0.85,
      text: scene.on_screen_text,
      y: '72%',
      width: '85%',
      height: '12%',
      x_alignment: '50%',
      y_alignment: '50%',
      font_family: tpl.font,
      font_weight: tpl.fontWeight,
      font_size_maximum: '6.5 vmin',
      fill_color: '#ffffff',
      shadow: { color: 'rgba(0,0,0,0.6)', blur: 4, x: 0, y: 2 },
      animations: [
        { type: 'text-slide', duration: 0.3, easing: 'quadratic-out', scope: 'element', direction: '0°' }
      ]
    });
  });

  // CTA text overlay
  if (script.cta) {
    const ctaStart = sceneTimes[sceneTimes.length - 1] || 0;
    elements.push({
      type: 'text',
      track: 3,
      time: ctaStart + tpl.sceneDuration * 0.15,
      duration: tpl.sceneDuration * 0.85,
      text: script.cta,
      y: '80%',
      width: '70%',
      height: '8%',
      x_alignment: '50%',
      y_alignment: '50%',
      font_family: tpl.font,
      font_weight: tpl.fontWeight,
      font_size_maximum: '5.5 vmin',
      fill_color: '#ffffff',
      background_color: tpl.ctaBg,
      background_x_padding: '15%',
      background_y_padding: '30%',
      background_border_radius: '8%',
      animations: [
        { type: 'scale', start_scale: '80%', duration: 0.3, easing: 'quadratic-out', fade: true }
      ]
    });
  }

  return {
    output_format: 'mp4',
    frame_rate: 30,
    width: 1080,
    height: 1920,
    elements
  };
}

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

    const searchTool =
      tools.find(t => t.name === 'search_tours') ||
      tools.find(t => t.name.toLowerCase().includes('search')) ||
      tools.find(t => t.name.toLowerCase().includes('tour')) ||
      tools[0];

    if (!searchTool) {
      await client.close();
      return res.status(404).json({ error: 'No search tool found', tools: tools.map(t => t.name) });
    }

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

// Generate social media video text overlays via Claude API
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
      system: `You are a social media video text copywriter for travel tours. You write VERY SHORT, punchy on-screen text overlays for portrait (9:16) slideshow videos.

Persona: ${p.name} (Age ${p.age})
Tone: ${p.tone}
Style: ${p.style}

You will receive info about a tour and 5 images. Generate text overlays that will appear on screen during the video. The video is a slideshow with Ken Burns zoom/pan effects, transitions, and text overlays.

CRITICAL RULES:
- ALL text must be extremely short: 2-4 words MAXIMUM per overlay
- Text must match the persona's voice precisely
- Hook grabs attention instantly in the persona's style
- Scene overlays are punchy, evocative, persona-appropriate
- CTA drives action in the persona's language
- No hashtags, no emojis in the text

Examples by persona:
- Sara (Connected Wanderer): Hook "Discover La Dolce Vita" | Scene "Pure Italian Charm" | CTA "Plan Your Escape"
- Michael & Susan (Leisure Lovers): Hook "Your Italian Dream" | Scene "Timeless Elegance" | CTA "Start Your Journey"
- Ava (Experience Explorer): Hook "Italy Awaits You" | Scene "Total Vibe Check" | CTA "Book It Now"
- Peter & Anne (Cultural Adventurers): Hook "Explore Ancient Italy" | Scene "Rich Heritage Awaits" | CTA "Explore & Discover"

Respond ONLY with valid JSON (no markdown fences):
{
  "hook": "2-4 word hook text",
  "scenes": [
    { "image_index": 0, "on_screen_text": "2-4 word overlay" },
    { "image_index": 1, "on_screen_text": "2-4 word overlay" },
    { "image_index": 2, "on_screen_text": "2-4 word overlay" },
    { "image_index": 3, "on_screen_text": "2-4 word overlay" },
    { "image_index": 4, "on_screen_text": "2-4 word overlay" }
  ],
  "cta": "2-4 word call-to-action"
}`,
      messages: [{
        role: 'user',
        content: `Tour: ${tourName}
Description: ${tourDescription || 'A guided group tour'}
Destinations: ${(destinations || []).join(', ') || 'Various'}

Images (in sequence order):
${imageDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Generate very short (2-4 words each) on-screen text overlays for this tour video, written in the voice of ${p.name}.`
      }]
    });

    let text = message.content[0].text;
    text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const script = JSON.parse(text);
    res.json({ script });
  } catch (err) {
    console.error('Script generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate script: ' + err.message });
  }
});

// Create video via Creatomate API
app.post('/api/create-video', async (req, res) => {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'CREATOMATE_API_KEY not configured. Add it to .env and restart.' });

  const { image_urls, script, persona } = req.body;
  if (!image_urls?.length || !script) {
    return res.status(400).json({ error: 'Missing required fields: image_urls, script' });
  }

  try {
    const source = buildCreatomateSource(image_urls, script, persona);

    const resp = await fetch('https://api.creatomate.com/v2/renders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(source)
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.message || data?.error || JSON.stringify(data);
      return res.status(500).json({ error: `Creatomate API error: ${msg}` });
    }

    const render = Array.isArray(data) ? data[0] : data;
    if (!render?.id) {
      return res.status(500).json({ error: 'No render ID returned from Creatomate' });
    }

    res.json({ render_id: render.id });
  } catch (err) {
    console.error('Video creation error:', err.message);
    res.status(500).json({ error: 'Failed to create video: ' + err.message });
  }
});

// Poll Creatomate render status
app.get('/api/video-status', async (req, res) => {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'CREATOMATE_API_KEY not configured' });

  const renderId = req.query.id;
  if (!renderId) return res.status(400).json({ error: 'Missing render ID (id query param)' });

  try {
    const resp = await fetch(`https://api.creatomate.com/v2/renders/${renderId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
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
    res.json({ status: 'failed', error: err.message });
  }
});

// ── Server start ───────────────────────────────────────────────────

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`TourRadar app running → http://localhost:${PORT}`);
  console.log(`  Video Creator → http://localhost:${PORT}/create.html`);
  if (!anthropic) console.warn('  ⚠ ANTHROPIC_API_KEY not set — script generation disabled');
  if (!process.env.CREATOMATE_API_KEY) console.warn('  ⚠ CREATOMATE_API_KEY not set — video creation disabled');
});
