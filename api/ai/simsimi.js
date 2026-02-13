import axios from "axios";
import crypto from "crypto";

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Kasih pertanyaan dulu atuh!" });

    const baseURL = "https://chat.z.ai";
    const staticKey = "key-@@@@)))()((9))-xxxx&&&%%%%%";
    const feVersion = "prod-fe-1.0.239";

    // Helper HMAC
    const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest("hex");

    try {
        // 1. INIT SESSION (Ambil Token & User ID)
        const auth = await axios.get(`${baseURL}/api/v1/auths/`, {
            headers: { "X-FE-Version": feVersion }
        });
        const { token, id: user_id, name } = auth.data;

        // 2. SETUP DATA & SIGNATURE
        const timestamp = Date.now();
        const requestId = crypto.randomUUID();
        
        // Logika Signature (Harus Presisi!)
        const windowTime = Math.floor(timestamp / 300000);
        const intermediateKey = hmac(staticKey, String(windowTime));
        const sortedPayload = `requestId,${requestId},timestamp,${timestamp},user_id,${user_id}`;
        const base64Prompt = Buffer.from(q, 'utf-8').toString("base64");
        const dataToSign = `${sortedPayload}|${base64Prompt}|${timestamp}`;
        const signature = hmac(intermediateKey, dataToSign);

        // 3. QUERY PARAMS (Ini yang bikin 403 kalau kurang!)
        const params = new URLSearchParams({
            requestId,
            timestamp: String(timestamp),
            user_id,
            version: "0.0.1",
            platform: "web",
            token: token,
            language: "id-ID",
            languages: "id-ID,id,en-US,en",
            timezone: "Asia/Jakarta",
            signature_timestamp: String(timestamp) // <--- INI KUNCINYA
        });

        // 4. PAYLOAD (Ikuti struktur Z.ai Chat V2)
        const payload = {
            stream: false, // Set false agar Vercel bisa kirim JSON utuh
            model: "glm-4",
            messages: [{ role: "user", content: q }],
            signature_prompt: q,
            params: {},
            variables: {
                "{{USER_NAME}}": name || "AngelaImut",
                "{{CURRENT_TIMEZONE}}": "Asia/Jakarta"
            },
            id: crypto.randomUUID()
        };

        // 5. EKSEKUSI
        const response = await axios.post(`${baseURL}/api/v2/chat/completions?${params.toString()}`, payload, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "X-Signature": signature,
                "X-FE-Version": feVersion,
                "Content-Type": "application/json"
            }
        });

        // 6. RESPONSE KE DASHBOARD
        res.status(200).json({
            status: true,
            result: response.data.choices[0].message.content
        });

    } catch (error) {
        console.error(error.response?.data);
        res.status(error.response?.status || 500).json({
            status: false,
            error: error.response?.data || error.message
        });
    }
}
