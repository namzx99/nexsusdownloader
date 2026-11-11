import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import styles from './Downloader.module.css'

// Pakai proxy Vite — /api otomatis diteruskan ke http://localhost:3001
const API = ''

function detectPlatform(url) {
  if (!url) return null
  if (/tiktok\.com/i.test(url))             return 'tiktok'
  if (/instagram\.com/i.test(url))          return 'instagram'
  if (/youtube\.com|youtu\.be/i.test(url))  return 'youtube'
  return null
}

const PLATFORM_LABELS = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }
const PLATFORM_COLORS = { tiktok: '#00d4ff', instagram: '#e1306c', youtube: '#ff5555' }

// ── TikTok via tikwm.com (no backend needed) ─────────────────────────────────
async function fetchTikTok(url, format) {
  const res  = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(data.msg || 'Gagal ambil data TikTok')

  const d       = data.data
  const isSlide = d.images && d.images.length > 0

  if (isSlide) {
    // FotoLive / slideshow
    const downloads = d.images.map((imgUrl, i) => ({
      label:    `📸 Foto ${i + 1}`,
      url:      imgUrl,
      filename: `tiktok_foto_${i + 1}.jpg`,
      isDirect: true,
    }))
    if (d.music) downloads.push({
      label:    '🎵 Audio (MP3)',
      url:      d.music,
      filename: `tiktok_audio_${d.id || 'sound'}.mp3`,
      isDirect: true,
    })
    return {
      title:    d.title    || 'TikTok Slideshow',
      uploader: d.author?.nickname || '',
      thumbnail: d.origin_cover || d.cover || '',
      type:     'fotolive',
      downloads,
    }
  }

  // Regular video
  const downloads = []
  if (format === 'audio') {
    if (d.music) downloads.push({
      label:    '🎵 Download MP3',
      url:      d.music,
      filename: `tiktok_audio_${d.id || 'x'}.mp3`,
      isDirect: true,
    })
  } else {
    if (d.play) downloads.push({
      label:    '🎬 Video Tanpa Watermark (HD)',
      url:      d.play,
      filename: `tiktok_${d.id || 'x'}.mp4`,
      isDirect: true,
    })
    if (d.wmplay) downloads.push({
      label:    '🎬 Video Dengan Watermark',
      url:      d.wmplay,
      filename: `tiktok_wm_${d.id || 'x'}.mp4`,
      isDirect: true,
    })
    if (d.music) downloads.push({
      label:    '🎵 Audio Saja (MP3)',
      url:      d.music,
      filename: `tiktok_audio_${d.id || 'x'}.mp3`,
      isDirect: true,
    })
  }

  return {
    title:     d.title    || 'TikTok Video',
    uploader:  d.author?.nickname || '',
    thumbnail: d.origin_cover || d.cover || '',
    duration:  d.duration  || null,
    type:      format === 'audio' ? 'audio' : 'video',
    downloads,
  }
}

