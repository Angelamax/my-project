import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const startTime = Date.now();
  const author = "AngelaImut";

  // 1. Konfigurasi Header Standar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Content-Type', 'application/json');

  const url = req.query.url || req.query.link;

  if (!url) {
    return res.status(400).json({
      success: false,
      author: author,
      message: "Masukkan parameter 'url' video Facebook!",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }

  try {
    // =====================================================================
    // [ZONA UTUH] - LOGIKA SCRAPER FDOWNLOADER
    // =====================================================================
    const TARGET_URL = 'https://fdownloader.net/es';
    
    // Header Penyamaran (Meniru got-scraping profile: Chrome/Windows)
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // 1. Fetching Homepage untuk cari Token
    const response1 = await axios.get(TARGET_URL, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    const bodyHtml = response1.data;
    
    // Regex Extract Token (Sesuai script asli)
    const kExp = bodyHtml.match(/k_exp\s*=\s*["']?(\d+)["']?/)?.[1] || '1770235762'; 
    const kToken = bodyHtml.match(/k_token\s*=\s*["']?([a-f0-9]+)["']?/)?.[1] || 'b549f6763739d512060f25e56f57d962121b88403fa64bab897802fa3759ceff';
    
    // Token Cloudflare Panjang (Hardcoded sesuai script asli)
    const cfToken = '0.DMPSfQxgppqCXiARRnfQIfKjhL4CLUg5hVeZLPaZ2BSrAOGXgihjeTI2B9tp0_hVkKdWPCS3C8A7sSuexRO42hGq-8EPgxk-ws5CG4EJY1h65uMVcmGuTFFCKUhwX60VhXNnFxrSY4Lrl790v1sVRDAoJDufOv0mqPTFEgoLcjJ-KiV459EsqaARKJ29JwchdTKBAKG2o28_1Sl-EVigwPqw261wpEkkkwitC9JtwKIuvOf5EpfYA8_v__yN-iQ3BvVbTWVYY92Fa_nFsMKTG1KAYONxGb-6c7tA5BXHfWEfD9-zvegc76yKqB1gDgsJRJkRPy8evYzlekYvjvH3SpVuhoMDd86M02NcjjXKS-9VJftFf_qvOurz3bkT7BJaSAMHJ6Fe95R0XusRdZqt3-s-AygKG1YSWS025tUJlLqTAoMY0osRvNdkkbmcGG_1gGjBi6EHSYFCLVrwk6w1gkzbbp_u1TGadbIPKsYNTsmlMuuew3Gcu43-ptLAhG2bMZ_UAWj3dBr2wygg_QxWKj3pASGIBzllFRNe8ysnqf4ZsRaue10N_HEdQZIEQH9ci8BpalyIIx3RXLYsvBfkw8oDhBOYb62PeQYIB_l2anMiwb0-hT6GigUeNnm0Rce6nDFaQJz9nDA2q7AfcGjKPssMW97C_zMnhNKUarNsfL-UkIdJPBaZexV-6a22Mh4BHlMsyJa9qnsXFUYh54rgQt0wBVn4Ti-y-MjBezT_Kg5Z-Q8nexSQp-p3ZtdwyRAvlW7iKZ1007sBbkOVvgYILd084xo36ZRPteDAQi7F9n9eTGhjQ3jp6uN7VpYFE2EoGWgF4PRdk0xYTiveOwDu_yPlcBVKQRtrv-P8wBYpKJX1hyfM1PSSrXfm343_E20kxAN8luMGc8Rpd9m74YiITKgaHWpm4x9_nZKh74qZwIPOThK8v3MO-dOG8EbKHGAm8O0REudXnGP30jE66hkKfw.HbHSGrKK85hDWhDFERUpIg.3ff8325f1ab0a26ec56f34bb39772a97f42b524349257c638f35eee2541a3b42';

    // Persiapan Payload Form Data
    const formData = new URLSearchParams();
    formData.append('k_exp', kExp);
    formData.append('k_token', kToken);
    formData.append('q', url);
    formData.append('lang', 'es');
    formData.append('web', 'fdownloader.net');
    formData.append('v', 'v2');
    formData.append('w', '');
    formData.append('cftoken', cfToken);

    // 2. Request ke API Ajax
    const response2 = await axios.post('https://v3.fdownloader.net/api/ajaxSearch', formData, {
        headers: {
            'User-Agent': userAgent,
            'Referer': TARGET_URL,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://fdownloader.net',
            'X-Requested-With': 'XMLHttpRequest'
        }
    });

    const results = [];

    if (response2.data && response2.data.data) {
         // 3. Parsing HTML Response menggunakan Cheerio
         const $api = cheerio.load(response2.data.data);
         
         $api('a.download-link-fb').each((i, el) => {
             const quality = $api(el).closest('tr').find('.video-quality').text().trim();
             const downloadUrl = $api(el).attr('href');
             if (downloadUrl) {
                 results.push({ quality, url: downloadUrl });
             }
         });
    }

    if (results.length === 0) {
        throw new Error("Gagal mendapatkan link download. Cek validitas URL atau token mungkin kadaluarsa.");
    }

    // =====================================================================
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // 4. Format Response Sukses
    return res.status(200).json({
      success: true,
      author: author,
      result: results,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    // 5. Format Response Error
    return res.status(500).json({
      success: false,
      author: author,
      error: error.message,
      debug: error.response?.data || "No upstream details",
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
