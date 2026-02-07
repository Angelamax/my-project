import axios from 'axios';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const text = req.query.text || "halo";

  // Debug Log Container
  let debugLog = {
    token_status: "unknown",
    chat_response_raw: null,
    claim_point_attempt: "not_triggered",
    claim_point_response: null
  };

  try {
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
                debugLog.token_status = "refreshed_success";
                return res.data.access_token;
            } catch (err) { 
                debugLog.token_status = `refreshed_failed: ${err.message}`;
                return null; 
            }
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
                debugLog.claim_point_attempt = "triggered";
                // Step 1: Cooldown
                await axios.post('https://kube-appserver.simsimi.com:30443/boost_chat/free_point_cooldown', commonPayload, { headers });
                
                // Step 2: Claim
                const { data } = await axios.post('https://kube-appserver.simsimi.com:30443/boost_chat/claim_free_point', commonPayload, { headers });
                
                debugLog.claim_point_response = data; // Ini yang mau kita lihat
                return data;
            } catch (e) { 
                debugLog.claim_point_response = { error: e.message, status: e.response?.status, data: e.response?.data };
                return null; 
            }
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
                    responseType: 'text' 
                });

                debugLog.chat_response_raw = res.data; // Simpan respon asli

                // Deteksi Error 402 (Point Habis)
                if (res.data.includes('data:402')) {
                    await this.claimPoint(); // Coba refill
                    // Kita tidak return pesan cantik, tapi return data mentah biar ketahuan
                    return { status: false, raw: res.data, type: "NEEDS_REFILL" };
                }

                const match = res.data.split('\n').find(l => l.startsWith('data: {'));
                if (match) {
                    const json = JSON.parse(match.replace('data: ', ''));
                    return { status: true, result: json.content };
                }
                return { status: false, raw: res.data, type: "UNKNOWN_FORMAT" };

            } catch (err) {
                return { status: false, error: err.message, stack: err.response?.data };
            }
        }
    }

    const simi = new SimiPro();
    const result = await simi.chat(text);

    return res.status(200).json({
      success: result.status,
      author: author,
      data: result,
      debug_trace: debugLog, // INI KUNCINYA
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
