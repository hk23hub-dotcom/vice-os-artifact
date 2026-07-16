import { useState } from 'react'
import Landing from './components/Landing'
import MobileMockup from './components/MobileMockup'
import Architecture from './components/Architecture'
import './index.css'

type Section = 'landing' | 'mockup' | 'architecture'

export default function App() {
  const [section, setSection] = useState<Section>('landing')

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#fff' }}>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: '1px solid #2A2A2A',
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(8px)',
        height: 56
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: -1, color: '#AAFF00' }}>VICE</span>
            <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: -1 }}>OS</span>
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#444', border: '1px solid #2A2A2A', padding: '2px 6px' }}>BETA</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { id: 'landing', label: 'PLATAFORMA' },
              { id: 'mockup', label: 'APPS' },
              { id: 'architecture', label: 'ARQUITECTURA' },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                style={{
                  padding: '6px 16px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2,
                  background: 'none',
                  border: 'none',
                  borderBottom: section === id ? '2px solid #AAFF00' : '2px solid transparent',
                  color: section === id ? '#AAFF00' : '#666',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main style={{ paddingTop: 56 }}>
        {section === 'landing' && <Landing />}
        {section === 'mockup' && <MobileMockup />}
        {section === 'architecture' && <Architecture />}
      </main>
    </div>
  )
}
