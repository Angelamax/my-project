const axios = require('axios');

// Konfigurasi Kualitas
const qualityvideo = ['144', '240', '360', '720', '1080'];
const qualityaudio = ['128', '320'];

// Header agar tidak disangka bot
const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
  'Content-Type': 'application/x-www-form-urlencoded',
  'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'Origin': 'https://iframe.y2meta-uk.com',
  'Referer': 'https://iframe.y2meta-uk.com/'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- FUNGSI LOGIKA DASAR ---

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
  throw new Error('invalid yt url');
}

async function search(query) {
  const r = await axios.get(`https://wwd.mp3juice.blog/search.php?q=${encodeURIComponent(query)}`, { headers });
  if (!r.data?.items?.length) throw new Error('no search result');
  return r.data.items[0].id;
}

async function metadata(videoId) {
  const r = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
  return {
    title: r.data.title,
    author: r.data.author_name,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/0.jpg`
  };
}

async function getkey() {
  const r = await axios.get('https://cnv.cx/v2/sanity/key', { headers });
  return r.data.key;
}

async function createjob(id, format, quality) {
  const key = await getkey();
  const isVideo = format === 'mp4';
  const q = String(quality || (isVideo ? '720' : '320'));

  const audio = isVideo ? 128 : qualityaudio.includes(q) ? q : '320';
  const video = isVideo ? qualityvideo.includes(q) ? q : '720' : 720;

  const r = await axios.post('https://cnv.cx/v2/converter',
    new URLSearchParams({
      link: `https://youtu.be/${id}`,
      format,
      audioBitrate: String(audio),
      videoQuality: String(video),
      filenameStyle: 'pretty',
      vCodec: 'h264'
    }).toString(),
    { headers: { ...headers, key } }
  );
  return r.data;
}

async function getJob(jobId) {
  const r = await axios.get(`https://cnv.cx/v2/status/${jobId}`, { headers });
  return r.data;
}

async function poll(jobId, id, format, quality, meta) {
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const s = await getJob(jobId);
    if (s.status === 'completed' && s.url) {
      return {
        id,
        title: meta.title,
        author: meta.author,
        thumbnail: meta.thumbnail,
        format,
        quality: String(quality || (format === 'mp4' ? '720' : '320')),
        download: s.url,
        filename: s.filename
      };
    }
    if (s.status === 'error') throw new Error(s.message);
  }
}

// --- VERCEL HANDLER ---

export default async function handler(req, res) {
  // Ambil parameter dari query URL
  const { url, q, format = 'mp3', quality } = req.query;
  const input = url || q;

  if (!input) {
    return res.status(400).send(JSON.stringify({ status: false, error: "Masukkan URL atau judul lagu!" }, null, 2));
  }

  try {
    const isUrl = /youtu\.be|youtube\.com/.test(input);
    const id = isUrl ? ekstrakid(input) : await search(input);

    const meta = await metadata(id);
    const job = await createjob(id, format, quality);

    let result;
    if (job.status === 'tunnel' && job.url) {
      result = {
        id,
        title: meta.title,
        author: meta.author,
        thumbnail: meta.thumbnail,
        format,
        quality: String(quality || (format === 'mp4' ? '720' : '320')),
        download: job.url,
        filename: job.filename
      };
    } else if (job.status === 'processing') {
      result = await poll(job.jobId, id, format, quality, meta);
    }

    // Output Pretty Print
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(result, null, 2));

  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).send(JSON.stringify({ status: false, error: error.message }, null, 2));
  }
}
