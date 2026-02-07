import axios from 'axios';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  // 1. Konfigurasi Header Standar API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Content-Type', 'application/json');

  // Menangkap parameter 'url' (Link YouTube)
  const videoUrl = req.query.url || req.query.q;

  if (!videoUrl) {
    return res.status(400).json({
      success: false,
      author: author,
      message: "Masukkan parameter 'url' YouTube! Contoh: ?url=https://www.youtube.com/watch?v=...",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }

  try {
    // =====================================================================
    // [ZONA UTUH] - LOGIKA SCRAPER KOME.AI
    // =====================================================================
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      'Sec-Ch-Ua-Mobile': '?1',
      'Sec-Ch-Ua-Platform': '"Android"'
    };

    const { data } = await axios.post('https://kome.ai/api/transcript', {
      format: true,
      video_id: videoUrl
    }, { headers });

    const results = data?.transcript || data;
    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // 2. Format Response Sukses
    return res.status(200).json({
      success: true,
      author: author,
      result: results,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    // 3. Format Response Error
    return res.status(500).json({
      success: false,
      author: author,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
