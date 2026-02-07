import axios from 'axios';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  // 1. Header Standar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const text = req.query.text || req.query.q;

  if (!text) {
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
    // [ZONA UTUH] - LOGIKA SCRAPER LUMINAI
    // =====================================================================
    
    // Kita panggil API aslinya dari Koyeb
    const response = await axios.get(`https://zelapioffciall.koyeb.app/ai/luminai?text=${encodeURIComponent(text)}`);
    
    // Kita ambil bagian result-nya saja
    const results = response.data.result || response.data;

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
    return res.status(500).json({
      success: false,
      author: author,
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
