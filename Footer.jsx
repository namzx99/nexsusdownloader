import styles from './Footer.module.css'

export default function Footer() {
  const year = new Date().getFullYear()

  const handleNav = (href) => {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <div className={styles.logoIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <span className={styles.brandName}>Nexsus Downloader</span>
          </div>
          <p className={styles.brandDesc}>
            Download video dan audio dari TikTok, Instagram, dan YouTube dengan cepat dan gratis.
          </p>
        </div>

        <div className={styles.divider} />

        <div className={styles.bottom}>
          <p className={styles.copy}>
            &copy; {year} Nexsus Team. Dibuat dengan ❤️ menggunakan React & Node.js.
          </p>
          <nav className={styles.footerNav}>
            {[
              ['#downloader', 'Downloader'],
              ['#features', 'Fitur'],
              ['#how-to-use', 'Cara Pakai'],
              ['#about', 'Tentang'],
            ].map(([href, label]) => (
              <button key={href} className={styles.footerLink} onClick={() => handleNav(href)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
