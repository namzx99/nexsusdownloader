import { motion } from 'framer-motion'
import styles from './About.module.css'

export default function About() {
  return (
    <section id="about" className={styles.section}>
      <div className={styles.container}>
        <motion.div
          className={styles.grid}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Purpose card */}
          <div className={styles.card}>
            <div className={styles.cardIcon} style={{ '--c': '#6366f1' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 className={styles.cardTitle}>Dibuat untuk apa?</h3>
            <p className={styles.cardText}>
              <strong>Nexsus Downloader</strong> dibuat untuk memudahkan siapapun mengunduh konten video
              dan audio dari platform media sosial populer — TikTok, Instagram, dan YouTube —
              secara gratis, cepat, dan tanpa watermark.
            </p>
            <p className={styles.cardText}>
              Cocok untuk kreator konten, pelajar, maupun siapapun yang ingin menyimpan
              konten favorit mereka secara offline.
            </p>
            <div className={styles.tags}>
              <span className={styles.tag}>Gratis</span>
              <span className={styles.tag}>Tanpa Iklan</span>
              <span className={styles.tag}>Tanpa Login</span>
              <span className={styles.tag}>Open Source Ready</span>
            </div>
          </div>

          {/* Creator card */}
          <div className={styles.card}>
            <div className={styles.cardIcon} style={{ '--c': '#a855f7' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h3 className={styles.cardTitle}>Dibuat oleh siapa?</h3>
            <div className={styles.creator}>
              <div className={styles.avatar}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <p className={styles.creatorName}>Faiz Khoirul Anam</p>
                <p className={styles.creatorRole}>Student</p>
              </div>
            </div>
            <p className={styles.cardText}>
              Dikembangkan dengan penuh semangat menggunakan <strong>React</strong> (frontend)
              dan <strong>Node.js + yt-dlp</strong> (backend). Website ini memanfaatkan teknologi
              terkini untuk memastikan kecepatan dan kompatibilitas lintas platform.
            </p>
            <div className={styles.techStack}>
              {['React', 'Node.js', 'yt-dlp', 'Framer Motion', 'Express'].map(t => (
                <span key={t} className={styles.techBadge}>{t}</span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          className={styles.disclaimer}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p>
            Nexsus Downloader hanya untuk penggunaan pribadi dan konten yang legal untuk diunduh.
            Hormati hak cipta kreator. Jangan gunakan untuk tujuan komersial tanpa izin pemilik konten.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
