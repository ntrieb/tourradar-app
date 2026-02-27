// TourRadar branding for CTA ending

// Persona-specific Creatomate video templates
// Target ~15 seconds total: 5 scenes × 2.6s + 2s CTA ending = ~15s
const PERSONA_TEMPLATES = {
  sara_connected_wanderer: {
    font: 'Montserrat', fontWeight: 700,
    accentColor: '#E8A87C', ctaBg: 'rgba(232,168,124,0.9)',
    transition: 'fade', transitionDuration: 0.5,
    sceneDuration: 2.6,
    ctaDuration: 2.5,
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
    accentColor: '#C9B037', ctaBg: 'rgba(201,176,55,0.9)',
    transition: 'fade', transitionDuration: 0.6,
    sceneDuration: 2.8,
    ctaDuration: 2.8,
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
    accentColor: '#FF6B6B', ctaBg: 'rgba(255,107,107,0.9)',
    transition: 'slide', transitionDuration: 0.4,
    sceneDuration: 2.4,
    ctaDuration: 2.2,
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
    accentColor: '#2D6A4F', ctaBg: 'rgba(45,106,79,0.9)',
    transition: 'fade', transitionDuration: 0.5,
    sceneDuration: 2.6,
    ctaDuration: 2.5,
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

  // ── Track 1: Image scenes ──────────────────────────────────────
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

  // Calculate scene start times (accounting for transition overlaps)
  const sceneTimes = [];
  let t = 0;
  for (let i = 0; i < imageUrls.length; i++) {
    sceneTimes.push(t);
    t += tpl.sceneDuration;
    if (i > 0) t -= tpl.transitionDuration;
  }
  const scenesEnd = t;

  // ── CTA ending scene (dark overlay on last image with logo) ────
  // Add a solid color composition at the end for the branded CTA
  elements.push({
    type: 'composition',
    track: 1,
    duration: tpl.ctaDuration,
    transition: { type: 'fade', duration: 0.6 },
    elements: [
      // Dark navy background
      {
        type: 'shape',
        shape: 'rectangle',
        width: '100%',
        height: '100%',
        fill_color: '#0D2847'
      }
    ]
  });
  const ctaSceneStart = scenesEnd - 0.6; // overlap with fade transition

  // ── Track 2: Text overlays for each scene ──────────────────────

  // Hook text (shown on scene 1)
  if (script.hook) {
    elements.push({
      type: 'text',
      track: 2,
      time: 0,
      duration: tpl.sceneDuration * 0.9,
      text: script.hook.toUpperCase(),
      y: '35%',
      width: '88%',
      x_alignment: '50%',
      y_alignment: '50%',
      font_family: tpl.font,
      font_weight: tpl.fontWeight,
      font_size_maximum: '10 vmin',
      fill_color: '#ffffff',
      background_color: 'rgba(0,0,0,0.55)',
      background_x_padding: '20%',
      background_y_padding: '30%',
      background_border_radius: '8%',
      animations: [
        { type: 'text-slide', duration: 0.5, easing: 'quadratic-out', scope: 'element', direction: '0°' }
      ]
    });
  }

  // Scene text overlays (one per image scene)
  const scenes = script.scenes || [];
  scenes.forEach((scene, i) => {
    if (!scene.on_screen_text) return;
    // First scene already has the hook — also show its scene text below hook
    const sceneStart = sceneTimes[i] || 0;

    elements.push({
      type: 'text',
      track: 2,
      time: sceneStart + 0.2, // slight delay for visual clarity
      duration: tpl.sceneDuration * 0.8,
      text: scene.on_screen_text,
      y: (i === 0 && script.hook) ? '55%' : '70%',
      width: '85%',
      x_alignment: '50%',
      y_alignment: '50%',
      font_family: tpl.font,
      font_weight: tpl.fontWeight,
      font_size_maximum: (i === 0 && script.hook) ? '6 vmin' : '7 vmin',
      fill_color: '#ffffff',
      background_color: 'rgba(0,0,0,0.5)',
      background_x_padding: '18%',
      background_y_padding: '25%',
      background_border_radius: '8%',
      animations: [
        { type: 'text-slide', duration: 0.35, easing: 'quadratic-out', scope: 'element', direction: '0°' }
      ]
    });
  });

  // ── Track 2: CTA ending text overlays ──────────────────────────
  // TourRadar brand name
  elements.push({
    type: 'text',
    track: 2,
    time: ctaSceneStart + 0.3,
    duration: tpl.ctaDuration - 0.3,
    text: 'TourRadar',
    x: '50%',
    y: '35%',
    width: '80%',
    x_alignment: '50%',
    y_alignment: '50%',
    font_family: 'Montserrat',
    font_weight: 700,
    font_size_maximum: '14 vmin',
    fill_color: '#ffffff',
    animations: [
      { type: 'scale', start_scale: '80%', duration: 0.5, easing: 'quadratic-out', fade: true }
    ]
  });

  // CTA text
  if (script.cta) {
    elements.push({
      type: 'text',
      track: 3,
      time: ctaSceneStart + 0.5,
      duration: tpl.ctaDuration - 0.5,
      text: script.cta,
      y: '60%',
      width: '75%',
      x_alignment: '50%',
      y_alignment: '50%',
      font_family: tpl.font,
      font_weight: tpl.fontWeight,
      font_size_maximum: '7 vmin',
      fill_color: '#ffffff',
      background_color: tpl.ctaBg,
      background_x_padding: '18%',
      background_y_padding: '35%',
      background_border_radius: '50%',
      animations: [
        { type: 'scale', start_scale: '85%', duration: 0.4, easing: 'quadratic-out', fade: true }
      ]
    });

    // "tourradar.com" below CTA
    elements.push({
      type: 'text',
      track: 4,
      time: ctaSceneStart + 0.8,
      duration: tpl.ctaDuration - 0.8,
      text: 'tourradar.com',
      y: '75%',
      width: '60%',
      x_alignment: '50%',
      y_alignment: '50%',
      font_family: tpl.font,
      font_weight: 400,
      font_size_maximum: '4 vmin',
      fill_color: 'rgba(255,255,255,0.7)',
      animations: [
        { type: 'fade', duration: 0.5, easing: 'quadratic-out' }
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'CREATOMATE_API_KEY not configured' });

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
    res.status(500).json({ error: 'Failed to create video: ' + err.message });
  }
}
