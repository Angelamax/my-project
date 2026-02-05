import axios from 'axios'; // Tetap di-import sesuai template

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  // 1. Konfigurasi Header Standar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  // 2. Menangkap Input (text dan imageUrl)
  const text = req.query.text || "";
  const imageUrl = req.query.imageUrl || "";

  if (!text) {
    return res.status(400).json({
      success: false,
      author: author,
      message: "Parameter 'text' tidak boleh kosong!",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }

  try {
    // =====================================================================
    // [ZONA UTUH] - LOGIKA SCRAPER COPILOT
    // =====================================================================
    
    const apiUrl = `https://takamura.site/api/copilot/ask?text=${encodeURIComponent(text)}&imageUrl=${encodeURIComponent(imageUrl)}`;
    
    // Menggunakan fetch karena mendukung streaming reader secara native
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Gagal membaca response body dari API.');

    const decoder = new TextDecoder();
    let rawResult = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawResult += decoder.decode(value, { stream: true });
    }
    rawResult += decoder.decode();

    // Parsing hasil akhir
    const jsonResponse = JSON.parse(rawResult);
    const results = jsonResponse.answer || jsonResponse;

    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // 3. Format Response Sukses Standar AngelaImut
    return res.status(200).json({
      success: true,
      author: author,
      result: results,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    // 4. Format Response Error Standar AngelaImut
    return res.status(500).json({
      success: false,
      author: author,
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
