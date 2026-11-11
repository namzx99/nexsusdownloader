const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')
const { spawn } = require('child_process')

const app  = express()
const PORT = process.env.PORT || 3001

// ─── CORS / JSON ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'],
  methods: ['GET','POST','OPTIONS'],
}))
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})
app.use(express.json({ limit: '1mb' }))

// ─── yt-dlp path ──────────────────────────────────────────────────────────────
const YTDLP = path.join(__dirname, 'bin', 'yt-dlp.exe')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitize(name) {
  return (name || 'video').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 100)
}

function detectPlatform(url) {
  if (/tiktok\.com/i.test(url))          return 'tiktok'
  if (/instagram\.com/i.test(url))       return 'instagram'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  return null
}

function isValidUrl(url) {
  try { const u = new URL(url); return ['http:','https:'].includes(u.protocol) }
  catch { return false }
}

// ─── Spawn yt-dlp (handles paths with spaces safely) ─────────────────────────
function ytdlp(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(YTDLP)) {
      return reject(new Error('yt-dlp.exe tidak ditemukan di folder bin/'))
    }

    const proc = spawn(YTDLP, args, { windowsHide: true })
    let out = '', err = ''

    proc.stdout.on('data', d => { out += d.toString() })
    proc.stderr.on('data', d => { err += d.toString() })

    const timer = setTimeout(() => { proc.kill(); reject(new Error('Timeout')) }, timeoutMs)

    proc.on('close', code => {
      clearTimeout(timer)
      if (code === 0) return resolve(out)
      // Parse meaningful error from stderr
      const lines   = err.split('\n').filter(Boolean)
      const errLine = lines.find(l => /ERROR:|error:|Unable|blocked|unavailable|private/i.test(l))
                   || lines.slice(-3).join(' ')
                   || 'Unknown error'
      reject(new Error(errLine.replace(/^ERROR:\s*/i, '').trim()))
    })

    proc.on('error', e => { clearTimeout(timer); reject(new Error('Tidak bisa jalankan yt-dlp: ' + e.message)) })
  })
}

// ─── POST /api/info ───────────────────────────────────────────────────────────
app.post('/api/info', async (req, res) => {
  const { url, format = 'video', quality = 'best' } = req.body

  if (!url || !isValidUrl(url.trim())) return res.status(400).json({ error: 'URL tidak valid' })

  const platform = detectPlatform(url.trim())
  if (!platform) return res.status(400).json({ error: 'Platform tidak didukung. Gunakan TikTok, Instagram, atau YouTube.' })

  try {
    const raw = await ytdlp([
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--flat-playlist',
      url.trim(),
    ], 40000)

    const infos = raw.trim().split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)

    if (!infos.length) return res.status(500).json({ error: 'Gagal parse info video' })

    const primary = infos[0]

    // ── Detect FotoLive / TikTok slideshow ─────────────────────────────────
    const isFotolive = platform === 'tiktok' && (
      infos.length > 1 ||
      primary.ext === 'unknown_video' ||
      (primary.formats || []).every(f => /jpe?g|png|webp/i.test(f.ext || ''))
    )

    if (isFotolive || infos.length > 1) {
      // Need full info for direct URLs — re-fetch without --flat-playlist
      let fullInfos = infos
      if (infos.some(i => !i.url)) {
        try {
          const fullRaw = await ytdlp(['--dump-json','--no-warnings','--no-check-certificates', url.trim()], 40000)
          fullInfos = fullRaw.trim().split('\n')
            .filter(Boolean)
            .map(l => { try { return JSON.parse(l) } catch { return null } })
            .filter(Boolean)
        } catch {}
      }

      const downloads = fullInfos.map((info, i) => {
        const ext  = /jpg|jpeg|png|webp/i.test(info.ext) ? info.ext : 'jpg'
        const fname = `${sanitize(info.title || 'foto')}_${i + 1}.${ext}`
        const dlUrl = info.url || (info.formats || []).slice(-1)[0]?.url || ''
        return { label: `📸 Foto ${i + 1}`, url: dlUrl, filename: fname, isDirect: true }
      })

      return res.json({
        title: primary.title || 'TikTok FotoLive',
        thumbnail: primary.thumbnail || null,
        uploader: primary.uploader || null,
        duration: null,
        platform,
        type: 'fotolive',
        downloads,
      })
    }

    // ── Regular video / audio ───────────────────────────────────────────────
    const title = primary.title || 'video'

    if (format === 'audio') {
      return res.json({
        title,
        thumbnail: primary.thumbnail || null,
        uploader:  primary.uploader || primary.channel || null,
        duration:  primary.duration || null,
        platform,
        type: 'audio',
        downloads: [{
          label: '🎵 Download MP3',
          url: url.trim(), filename: sanitize(title) + '.mp3',
          isDirect: false, format: 'audio',
        }],
      })
    }

    // Video: collect available heights
    const formats  = (primary.formats || []).filter(f => f.vcodec !== 'none' && f.vcodec)
    const heights  = [...new Set(formats.map(f => f.height).filter(Boolean))].sort((a,b) => b - a)

    const downloads = []

    if (quality === 'best' || !heights.length) {
      downloads.push({
        label: '🎬 Download Video (Kualitas Terbaik)',
        url: url.trim(), filename: sanitize(title) + '.mp4',
        isDirect: false, format: 'video', quality: 'best',
      })
    } else {
      const h    = parseInt(quality)
      const best = heights.find(x => x <= h + 50) || heights[0]
      downloads.push({
        label: `🎬 Download Video ${best}p`,
        url: url.trim(), filename: sanitize(title) + `_${best}p.mp4`,
        isDirect: false, format: 'video', quality: String(best),
      })
      // Also offer best quality if different
      if (best !== heights[0]) {
        downloads.push({
          label: `🎬 Download Video ${heights[0]}p (Terbaik)`,
          url: url.trim(), filename: sanitize(title) + `_${heights[0]}p.mp4`,
          isDirect: false, format: 'video', quality: String(heights[0]),
        })
      }
    }

    res.json({
      title,
      thumbnail: primary.thumbnail || null,
      uploader:  primary.uploader || primary.channel || null,
      duration:  primary.duration || null,
      platform,
      type: 'video',
      downloads,
    })

  } catch (err) {
    console.error('[/api/info]', err.message)
    const msg = err.message
    if (/Timeout/i.test(msg))                                   return res.status(504).json({ error: 'Timeout. Coba lagi.' })
    if (/private/i.test(msg))                                   return res.status(400).json({ error: 'Video bersifat private.' })
    if (/unavailable|removed|deleted/i.test(msg))               return res.status(400).json({ error: 'Video tidak tersedia atau sudah dihapus.' })
    if (/Unsupported URL/i.test(msg))                           return res.status(400).json({ error: 'URL tidak dikenali.' })
    res.status(500).json({ error: msg || 'Gagal mengambil info video.' })
  }
})

