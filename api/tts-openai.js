import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const text = req.query.text || req.query.q;
  const voice = req.query.voice || 'coral';

  if (!text) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({
      success: false,
      author: author,
      message: "Masukkan parameter 'text'!",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }

  try {
    // =====================================================================
    // [ZONA UTUH] - LOGIKA SCRAPER OPENAI TTS
    // =====================================================================
    const conf = {
      voice: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'],
      prompt: {
        affect: 'A cheerful guide',
        tone: 'Friendly, clear, and reassuring, creating a calm atmosphere and making the listener feel confident and comfortable.',
        pronunciation: 'Clear, articulate, and steady, ensuring each instruction is easily understood while maintaining a natural, conversational flow.',
        pause: 'Brief, purposeful pauses after key instructions (e.g., "cross the street" and "turn right") to allow time for the listener to process the information and follow along.',
        emotion: 'Warm and supportive, conveying empathy and care, ensuring the listener feels guided and safe throughout the journey.'
      }
    };

    if (!conf.voice.includes(voice.toLowerCase())) {
      throw new Error(`Voice tidak tersedia.`);
    }

    const form = new FormData();
    form.append('input', text);
    form.append('prompt', Object.entries(conf.prompt).map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`).join('\n\n'));
    form.append('voice', voice.toLowerCase());
    form.append('vibe', 'Friendly');

    const response = await axios.post('https://www.openai.fm/api/generate', form, {
      headers: {
        ...form.getHeaders(),
        // PENAMBAHAN USER-AGENT UNTUK MENGATASI ERROR 422
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'origin': 'https://www.openai.fm',
        'referer': 'https://www.openai.fm/'
      },
      responseType: 'arraybuffer',
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const results = Buffer.from(response.data);
    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="tts.mp3"');
    return res.send(results);

  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      success: false,
      author: author,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
