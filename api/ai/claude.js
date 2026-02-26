import axios from 'axios';

export async function onRequest(context) {
  const { request, env } = context;
  const startTime = Date.now();
  const author = env.AUTHOR || "AngelaImut";

  const headersResponse = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: headersResponse });

  const urlParams = new URL(request.url);
  const q = urlParams.searchParams.get('q') || urlParams.searchParams.get('text');

  if (!q) {
    return new Response(JSON.stringify({ 
      status: false, 
      author, 
      message: "Input q diperlukan!" 
    }), { status: 400, headers: headersResponse });
  }

  try {
    // --- PONDASI: Request ke Overchat.ai ---
    const response = await axios.post(
      'https://api.overchat.ai/v1/chat/completions',
      {
        chatId: "6c35194a-a004-4efe-980a-df317eb105b7",
        model: "claude-haiku-4-5-20251001",
        messages: [
          {
            id: "fcebb6f5-2d7c-42c0-a177-ced59262c453",
            role: "user",
            content: q
          },
          {
            id: "4aad5888-14ec-4dbb-9d1f-ac8b243565e3",
            role: "system",
            content: ""
          }
        ],
        personaId: "claude-haiku-4-5-landing",
        frequency_penalty: 0,
        max_tokens: 4000,
        presence_penalty: 0,
        stream: true,
        temperature: 0.5,
        top_p: 0.95
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'X-Device-Platform': 'web',
          'X-Device-Language': 'id-ID',
          'X-Device-Uuid': '0084ff72-2faf-4338-ac78-f0e59fad3108',
          'X-Device-Version': '1.0.44',
          'Origin': 'https://overchat.ai',
          'Referer': 'https://overchat.ai/'
        },
        responseType: 'text' // Penting agar bisa diproses sebagai string
      }
    );

    // --- PONDASI: Parser Stream Manual ---
    let finalAnswer = '';
    const lines = response.data.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        try {
          const jsonStr = line.replace('data: ', '');
          const data = JSON.parse(jsonStr);
          if (data.choices?.[0]?.delta?.content) {
            finalAnswer += data.choices[0].delta.content;
          }
        } catch (e) {
          // Abaikan baris yang bukan JSON valid
        }
      }
    }

    // --- OUTPUT FINAL (FLAT JSON) ---
    return new Response(JSON.stringify({
      status: true,
      author: author,
      result: finalAnswer.trim() || "Tidak ada respon dari AI.",
      model: "Claude 4.5 Haiku",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    }), { status: 200, headers: headersResponse });

  } catch (err) {
    return new Response(JSON.stringify({
      status: false,
      author,
      error: err.message
    }), { status: 500, headers: headersResponse });
  }
}
