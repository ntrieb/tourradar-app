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