// ─── POST /api/download ───────────────────────────────────────────────────────
app.post('/api/download', async (req, res) => {
  const { url, filename, format = 'video', quality = 'best' } = req.body

  if (!url || !isValidUrl(url.trim())) return res.status(400).json({ error: 'URL tidak valid' })

  const isAudio     = format === 'audio'
  const ext         = isAudio ? 'mp3' : 'mp4'
  const safeBase    = sanitize((filename || 'download').replace(/\.[^.]+$/, ''))
  const outputName  = safeBase + '.' + ext

  const tmpDir = path.join(__dirname, 'tmp')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const tmpBase     = path.join(tmpDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`)
  const tmpTemplate = tmpBase + '.%(ext)s'

  let args
  if (isAudio) {
    args = [
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '--no-playlist', '--no-warnings', '--no-check-certificates',
      '-o', tmpTemplate,
      url.trim(),
    ]
  } else {
    let fmt
    if (quality === 'best') {
      fmt = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
    } else {
      const h = parseInt(quality)
      fmt = `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${h}][ext=mp4]/best[height<=${h}]/best`
    }
    args = [
      '-f', fmt,
      '--merge-output-format', 'mp4',
      '--no-playlist', '--no-warnings', '--no-check-certificates',
      '-o', tmpTemplate,
      url.trim(),
    ]
  }

  try {
    await ytdlp(args, 300000)

    // Find the written file
    const base    = path.basename(tmpBase)
    const written = fs.readdirSync(tmpDir).filter(f => f.startsWith(base))
    if (!written.length) return res.status(500).json({ error: 'File tidak terbuat setelah download' })

    const filePath = path.join(tmpDir, written[0])
    const stat     = fs.statSync(filePath)

    res.setHeader('Content-Type',        isAudio ? 'audio/mpeg' : 'video/mp4')
    res.setHeader('Content-Length',      stat.size)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(outputName)}`)
    res.setHeader('Cache-Control',       'no-cache')

    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
    stream.on('end',   () => { try { fs.unlinkSync(filePath) } catch {} })
    stream.on('error', e => {
      console.error('[stream]', e)
      try { fs.unlinkSync(filePath) } catch {}
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' })
    })

  } catch (err) {
    console.error('[/api/download]', err.message)
    // cleanup
    try {
      const base = path.basename(tmpBase)
      fs.readdirSync(tmpDir).filter(f => f.startsWith(base)).forEach(f => {
        try { fs.unlinkSync(path.join(tmpDir, f)) } catch {}
      })
    } catch {}
    if (/Timeout/i.test(err.message)) return res.status(504).json({ error: 'Timeout — coba lagi' })
    res.status(500).json({ error: err.message || 'Gagal download' })
  }
})

// ─── POST /api/download-direct ────────────────────────────────────────────────
app.post('/api/download-direct', (req, res) => {
  const { url, filename } = req.body
  if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'URL tidak valid' })

  const safeFilename = sanitize(filename || 'file')
  const mod = url.startsWith('https') ? require('https') : require('http')

  mod.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.tiktok.com/',
    }
  }, proxyRes => {
    const ct = proxyRes.headers['content-type'] || 'application/octet-stream'
    res.setHeader('Content-Type', ct)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`)
    if (proxyRes.headers['content-length']) res.setHeader('Content-Length', proxyRes.headers['content-length'])
    proxyRes.pipe(res)
  }).on('error', e => {
    console.error('[direct]', e)
    if (!res.headersSent) res.status(500).json({ error: 'Gagal proxy file' })
  })
})

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ytdlp: fs.existsSync(YTDLP) ? 'found' : 'NOT FOUND', timestamp: new Date().toISOString() })
})

// ─── Tmp cleanup ──────────────────────────────────────────────────────────────
setInterval(() => {
  const d = path.join(__dirname, 'tmp')
  if (!fs.existsSync(d)) return
  const now = Date.now()
  fs.readdirSync(d).forEach(f => {
    try { if (now - fs.statSync(path.join(d, f)).mtimeMs > 15 * 60000) fs.unlinkSync(path.join(d, f)) } catch {}
  })
}, 10 * 60000)

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Nexsus Downloader  —  http://localhost:${PORT}`)
  console.log(`    yt-dlp : ${fs.existsSync(YTDLP) ? '✅  ' + YTDLP : '❌  NOT FOUND'}`)
  console.log(`    health : http://localhost:${PORT}/api/health\n`)
})
