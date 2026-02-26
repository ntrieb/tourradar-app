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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { tourName, tourDescription, destinations, persona, imageDescriptions } = req.body;
  if (!tourName || !persona || !imageDescriptions?.length) {
    return res.status(400).json({ error: 'Missing required fields: tourName, persona, imageDescriptions' });
  }

  const p = PERSONAS[persona];
  if (!p) return res.status(400).json({ error: `Unknown persona: ${persona}` });

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
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
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return res.status(500).json({ error: `Claude API error: ${msg}` });
    }

    let text = data.content[0].text;
    text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const script = JSON.parse(text);
    res.json({ script });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate script: ' + err.message });
  }
}
