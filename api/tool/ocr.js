// --- LOGIKA UTAMA PUNYA ANGELA (TIDAK DIUBAH) ---
// Bagian mesin OCR diekstrak utuh dari kodingan bot WhatsApp aslimu
async function ocrEngine(imageBase64, mimeType) {
  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: "helloworld"
    },
    body: new URLSearchParams({
      base64Image: `data:${mimeType};base64,${imageBase64}`,
      language: "eng",
    })
  });

  if (!res.ok) throw new Error(await res.text());

  const json = await res.json();

  const jarr =
    json?.ParsedResults?.[0]?.ParsedText?.trim() ||
    "Teks tidak ditemukan.";

  return jarr;
}

// --- TEMPLATE PEMBUNGKUS ---
export default async function(req) {
  const startTime = Date.now();
  const url = new URL(req.url);
  
  // Meminta user mengirimkan parameter 'url' yang berisi link gambar
  const targetUrl = url.searchParams.get("url") || url.searchParams.get("q");

  if (!targetUrl) {
    return Response.json({ 
      success: false, 
      author: "AngelaImut",
      message: "Kirimkan parameter 'url' berisi link gambar untuk diekstrak teksnya." 
    }, { status: 400 });
  }

  try {
    // 1. Mengganti q.download() milik bot WA dengan fetch standar untuk Web API
    const imageReq = await fetch(targetUrl);
    if (!imageReq.ok) throw new Error("Gagal mengunduh gambar dari URL yang diberikan.");
    
    const arrayBuffer = await imageReq.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 2. Mendeteksi tipe gambar
    const contentType = imageReq.headers.get("content-type") || "";
    const mimeType = /png/.test(contentType) ? "image/png" : "image/jpeg";
    const imageBase64 = buffer.toString("base64");

    // 3. Menjalankan mesin scraper OCR tanpa mengubah logikanya
    const resultText = await ocrEngine(imageBase64, mimeType);

    const responseTime = `${Date.now() - startTime}ms`;
    return Response.json({
      success: true,
      author: "AngelaImut",
      result: {
        text: resultText
      },
      timestamp: new Date().toISOString(),
      responseTime: responseTime
    });

  } catch (err) {
    return Response.json({
      success: false,
      author: "AngelaImut",
      error: err.message,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    }, { status: 500 });
  }
}
