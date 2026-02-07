import axios from 'axios';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  // 1. Konfigurasi Header Standar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Content-Type', 'application/json');

  // Menangkap parameter url
  const url = req.query.url || req.query.link;

  if (!url) {
    return res.status(400).json({
      success: false,
      author: author,
      message: "Masukkan parameter 'url'! Contoh: ?url=https://www.tiktok.com/@user/video/...",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }

  try {
    // =====================================================================
    // [ZONA UTUH] - LOGIKA SCRAPER DOWNR (Class DownrScraper)
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

        const res = await axios.get(
          `${this.baseURL}/.netlify/functions/analytics`,
          { headers: { ...this.headers, cookie: baseCookie } }
        );

        const sess = res.headers['set-cookie']?.[0]?.split(';')[0];
        return sess ? `${baseCookie}; ${sess}` : baseCookie;
      }

      async fetch(targetUrl) {
        const cookie = await this.getSessionCookie();

        const res = await axios.post(
          `${this.baseURL}/.netlify/functions/nyt`,
          { url: targetUrl },
          {
            headers: {
              ...this.headers,
              cookie
            }
          }
        );

        return res.data;
      }
    }

    // Eksekusi Scraper
    const downr = new DownrScraper();
    const data = await downr.fetch(url);

    if (!data?.medias?.length) {
      throw new Error("Media tidak ditemukan atau URL tidak didukung.");
    }

    // =====================================================================
    // [LOGIKA FILTER] - Mengadaptasi logic bot WA ke format JSON API
    // =====================================================================
    
    const medias = data.medias;
    const images = medias.filter(m => m.type === 'image');
    const videos = medias.filter(m => m.type === 'video');
    const audios = medias.filter(m => m.type === 'audio');

    // Khusus TikTok/Video: Cari yang No Watermark
    let bestVideo = null;
    if (videos.length > 0) {
      bestVideo = videos.find(v => v.quality === 'no_watermark') ||
                  videos.find(v => v.quality === 'hd_no_watermark') ||
                  videos[0];
    }

    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // 2. Format Response Sukses
    return res.status(200).json({
      success: true,
      author: author,
      data: {
        title: data.title || "No Title",
        thumbnail: data.thumbnail || null,
        duration: data.duration || null,
        source: data.source || "Unknown",
        // Mengelompokkan hasil agar mudah dipakai di frontend/bot
        media_grouped: {
          images: images.map(img => img.url),
          videos: videos,
          audios: audios,
          best_video: bestVideo ? bestVideo.url : null // URL video terbaik (No WM)
        }
      },
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    // 3. Format Response Error
    return res.status(500).json({
      success: false,
      author: author,
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
