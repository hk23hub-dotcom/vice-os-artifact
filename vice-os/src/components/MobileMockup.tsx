import { useState } from 'react'
import GolfScreen from './GolfScreen'
import RugbyScreen from './RugbyScreen'

type App = 'golf' | 'rugby'

export default function MobileMockup() {
  const [activeApp, setActiveApp] = useState<App>('rugby')

  const features = {
    rugby: [
      { label: 'Zonas interactivas', desc: 'Toca cualquier zona del campo para seleccionarla', icon: '🗺️' },
      { label: 'Registro en vivo', desc: 'Registra make/miss con notas en tiempo real', icon: '⚡' },
      { label: 'Radar de progreso', desc: 'Visualiza tu % por zona con gráfico estrella', icon: '⭐' },
    ],
    golf: [
      { label: 'Performance DNA', desc: 'Radar de 5 dimensiones de tu juego', icon: '⭐' },
      { label: 'Putting Protocol', desc: '100 putts diarios con tracking de progreso', icon: '⛳' },
      { label: 'Booking directo', desc: 'Reserva caddies y simuladores al instante', icon: '📅' },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: '#555' }}>MOCKUP INTERACTIVO</span>
        <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, marginTop: 8, marginBottom: 12 }}>Las Apps en Acción</h2>
        <p style={{ color: '#555', fontSize: 13, maxWidth: 420, lineHeight: 1.6 }}>
          El Kick Tracker de Rugby Vice es completamente interactivo — selecciona zonas del campo, registra patadas y ve tu progreso.
        </p>
      </div>

      {/* Toggle */}
      <div style={{ display: 'flex', border: '1px solid #2A2A2A', marginBottom: 40 }}>
        <button onClick={() => setActiveApp('golf')} style={{
          padding: '10px 28px', fontWeight: 900, fontSize: 12, letterSpacing: 2, border: 'none', cursor: 'pointer',
          background: activeApp === 'golf' ? '#AAFF00' : 'transparent', color: activeApp === 'golf' ? '#000' : '#555',
          transition: 'all 0.2s',
        }}>⛳ VICEGOLFER</button>
        <button onClick={() => setActiveApp('rugby')} style={{
          padding: '10px 28px', fontWeight: 900, fontSize: 12, letterSpacing: 2, border: 'none', cursor: 'pointer',
          background: activeApp === 'rugby' ? '#00F0FF' : 'transparent', color: activeApp === 'rugby' ? '#000' : '#555',
          transition: 'all 0.2s',
        }}>🏉 RUGBY VICE</button>
      </div>

      {/* iPhone Frame */}
      <div style={{ position: 'relative', width: 320, height: 670, flexShrink: 0 }}>
        {/* Shell */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 44,
          background: 'linear-gradient(145deg, #2e2e2e 0%, #1a1a1a 50%, #0f0f0f 100%)',
          border: '2px solid #333',
          boxShadow: '0 0 0 1px #111, 0 30px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)',
        }} />
        {/* Side buttons */}
        <div style={{ position: 'absolute', left: -3, top: 96, width: 3, height: 30, background: '#222', borderRadius: '3px 0 0 3px' }} />
        <div style={{ position: 'absolute', left: -3, top: 140, width: 3, height: 48, background: '#222', borderRadius: '3px 0 0 3px' }} />
        <div style={{ position: 'absolute', left: -3, top: 208, width: 3, height: 48, background: '#222', borderRadius: '3px 0 0 3px' }} />
        <div style={{ position: 'absolute', right: -3, top: 130, width: 3, height: 64, background: '#222', borderRadius: '0 3px 3px 0' }} />

        {/* Screen */}
        <div style={{ position: 'absolute', top: 12, left: 8, right: 8, bottom: 12, borderRadius: 36, background: '#0A0A0A', overflow: 'hidden' }}>
          {/* Status bar */}
          <div style={{ height: 38, padding: '10px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>9:41</span>
            {/* Dynamic island */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 8, width: 88, height: 22, background: '#000', borderRadius: 11 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Signal bars */}
              <svg width="16" height="11" viewBox="0 0 16 11">
                {[{x:0,h:4},{x:4,h:6},{x:8,h:8},{x:12,h:11}].map((b,i) => (
                  <rect key={i} x={b.x} y={11-b.h} width="3" height={b.h} rx="0.5" fill="white" opacity={0.5+i*0.17} />
                ))}
              </svg>
              {/* WiFi */}
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M7 8.5c.4 0 .75.35.75.75S7.4 10 7 10s-.75-.35-.75-.75.35-.75.75-.75z" fill="white"/>
                <path d="M4.2 6.3C5 5.5 5.95 5 7 5s2 .5 2.8 1.3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M2 4.1C3.4 2.7 5.1 2 7 2s3.6.7 5 2.1" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
              </svg>
              {/* Battery */}
              <div style={{ border: '1px solid rgba(255,255,255,0.5)', borderRadius: 2, padding: '1px 2px', width: 22, height: 12, display: 'flex', alignItems: 'center' }}>
                <div style={{ height: '100%', width: '80%', background: '#fff', borderRadius: 1 }} />
              </div>
            </div>
          </div>

          {/* App content */}
          <div style={{ position: 'absolute', top: 38, left: 0, right: 0, bottom: 0 }}>
            {activeApp === 'golf' ? <GolfScreen /> : <RugbyScreen />}
          </div>
        </div>

        {/* Home indicator */}
        <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', width: 100, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2 }} />
      </div>

      {/* Feature callouts */}
      <div style={{ marginTop: 48, maxWidth: 680, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {features[activeApp].map((f, i) => (
          <div key={i} style={{ border: '1px solid #2A2A2A', background: '#141414', padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
