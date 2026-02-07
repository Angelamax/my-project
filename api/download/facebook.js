import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Content-Type', 'application/json');

  const url = req.query.url || req.query.link;

  if (!url) {
    return res.status(400).json({ message: "URL kosong" });
  }

  // Variable Debugging untuk ditampung
  let debugLog = {
    step1_homepage: "pending",
    extracted_tokens: {},
    step2_api_status: "pending",
    step2_api_raw_response: null
  };

  try {
    const TARGET_URL = 'https://fdownloader.net/es';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // ------------------------------------------------------------------
    // LANGKAH 1: Ambil Halaman Utama & Token
    // ------------------------------------------------------------------
    const response1 = await axios.get(TARGET_URL, {
      headers: { 'User-Agent': userAgent }
    });

    debugLog.step1_homepage = "success";
    const bodyHtml = response1.data;

    // Cek apakah terkena Cloudflare Challenge di halaman awal
    if (bodyHtml.includes("Just a moment...") || bodyHtml.includes("Enable JavaScript")) {
      throw new Error("Terblokir Cloudflare di Halaman Utama (Step 1)");
    }

    const kExp = bodyHtml.match(/k_exp\s*=\s*["']?(\d+)["']?/)?.[1];
    const kToken = bodyHtml.match(/k_token\s*=\s*["']?([a-f0-9]+)["']?/)?.[1];

    debugLog.extracted_tokens = { 
      k_exp: kExp || "TIDAK DITEMUKAN", 
      k_token: kToken || "TIDAK DITEMUKAN" 
    };

    if (!kExp || !kToken) {
      throw new Error("Gagal mengekstrak token dari halaman utama.");
    }

    // ------------------------------------------------------------------
    // LANGKAH 2: Request ke API
    // ------------------------------------------------------------------
    // Token CF (Sesuai script aslimu)
    const cfToken = '0.DMPSfQxgppqCXiARRnfQIfKjhL4CLUg5hVeZLPaZ2BSrAOGXgihjeTI2B9tp0_hVkKdWPCS3C8A7sSuexRO42hGq-8EPgxk-ws5CG4EJY1h65uMVcmGuTFFCKUhwX60VhXNnFxrSY4Lrl790v1sVRDAoJDufOv0mqPTFEgoLcjJ-KiV459EsqaARKJ29JwchdTKBAKG2o28_1Sl-EVigwPqw261wpEkkkwitC9JtwKIuvOf5EpfYA8_v__yN-iQ3BvVbTWVYY92Fa_nFsMKTG1KAYONxGb-6c7tA5BXHfWEfD9-zvegc76yKqB1gDgsJRJkRPy8evYzlekYvjvH3SpVuhoMDd86M02NcjjXKS-9VJftFf_qvOurz3bkT7BJaSAMHJ6Fe95R0XusRdZqt3-s-AygKG1YSWS025tUJlLqTAoMY0osRvNdkkbmcGG_1gGjBi6EHSYFCLVrwk6w1gkzbbp_u1TGadbIPKsYNTsmlMuuew3Gcu43-ptLAhG2bMZ_UAWj3dBr2wygg_QxWKj3pASGIBzllFRNe8ysnqf4ZsRaue10N_HEdQZIEQH9ci8BpalyIIx3RXLYsvBfkw8oDhBOYb62PeQYIB_l2anMiwb0-hT6GigUeNnm0Rce6nDFaQJz9nDA2q7AfcGjKPssMW97C_zMnhNKUarNsfL-UkIdJPBaZexV-6a22Mh4BHlMsyJa9qnsXFUYh54rgQt0wBVn4Ti-y-MjBezT_Kg5Z-Q8nexSQp-p3ZtdwyRAvlW7iKZ1007sBbkOVvgYILd084xo36ZRPteDAQi7F9n9eTGhjQ3jp6uN7VpYFE2EoGWgF4PRdk0xYTiveOwDu_yPlcBVKQRtrv-P8wBYpKJX1hyfM1PSSrXfm343_E20kxAN8luMGc8Rpd9m74YiITKgaHWpm4x9_nZKh74qZwIPOThK8v3MO-dOG8EbKHGAm8O0REudXnGP30jE66hkKfw.HbHSGrKK85hDWhDFERUpIg.3ff8325f1ab0a26ec56f34bb39772a97f42b524349257c638f35eee2541a3b42';

    const formData = new URLSearchParams();
    formData.append('k_exp', kExp);
    formData.append('k_token', kToken);
    formData.append('q', url);
    formData.append('lang', 'es');
    formData.append('web', 'fdownloader.net');
    formData.append('v', 'v2');
    formData.append('w', '');
    formData.append('cftoken', cfToken);

    const response2 = await axios.post('https://v3.fdownloader.net/api/ajaxSearch', formData, {
      headers: {
        'User-Agent': userAgent,
        'Referer': TARGET_URL,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://fdownloader.net',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    debugLog.step2_api_status = response2.status;
    debugLog.step2_api_raw_response = response2.data; // Ini kuncinya, kita lihat isinya apa

    const results = [];
    if (response2.data && response2.data.data) {
       const $api = cheerio.load(response2.data.data);
       $api('a.download-link-fb').each((i, el) => {
           const quality = $api(el).closest('tr').find('.video-quality').text().trim();
           const downloadUrl = $api(el).attr('href');
           if (downloadUrl) results.push({ quality, url: downloadUrl });
       });
    }

    return res.status(200).json({
      success: results.length > 0,
      author: author,
      input_url: url,
      result: results,
      debug_trace: debugLog, // Kita tampilkan semua log di sini
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      author: author,
      error: error.message,
      debug_trace: debugLog, // Tetap tampilkan log meski error
      upstream_error: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : "No response",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
