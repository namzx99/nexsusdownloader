import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Downloader from './components/Downloader'
import Features from './components/Features'
import HowToUse from './components/HowToUse'
import About from './components/About'
import Footer from './components/Footer'

function App() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#071628',
            color: '#e2f4ff',
            border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: '12px',
            fontSize: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
          success: { iconTheme: { primary: '#00d4ff', secondary: '#071628' } },
          error:   { iconTheme: { primary: '#ff5555', secondary: '#071628' } },
          loading: { iconTheme: { primary: '#00d4ff', secondary: '#071628' } },
        }}
      />
      <Navbar />
      <main>
        <Hero />
        <Downloader />
        <Features />
        <HowToUse />
        <About />
      </main>
      <Footer />
    </>
  )
}

export default App