// ── Instagram / YouTube via backend yt-dlp ───────────────────────────────────
async function fetchBackend(url, format, quality) {
  const res  = await fetch(`${API}/api/info`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, format, quality }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Gagal ambil info dari server')
  return data
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Downloader() {
  const [url, setUrl]         = useState('')
  const [format, setFormat]   = useState('video')
  const [quality, setQuality] = useState('best')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [dlBusy, setDlBusy]   = useState({})
  const inputRef = useRef(null)

  const platform = detectPlatform(url)

  const handlePaste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      setUrl(t.trim())
      setResult(null)
    } catch {
      toast.error('Paste manual ke kolom URL')
    }
  }

  const handleClear = () => {
    setUrl('')
    setResult(null)
    inputRef.current?.focus()
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) { toast.error('Masukkan URL terlebih dahulu'); return }
    if (!platform) { toast.error('Gunakan link TikTok, Instagram, atau YouTube'); return }

    setLoading(true)
    setResult(null)

    try {
      let info

      if (platform === 'tiktok') {
        // TikTok: langsung via tikwm.com, tidak perlu backend
        info = await fetchTikTok(trimmed, format)
      } else {
        // Instagram / YouTube: via backend yt-dlp
        info = await fetchBackend(trimmed, format, quality)
      }

      setResult(info)

      // Auto-download jika cuma 1 opsi dan bukan slideshow
      if (info.type !== 'fotolive' && info.downloads?.length === 1) {
        await triggerDownload(info.downloads[0], 0)
      } else {
        toast.success('Info berhasil didapat, pilih tombol download di bawah!')
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  // ── Trigger download ──────────────────────────────────────────────────────
  const triggerDownload = async (dl, idx) => {
    setDlBusy(p => ({ ...p, [idx]: true }))
    const tid = toast.loading(`Mengunduh ${dl.label}...`)

    try {
      let blobUrl

      if (dl.isDirect) {
        // Langsung ambil dari CDN → blob → simpan
        const r    = await fetch(dl.url)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const blob = await r.blob()
        blobUrl    = URL.createObjectURL(blob)
      } else {
        // Stream dari backend yt-dlp
        const r = await fetch(`${API}/api/download`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            url:      dl.url,
            filename: dl.filename,
            format:   dl.format  || format,
            quality:  dl.quality || quality,
          }),
        })
        if (!r.ok) {
          const e = await r.json().catch(() => ({}))
          throw new Error(e.error || 'Gagal download dari server')
        }
        const blob = await r.blob()
        blobUrl    = URL.createObjectURL(blob)
      }

      // Trigger save dialog
      const a    = document.createElement('a')
      a.href     = blobUrl
      a.download = dl.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)

      toast.success('Download selesai!', { id: tid })
    } catch (err) {
      toast.error(err.message || 'Gagal download', { id: tid })
    } finally {
      setDlBusy(p => ({ ...p, [idx]: false }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section id="downloader" className={styles.section}>
      <div className={styles.glowLine} />

      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className={styles.sectionTag}>⚡ Download Sekarang</span>
          <h2 className={styles.sectionTitle}>Paste URL, langsung download</h2>
          <p className={styles.sectionDesc}>
            Tempel link dari TikTok, Instagram, atau YouTube. Tidak perlu login.
          </p>
        </motion.div>

        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {/* Format toggle */}
          <div className={styles.formatToggle}>
            {[['video', '🎬 Video'], ['audio', '🎵 Audio (MP3)']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`${styles.toggleBtn} ${format === val ? styles.toggleActive : ''}`}
                onClick={() => { setFormat(val); setResult(null) }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Quality row — video only, TikTok kualitas diabaikan karena tikwm sudah HD */}
          <AnimatePresence>
            {format === 'video' && platform !== 'tiktok' && (
              <motion.div
                className={styles.qualityRow}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className={styles.qualityLabel}>Kualitas:</span>
                {['best', '1080', '720', '480', '360'].map(q => (
                  <button
                    key={q}
                    type="button"
                    className={`${styles.qualityBtn} ${quality === q ? styles.qualityActive : ''}`}
                    onClick={() => setQuality(q)}
                  >
                    {q === 'best' ? 'Terbaik' : `${q}p`}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* URL input */}
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={`${styles.inputWrapper} ${platform ? styles.inputActive : ''}`}>
              <div className={styles.inputIcon}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <input
                ref={inputRef}
                type="url"
                className={styles.input}
                placeholder="Tempel link video di sini..."
                value={url}
                onChange={e => { setUrl(e.target.value); setResult(null) }}
                autoComplete="off"
                spellCheck="false"
              />
              {platform && (
                <div className={styles.platformBadge} style={{ color: PLATFORM_COLORS[platform] }}>
                  {PLATFORM_LABELS[platform]}
                </div>
              )}
              {url && (
                <button type="button" className={styles.clearBtn} onClick={handleClear}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            <div className={styles.btnRow}>
              <button type="button" className={styles.pasteBtn} onClick={handlePaste}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
                Paste
              </button>
              <button type="submit" className={styles.submitBtn} disabled={loading || !url.trim()}>
                {loading ? (
                  <><span className={styles.spinner} /> Memproses...</>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                className={styles.result}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.35 }}
              >
                <div className={styles.resultInfo}>
                  {result.thumbnail && (
                    <img
                      src={result.thumbnail}
                      alt="thumbnail"
                      className={styles.thumbnail}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  )}
                  <div className={styles.resultMeta}>
                    <p className={styles.resultTitle}>{result.title}</p>
                    {result.uploader && <p className={styles.resultSub}>👤 {result.uploader}</p>}
                    {result.duration  && <p className={styles.resultSub}>⏱ {fmtDuration(result.duration)}</p>}
                    {result.type === 'fotolive' && (
                      <span className={styles.fotoliveTag}>📸 TikTok FotoLive / Slideshow</span>
                    )}
                  </div>
                </div>

                <div className={styles.downloadBtns}>
                  {result.downloads?.map((dl, i) => (
                    <button
                      key={i}
                      className={`${styles.dlBtn} ${dlBusy[i] ? styles.dlBtnLoading : ''}`}
                      onClick={() => triggerDownload(dl, i)}
                      disabled={!!dlBusy[i]}
                    >
                      {dlBusy[i] ? (
                        <><span className={styles.spinnerSmall} /> Mengunduh...</>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          {dl.label}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className={styles.glowLineBottom} />
    </section>
  )
}

function fmtDuration(secs) {
  if (!secs) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}
