const axios = require('axios');

// Konfigurasi Kualitas
const qualityvideo = ['144', '240', '360', '720', '1080'];
const qualityaudio = ['128', '320'];

// Header Orisinal agar tidak diblokir
const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Origin': 'https://iframe.y2meta-uk.com',
  'Referer': 'https://iframe.y2meta-uk.com/'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- FUNGSI PEMBANTU ---

function ekstrakid(url) {
  const p = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /watch\?v=([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
    /live\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/
  ];
  for (const r of p) {
    const m = url.match(r);
    if (m) return m[1];
  }
  return null;
}

async function search(query) {
  const r = await axios.get(`https://wwd.mp3juice.blog/search.php?q=${encodeURIComponent(query)}`, { headers });
  if (!r.data?.items?.length) throw new Error('Hasil pencarian tidak ditemukan.');
  return r.data.items[0].id;
}

async function metadata(videoId) {
  try {
    const r = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    return {
      title: r.data.title,
      author: r.data.author_name,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/0.jpg`
    };
  } catch (e) {
    return { title: 'Unknown Video', author: 'Unknown', thumbnail: `https://i.ytimg.com/vi/${videoId}/0.jpg` };
  }
}

async function getkey() {
  const r = await axios.get('https://cnv.cx/v2/sanity/key', { headers });
  if (!r.data?.key) throw new Error('Gagal mendapatkan akses key dari server konversi.');
  return r.data.key;
}

// --- HANDLER UTAMA VERCEL ---

module.exports = async (req, res) => {
  // Set Header JSON & CORS di awal
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url, q, format = 'mp3', quality } = req.query;
  const input = url || q;

  if (!input) {
    return res.status(200).send(JSON.stringify({ status: false, error: "Masukkan URL atau judul lagu!" }, null, 2));
  }

  try {
    // 1. Dapatkan ID Video
    let id = ekstrakid(input);
    if (!id) {
      id = await search(input);
    }

    // 2. Ambil Metadata & Key
    const meta = await metadata(id);
    const key = await getkey();

    // 3. Konfigurasi Kualitas
    const isVideo = format === 'mp4';
    const qFinal = String(quality || (isVideo ? '720' : '320'));
    const audioBitrate = isVideo ? '128' : (qualityaudio.includes(qFinal) ? qFinal : '320');
    const videoQuality = isVideo ? (qualityvideo.includes(qFinal) ? qFinal : '720') : '720';

    // 4. Buat Job Konversi
    const jobRes = await axios.post('https://cnv.cx/v2/converter',
      new URLSearchParams({
        link: `https://youtu.be/${id}`,
        format: format,
        audioBitrate: audioBitrate,
        videoQuality: videoQuality,
        filenameStyle: 'pretty',
        vCodec: 'h264'
      }).toString(),
      { headers: { ...headers, key } }
    );

    const job = jobRes.data;

    // 5. Cek Status Job (Tunnel atau Processing)
    let finalResult = null;

    if (job.status === 'tunnel' && job.url) {
      finalResult = {
        status: true,
        id,
        title: meta.title,
        thumbnail: meta.thumbnail,
        format,
        quality: qFinal,
        download: job.url,
        filename: job.filename
      };
    } else if (job.status === 'processing') {
      // Poling singkat (Maksimal 3 kali agar tidak crash di Vercel gratis)
      for (let i = 0; i < 3; i++) {
        await sleep(2500);
        const statusRes = await axios.get(`https://cnv.cx/v2/status/${job.jobId}`, { headers });
        const s = statusRes.data;

        if (s.status === 'completed' && s.url) {
          finalResult = {
            status: true,
            id,
            title: meta.title,
            thumbnail: meta.thumbnail,
            format,
            quality: qFinal,
            download: s.url,
            filename: s.filename
          };
          break;
        }
      }
    }

    // 6. Kirim hasil
    if (finalResult) {
      return res.status(200).send(JSON.stringify(finalResult, null, 2));
    } else {
      return res.status(200).send(JSON.stringify({ 
        status: false, 
        error: "Server sedang sibuk memproses. Silakan coba klik sekali lagi dalam beberapa detik." 
      }, null, 2));
    }

  } catch (error) {
    return res.status(200).send(JSON.stringify({ 
      status: false, 
      error: error.message 
    }, null, 2));
  }
};
