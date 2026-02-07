import axios from 'axios';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Content-Type', 'application/json');

  let url = req.query.url || req.query.link;

  if (!url) {
    return res.status(400).json({
      success: false,
      author: author,
      message: "Parameter 'url' kosong.",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }

  // [AUTO-FIX] URL YouTube
  if (url.includes('youtube.com/live/')) {
    url = url.replace('/live/', '/watch?v=');
  } else if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    if (id) url = `https://www.youtube.com/watch?v=${id}`;
  }

  try {
    // =====================================================================
    // [ZONA UTUH] - LOGIKA SCRAPER DOWNR
    // =====================================================================
    class DownrScraper {
      constructor() {
        this.baseURL = 'https://downr.org';
        this.headers = {
          'accept': '*/*',
          'content-type': 'application/json',
          'origin': 'https://downr.org',
          'referer': 'https://downr.org/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'
        };
      }

      async getSessionCookie() {
        const baseCookie = '_ga=GA1.1.536005378.1770437315; _clck=17lj13q%5E2%5Eg3d';
        try {
            const res = await axios.get(`${this.baseURL}/.netlify/functions/analytics`, { 
                headers: { ...this.headers, cookie: baseCookie } 
            });
            const sess = res.headers['set-cookie']?.[0]?.split(';')[0];
            return sess ? `${baseCookie}; ${sess}` : baseCookie;
        } catch (e) {
            return baseCookie;
        }
      }

      async fetch(targetUrl) {
        const cookie = await this.getSessionCookie();
        const res = await axios.post(
          `${this.baseURL}/.netlify/functions/nyt`,
          { url: targetUrl },
          { headers: { ...this.headers, cookie } }
        );
        return res.data;
      }
    }

    const downr = new DownrScraper();
    const data = await downr.fetch(url);

    if (!data?.medias?.length) {
      throw new Error(data.error || "Media tidak ditemukan.");
    }
    
    // [LOGIKA FILTER] - Merapikan Data
    const medias = data.medias;
    const images = medias.filter(m => m.type === 'image');
    const videos = medias.filter(m => m.type === 'video');
    const audios = medias.filter(m => m.type === 'audio');
    
    // Cari video terbaik (No Watermark / HD) untuk shortcut
    let bestVideo = null;
    if (videos.length > 0) {
      bestVideo = videos.find(v => v.quality === 'no_watermark') ||
                  videos.find(v => v.quality === 'hd_no_watermark') ||
                  videos.find(v => v.quality === '1080p') ||
                  videos[0];
    }

    // Susun Object agar Rapi (Sesuai Request)
    const finalResult = {
        title: data.title || "No Title",
        thumbnail: data.thumbnail || null,
        duration: data.duration || 0,
        source: data.source || "unknown",
        media_grouped: {
          images: images.map(img => img.url), // Gambar ambil URL-nya saja biar ringkas
          videos: videos, // Video biarkan full object agar ada info size/resolusi
          audios: audios, // Audio biarkan full object
          best_video: bestVideo ? bestVideo.url : null
        }
    };

    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // Output JSON dengan key "result" (Seragam dengan API lain)
    return res.status(200).json({
      success: true,
      author: author,
      result: finalResult, 
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      author: author,
      error: error.message || "Terjadi kesalahan internal.",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
