// Persona-specific Creatomate video templates
const PERSONA_TEMPLATES = {
  sara_connected_wanderer: {
    font: 'Montserrat', fontWeight: 700,
    accentColor: '#E8A87C', ctaBg: 'rgba(232,168,124,0.85)',
    transition: 'fade', transitionDuration: 0.5,
    sceneDuration: 2.0,
    // Ken Burns: gentle zoom-in, pan-left+zoom, pan-right+zoom, zoom-out, pan-left+zoom
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
    // Ken Burns: slow, elegant panning
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
    // Ken Burns: energetic, fast zooms
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
    // Ken Burns: classic, balanced
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
  let currentTime = 0;

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

    // Add transition for images after the first
    if (i > 0) {
      imgEl.transition = {
        type: tpl.transition,
        duration: tpl.transitionDuration
      };
    }

    elements.push(imgEl);
  });

  // Calculate effective scene times (accounting for transition overlaps)
  const sceneTimes = [];
  let t = 0;
  for (let i = 0; i < imageUrls.length; i++) {
    sceneTimes.push(t);
    t += tpl.sceneDuration;
    if (i > 0) t -= tpl.transitionDuration; // transitions overlap
  }
  const totalDuration = t;

  // Hook text overlay (shown during first scene)
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
      shadow: {
        color: 'rgba(0,0,0,0.6)',
        blur: 5,
        x: 0,
        y: 2
      },
      animations: [
        {
          type: 'text-slide',
          duration: 0.4,
          easing: 'quadratic-out',
          scope: 'element',
          direction: '0°'
        }
      ]
    });
  }

  // Scene text overlays (shown during each scene)
  const scenes = script.scenes || [];
  scenes.forEach((scene, i) => {
    if (!scene.on_screen_text) return;

    const sceneStart = sceneTimes[i] || 0;
    // Skip overlay for first scene (hook covers it)
    if (i === 0 && script.hook) return;

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
      shadow: {
        color: 'rgba(0,0,0,0.6)',
        blur: 4,
        x: 0,
        y: 2
      },
      animations: [
        {
          type: 'text-slide',
          duration: 0.3,
          easing: 'quadratic-out',
          scope: 'element',
          direction: '0°'
        }
      ]
    });
  });

  // CTA text overlay (shown during last scene)
  if (script.cta) {
    const ctaStart = sceneTimes[sceneTimes.length - 1] || (totalDuration - tpl.sceneDuration);
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
        {
          type: 'scale',
          start_scale: '80%',
          duration: 0.3,
          easing: 'quadratic-out',
          fade: true
        }
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

    // Creatomate returns an array of renders
    const render = Array.isArray(data) ? data[0] : data;
    if (!render?.id) {
      return res.status(500).json({ error: 'No render ID returned from Creatomate' });
    }

    res.json({ render_id: render.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create video: ' + err.message });
  }
}
