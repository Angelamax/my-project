import axios from "axios";
import crypto from "crypto";

export default async function handler(req, res) {
    // Ambil query 'q' dari link utuh kamu
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });

    const staticKey = "key-@@@@)))()((9))-xxxx&&&%%%%%";
    const baseURL = "https://chat.z.ai";

    // Fungsi Helper Signature
    const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest("hex");

    try {
        // 1. INIT SESSION
        const authRes = await axios.get(`${baseURL}/api/v1/auths/`, {
            headers: { "X-FE-Version": "prod-fe-1.0.239" }
        });
        const token = authRes.data.token;
        const userId = authRes.data.id;

        // 2. CREATE CHAT
        const timestamp = Date.now();
        const msgId = crypto.randomUUID();
        const chatRes = await axios.post(`${baseURL}/api/v1/chats/new`, {
            chat: {
                title: "New Chat",
                models: ["glm-5"],
                history: {
                    messages: {
                        [msgId]: { id: msgId, role: "user", content: q, timestamp: Math.floor(timestamp / 1000) }
                    },
                    currentId: msgId
                }
            }
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const chatId = chatRes.data.id;

        // 3. GENERATE SIGNATURE & SEND MESSAGE
        const requestId = crypto.randomUUID();
        const windowTime = Math.floor(timestamp / 300000);
        const intermediateKey = hmac(staticKey, String(windowTime));
        const sortedPayload = `requestId,${requestId},timestamp,${timestamp},user_id,${userId}`;
        const base64Prompt = Buffer.from(q, 'utf-8').toString("base64");
        const signature = hmac(intermediateKey, `${sortedPayload}|${base64Prompt}|${timestamp}`);

        const response = await axios.post(`${baseURL}/api/v2/chat/completions`, {
            stream: false, // Kita set false biar gak ribet di Dashboard
            model: "glm-5",
            messages: [{ role: "user", content: q }],
            chat_id: chatId,
            id: crypto.randomUUID()
        }, {
            params: { requestId, timestamp, user_id: userId, token },
            headers: { 
                Authorization: `Bearer ${token}`,
                "X-Signature": signature,
                "X-FE-Version": "prod-fe-1.0.239"
            }
        });

        // Kirim hasil ke Dashboard Angela
        res.status(200).json({
            status: true,
            result: response.data.choices[0].message.content
        });

    } catch (error) {
        res.status(500).json({ 
            status: false, 
            error: error.response?.data || error.message 
        });
    }
}
