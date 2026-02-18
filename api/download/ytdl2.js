import axios from 'axios';

export default async function handler(req, res) {  
  const startTime = Date.now();  
  const author = "AngelaImut";

  // Header Standar
  res.setHeader('Access-Control-Allow-Origin', '*');  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');  
  res.setHeader('Content-Type', 'application/json');

  let url = req.query.url || req.query.link || req.query.query;
  let type = req.query.type || 'mp3'; // Default mp3
  let quality = req.query.quality || null; // Kualitas opsional

  if (!url) {    
    return res.status(400).json({      
      success: false,      
      author: author,      
      message: "Parameter 'url' atau 'query' kosong.",      
      timestamp: new Date().toISOString(),      
      responseTime: `${Date.now() - startTime}ms`    
    });  
  }

  // [AUTO-FIX] URL YouTube  
  if (url.includes('youtube.com/live/')) {    
    url = url.replace('/live/', '/watch?v=');  
  } else if (url.includes('youtu.be/')) {    
    const id = url.split('youtu.be/')[1]?.split('?')[0];    
    if (id) url = `https://www.youtube.com/watch?v=${id}`;  
  }

  try {    
    // =====================================================================    
    // [ZONA UTUH] - LOGIKA SCRAPER Y2MATE
    // =====================================================================    
    const qualityvideo = ['144', '240', '360', '720', '1080']
    const qualityaudio = ['128', '320']

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
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms))

    function ekstrakid(url) {
      const p = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /watch\?v=([a-zA-Z0-9_-]{11})/,
        /shorts\/([a-zA-Z0-9_-]{11})/,
        /live\/([a-zA-Z0-9_-]{11})/,
        /embed\/([a-zA-Z0-9_-]{11})/
      ]
      for (const r of p) {
        const m = url.match(r)
        if (m) return m[1]
      }
      throw new Error('invalid yt url')
    }

    async function search(query) {
      const r = await axios.get(`https://wwd.mp3juice.blog/search.php?q=${encodeURIComponent(query)}`,
        { headers })

      if (!r.data?.items?.length) throw new Error('no search result')
      return r.data.items[0].id
    }

    async function metadata(videoId) {
      const r = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)

      return {
        title: r.data.title,
        author: r.data.author_name,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/0.jpg`
      }
    }

    async function getkey() {
      const r = await axios.get('https://cnv.cx/v2/sanity/key', { headers })
      return r.data.key
    }

    async function createjob(id, format, quality) {
      const key = await getkey()
      const isVideo = format === 'mp4'
      const q = String(quality || (isVideo ? '720' : '320'))

      const audio = isVideo
        ? 128
        : qualityaudio.includes(q) ? q : '320'

      const video = isVideo
        ? qualityvideo.includes(q) ? q : '720'
        : 720

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
      )

      return r.data
    }

    async function getJob(jobId) {
      const r = await axios.get(`https://cnv.cx/v2/status/${jobId}`, { headers })
      return r.data
    }

    async function poll(jobId, id, format, quality, meta) {
      for (let i = 0; i < 30; i++) {
        await sleep(2000)
        const s = await getJob(jobId)

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
          }
        }

        if (s.status === 'error') throw new Error(s.message)
      }
    }

    async function y2mate(input, format = 'mp3', quality = null) {
      const isUrl = /youtu\.be|youtube\.com/.test(input)
      const id = isUrl ? ekstrakid(input) : await search(input)

      const meta = await metadata(id)
      const job = await createjob(id, format, quality)

      if (job.status === 'tunnel' && job.url) {
        return {
          id,
          title: meta.title,
          author: meta.author,
          thumbnail: meta.thumbnail,
          format,
          quality: String(quality || (format === 'mp4' ? '720' : '320')),
          download: job.url,
          filename: job.filename
        }
      }

      if (job.status === 'processing') {
        return poll(job.jobId, id, format, quality, meta)
      }
    }
    // =====================================================================    
    // [AKHIR ZONA UTUH]
    // =====================================================================

    // Eksekusi Logika
    const finalResult = await y2mate(url, type, quality);

    if (!finalResult) {
      throw new Error("Gagal mendapatkan link unduhan.");
    }

    // Response Sukses
    return res.status(200).json({
      success: true,
      author: author,
      result: finalResult,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });

  } catch (e) {
    // Response Gagal
    return res.status(500).json({
      success: false,
      author: author,
      message: e.message,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}
