// Tidak perlu import fetch karena Node.js 18+ (Vercel) sudah support native fetch

export default async function handler(req, res) {
  const start = Date.now();
  const author = "AngelaImut";

  // 1. Konfigurasi Header Standar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Handle Preflight Request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Pengambilan Parameter
  // Di Vercel/Node, kita pakai req.query, bukan new URL(request.url)
  const query = req.query.q || req.query.text;
  const modelInput = req.query.model;
  const isSearch = req.query.search === 'true';

  try {
    // =====================================================================
    // [ZONA UTUH] - LOGIKA VALIDASI & REQUEST LLMPROXY
    // =====================================================================
    
    // --- DAFTAR MODEL YANG DIDUKUNG (STRICT VALIDATION) ---
    const supportedModels = [
      "v3", 
      "r1", 
      "deepseek-chat", 
      "deepseek-reasoner",
      "deepseek-v3.2", 
      "deepseek/deepseek-r1", 
      "deepseek/deepseek-v3"
    ];

    // Validasi 1: Cek pertanyaan
    if (!query) {
       // Kita lempar error agar ditangkap catch di bawah untuk format standar
       throw new Error("Masukkan pertanyaan! Contoh: ?q=halo&model=v3");
    }

    // Validasi 2: Cek Model
    if (modelInput && !supportedModels.includes(modelInput)) {
      throw new Error(`Model '${modelInput}' tidak ditemukan. Model tersedia: ${supportedModels.join(', ')}`);
    }

    const targetModel = modelInput || "v3";

    // --- REQUEST KE LLMPROXY ---
    // Menggunakan fetch native agar kompatibel dengan logika stream reader kamu
    const response = await fetch('https://llmproxy.org/api/chat.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: query }],
        model: targetModel,
        cost: 1,
        stream: true,
        web_search: isSearch
      })
    });

    if (!response.ok) {
      throw new Error(`LLMProxy Server Error: ${response.status}`);
    }

    // --- LOGIKA PARSING STREAM (NDJSON) ---
    // Bagian ini SANGAT KRUSIAL untuk menyatukan potongan pesan
    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const dataRaw = trimmedLine.replace('data: ', '').trim();
        if (dataRaw === '[DONE]') continue;

        try {
          const json = JSON.parse(dataRaw);
          
          if (json.error) {
            throw new Error(json.error.message || "Kesalahan pada server model.");
          }

          const content = json.choices?.[0]?.delta?.content || '';
          fullText += content;
        } catch (e) {
          if (dataRaw.includes('"error"')) {
             throw new Error("Server mengirimkan data error: " + dataRaw);
          }
        }
      }
    }

    if (!fullText && !start) throw new Error("Tidak ada respon dari model.");

    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // 3. Format Response Sukses
    return res.status(200).json({
      success: true,
      author: author,
      result: fullText.trim(),
      model_used: targetModel,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - start}ms`
    });

  } catch (error) {
    // 4. Format Response Error
    return res.status(500).json({
      success: false,
      author: author,
      error: error.message,
      // Menampilkan list model jika error disebabkan oleh salah model
      supported_models: error.message.includes("Model tersedia") ? [
        "v3", "r1", "deepseek-chat", "deepseek-reasoner",
        "deepseek-v3.2", "deepseek/deepseek-r1", "deepseek/deepseek-v3"
      ] : undefined,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - start}ms`
    });
  }
}
