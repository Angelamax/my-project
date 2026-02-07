import axios from 'axios';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Content-Type', 'application/json');

  const url = req.query.url || req.query.link;

  // 1. Validasi Input Dasar
  if (!url) {
    return res.status(400).json({
      success: false,
      author: author,
      message: "Parameter 'url' kosong.",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
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
          { headers: { ...this.headers, cookie } }
        );
        return res.data;
      }
    }

    const downr = new DownrScraper();
    const data = await downr.fetch(url);
    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    return res.status(200).json({
      success: true,
      author: author,
      result: data, // Menampilkan raw data sukses juga
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    // [DEBUG MODE] - Menampilkan respons asli dari server jika terjadi error
    const upstreamResponse = error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data, // Ini pesan error asli dari downr.org
        headers: error.response.headers
    } : null;

    return res.status(error.response?.status || 500).json({
      success: false,
      author: author,
      message: "Terjadi kesalahan pada request ke server Downr.",
      debug: {
        original_error: error.message,
        upstream_response: upstreamResponse // Kita print semua di sini
      },
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
