import axios from 'axios';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  // 1. Header Standar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
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
    // [ZONA UTUH] - LOGIKA SIMI PRO (Class & Config)
    // =====================================================================
    
    class SimiPro {
        constructor() {
            this.config = {
                uid: 509694418,
                refreshToken: 'AMf-vBw4rugf0IxtWUiV2EjHGsblvtOpXVGyfGSwBhPUeIUcQWNGatozwrzcTOOVs2pJ-GfaQdNNPjj3L9d6TfUjx6gWWn4wIDuDosrAbT4B_i_Yoqe1hHkgqkpZwxwzqM61tc6u2K41L4UjxAPx2gY6TAhBjOSAIrY-dwY07aYxB78CZcgrXZJ3GEsX99AWUl-9DnFwxaKzZbqzcetLNaehNASnNlPKhztdjwoQtcVSPH4WOxNbIAEHMigg6C8MAy9rJiZ0vjACaaT2s3S-Z6FdnwVk7MAvR8nmRJNei5FCmdyaQqHeSUOI0ccHHGO7kSw2lF5BpqBKVRAAG6cfKsV5ZBDdFsbCAGGCteil3_ZXVR2BVG9RyRMJHp4mx9OhxX8q0x4IQZF6tjLrgxW8Pna-qEcU1wxGqAK9bzIG2ro9vdO4hCpNBZv5zpC5seKymSVZwU4Ce_y5',
                apiKey: 'AIzaSyBa0FW_3yQoMbSLc_9Zq03mXrUXxycPU3E',
                signature: 'db3013ce4c1b19da00661b14dcc3354eaea394bc244ee4c4aafac09c0df7b283',
                accessToken: null
            };
        }

        async refreshAuth() {
            try {
                const url = `https://securetoken.googleapis.com/v1/token?key=${this.config.apiKey}`;
                const res = await axios.post(url, {
                    grant_type: 'refresh_token',
                    refresh_token: this.config.refreshToken
                });
                this.config.accessToken = res.data.access_token;
                return res.data.access_token;
            } catch (err) { return null; }
        }

        async claimPoint() {
            if (!this.config.accessToken) await this.refreshAuth();
            const commonPayload = {
                uid: this.config.uid, av: "9.2.6", os: "a", lc: "id", cc: "KR", 
                tz: "Asia/Seoul", logUID: this.config.uid.toString(), reg_now_days: 0
            };
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.accessToken}`,
                'X-Signature': this.config.signature,
                'X-Client-Platform': 'web'
            };

            try {
                // Step 1: Trigger Cooldown
                await axios.post('https://kube-appserver.simsimi.com:30443/boost_chat/free_point_cooldown', commonPayload, { headers });
                // Step 2: Klaim Point
                const { data } = await axios.post('https://kube-appserver.simsimi.com:30443/boost_chat/claim_free_point', commonPayload, { headers });
                return data;
            } catch (e) { return null; }
        }

        async chat(msgText) {
            if (!this.config.accessToken) await this.refreshAuth();

            const payload = {
                av: "9.2.6", cc: "KR", lc: "id", logUID: this.config.uid.toString(),
                os: "a", reg_now_days: 0, tz: "Asia/Seoul", uid: this.config.uid,
                character_id: 9075, message: msgText, is_live_chat: false, cv: ""
            };

            try {
                const res = await axios.post('https://kube-appserver.simsimi.com:30443/ai_character/send_chat_message/stream', payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Signature': this.config.signature,
                        'Authorization': `Bearer ${this.config.accessToken}`,
                        'X-Client-Platform': 'web'
                    },
                    responseType: 'text' // Penting untuk parsing stream manual
                });

                // Deteksi Error 402 (Point Habis)
                if (res.data.includes('data:402')) {
                    await this.claimPoint(); // Auto Refill
                    return { 
                        status: false, 
                        is_refilled: true,
                        message: "Point habis, tapi sistem sudah otomatis me-refill. Silakan kirim pesan yang sama sekali lagi!" 
                    };
                }

                // Parsing Stream Data
                const match = res.data.split('\n').find(l => l.startsWith('data: {'));
                if (match) {
                    const json = JSON.parse(match.replace('data: ', ''));
                    return { status: true, result: json.content };
                }

                return { status: false, raw: res.data };

            } catch (err) {
                // Auto Retry jika token expired (401)
                if (err.response?.status === 401) {
                    await this.refreshAuth();
                    // Kita coba rekursif sekali saja, tapi hati-hati infinite loop di serverless
                    // Untuk keamanan di serverless, kita return error suruh user refresh
                    return { status: false, message: "Token Expired. Silakan refresh." };
                }
                return { status: false, message: err.message };
            }
        }
    }

    // Eksekusi
    const simi = new SimiPro();
    const response = await simi.chat(text);
    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // 2. Format Response Sukses/Gagal
    // Kita menyesuaikan status code berdasarkan hasil logic simi
    const statusCode = response.status ? 200 : (response.is_refilled ? 429 : 500);

    return res.status(statusCode).json({
      success: response.status,
      author: author,
      result: response.result || null,
      message: response.message || null, // Pesan error/refill muncul di sini
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
