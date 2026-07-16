const NEON = '#AAFF00'
const ELECTRIC = '#00F0FF'

export default function Landing() {
  const pillars = [
    { icon: '⬡', title: 'Identity & Access', desc: 'Una sola cuenta para todos tus deportes. Perfil unificado, historial completo.', color: NEON },
    { icon: '◈', title: 'Performance Tracking', desc: 'DNA de rendimiento por deporte. Sesiones, progresión, métricas sin ruido.', color: ELECTRIC },
    { icon: '▣', title: 'Content Engine', desc: 'Todo se documenta. Sube videos, fotos, mejores momentos. Tu carrera grabada.', color: NEON },
    { icon: '◉', title: 'Community', desc: 'Rankings, clubs privados, feed curado. Solo los que entrenan como tú.', color: ELECTRIC },
  ]

  const golfFeatures = [
    'Performance DNA — Driver · Irons · Short Game · Putting · Mental',
    'Putting Protocol — 100 putts diarios',
    'Caddie Booking (Vice Approved)',
    'Simulator Sessions',
    'Tournament Tracking',
  ]

  const rugbyFeatures = [
    'Kick Tracker — Cancha 2D interactiva con zonas',
    'Performance DNA — Tackle · Ruck · Lineout · Scrum · Cond. · Game IQ',
    'Match Analysis',
    'Recovery Tracking (carga física)',
    'Rugby CV & Mejores Momentos',
    'Ejercicios Mentales',
  ]

  const tiers = [
    { name: 'Starter', price: 'Free', period: '', desc: 'Tracking básico, un deporte', features: ['1 app deportiva', 'Tracking básico', 'Perfil personal'], accent: '#666', bg: '#111' },
    { name: 'Pro', price: '$29', period: '/mes', desc: 'Full tracking + análisis', features: ['1 app deportiva', 'Analytics avanzados', 'Upload videos/fotos', 'Community access'], accent: NEON, bg: '#0D1A00' },
    { name: 'Elite', price: '$79', period: '/mes', desc: 'Multi-deporte + AI insights', features: ['Todas las apps', 'AI performance insights', 'Priority booking', 'Ranking global'], accent: ELECTRIC, bg: '#001A1F', featured: true },
    { name: 'Founder', price: 'Limitado', period: '', desc: 'Acceso vitalicio + beta', features: ['Todo incluido', 'Acceso vitalicio', 'Features beta', 'Direct access'], accent: '#FFD700', bg: '#1A0F00' },
  ]

  return (
    <div style={{ background: '#0A0A0A' }}>
      {/* Hero */}
      <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 48px', overflow: 'hidden' }}>
        {/* Grid bg */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: 80, left: '25%', width: 400, height: 400, borderRadius: '50%', opacity: 0.08, filter: 'blur(80px)', background: NEON }} />
        <div style={{ position: 'absolute', bottom: 80, right: '20%', width: 320, height: 320, borderRadius: '50%', opacity: 0.06, filter: 'blur(80px)', background: ELECTRIC }} />

        <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: NEON, border: `1px solid rgba(170,255,0,0.3)`, padding: '4px 12px' }}>
              VICE OS — SISTEMA OPERATIVO DEPORTIVO
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(64px, 12vw, 160px)', fontWeight: 900, lineHeight: 0.9, letterSpacing: -4, marginBottom: 24 }}>
            <span style={{ display: 'block', color: '#fff' }}>VICE</span>
            <span style={{ display: 'block', color: NEON, textShadow: '0 0 60px rgba(170,255,0,0.35)' }}>OS</span>
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', color: '#888', maxWidth: 640, marginBottom: 4, fontStyle: 'italic', fontWeight: 300 }}>
            "Un vicio no es un hobby.
          </p>
          <p style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', color: '#fff', maxWidth: 640, marginBottom: 40, fontStyle: 'italic', fontWeight: 300 }}>
            Es lo que la obsesión parece desde afuera."
          </p>

          <p style={{ color: '#555', fontSize: 15, maxWidth: 480, marginBottom: 48, lineHeight: 1.7 }}>
            El sistema operativo del rendimiento deportivo.<br />
            Una identidad. Dos disciplinas. Datos sin filtro.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ border: `1px solid rgba(170,255,0,0.4)`, background: '#0D1A00', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
              <span style={{ fontSize: 28 }}>⛳</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>VICEGOLFER</div>
                <div style={{ fontSize: 10, color: '#555', letterSpacing: 2 }}>Golf Performance OS</div>
              </div>
              <span style={{ fontSize: 9, border: `1px solid rgba(170,255,0,0.3)`, color: NEON, padding: '2px 6px', fontWeight: 700, letterSpacing: 2 }}>ACTIVO</span>
            </div>
            <div style={{ border: `1px solid rgba(0,240,255,0.4)`, background: '#00181F', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
              <span style={{ fontSize: 28 }}>🏉</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>RUGBY VICE</div>
                <div style={{ fontSize: 10, color: '#555', letterSpacing: 2 }}>Rugby Performance OS</div>
              </div>
              <span style={{ fontSize: 9, border: `1px solid rgba(0,240,255,0.3)`, color: ELECTRIC, padding: '2px 6px', fontWeight: 700, letterSpacing: 2 }}>NUEVO</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Pillars */}
      <section style={{ padding: '80px 48px', borderTop: '1px solid #1C1C1C' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: '#555', marginBottom: 12 }}>EL ECOSISTEMA</div>
          <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1, marginBottom: 48 }}>Los 4 pilares de VICE OS</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', border: '1px solid #2A2A2A' }}>
            {pillars.map((p, i) => (
              <div key={i} style={{ borderRight: i < 3 ? '1px solid #2A2A2A' : 'none', padding: 32 }}>
                <div style={{ fontSize: 28, color: p.color, marginBottom: 12 }}>{p.icon}</div>
                <h3 style={{ fontWeight: 900, fontSize: 16, marginBottom: 10, letterSpacing: -0.5 }}>{p.title}</h3>
                <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apps */}
      <section style={{ padding: '80px 48px', borderTop: '1px solid #1C1C1C' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: '#555', marginBottom: 12 }}>LAS APPS</div>
          <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1, marginBottom: 48 }}>Dos obsesiones. Un sistema.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Golf */}
            <div style={{ border: `1px solid rgba(170,255,0,0.2)`, padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 36 }}>⛳</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>VICEGOLFER</div>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 2 }}>GOLF PERFORMANCE OS</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {golfFeatures.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#ccc' }}>
                    <span style={{ color: NEON, fontWeight: 700, marginTop: 1 }}>→</span>{f}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #2A2A2A' }}>
                <div style={{ fontSize: 9, color: NEON, fontWeight: 700, letterSpacing: 2 }}>STATUS</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>En desarrollo activo</div>
              </div>
            </div>
            {/* Rugby */}
            <div style={{ border: `1px solid rgba(0,240,255,0.2)`, padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: 36 }}>🏉</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>RUGBY VICE</div>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 2 }}>RUGBY PERFORMANCE OS</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rugbyFeatures.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#ccc' }}>
                    <span style={{ color: ELECTRIC, fontWeight: 700, marginTop: 1 }}>→</span>{f}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #2A2A2A' }}>
                <div style={{ fontSize: 9, color: ELECTRIC, fontWeight: 700, letterSpacing: 2 }}>STATUS</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Lanzamiento próximo</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section style={{ padding: '80px 48px', borderTop: '1px solid #1C1C1C' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: '#555', marginBottom: 12 }}>MEMBRESÍA</div>
          <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1, marginBottom: 48 }}>Elige tu nivel de obsesión</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {tiers.map((t, i) => (
              <div key={i} style={{ background: t.bg, border: `1px solid ${(t as any).featured ? ELECTRIC : '#2A2A2A'}`, padding: 24, position: 'relative', boxShadow: (t as any).featured ? `0 0 0 1px ${ELECTRIC}` : 'none' }}>
                {(t as any).featured && (
                  <div style={{ position: 'absolute', top: -10, left: 16, background: ELECTRIC, color: '#000', fontSize: 9, fontWeight: 700, letterSpacing: 2, padding: '2px 8px' }}>MÁS POPULAR</div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: t.accent, marginBottom: 6 }}>{t.name.toUpperCase()}</div>
                <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>
                  {t.price}<span style={{ fontSize: 13, fontWeight: 400, color: '#555' }}>{t.period}</span>
                </div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 20 }}>{t.desc}</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {t.features.map((f, j) => (
                    <li key={j} style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: t.accent }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 48px', borderTop: '1px solid #1C1C1C', textAlign: 'center' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <p style={{ fontSize: 10, color: '#555', letterSpacing: 4, marginBottom: 16 }}>¿LISTO?</p>
          <h2 style={{ fontSize: 'clamp(40px,7vw,100px)', fontWeight: 900, letterSpacing: -2, marginBottom: 32, lineHeight: 0.95 }}>
            El rendimiento<br />
            <span style={{ color: NEON }}>no es opcional.</span>
          </h2>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button style={{ padding: '12px 32px', fontWeight: 900, fontSize: 12, letterSpacing: 2, background: NEON, color: '#000', border: 'none', cursor: 'pointer' }}>
              UNIRSE AHORA
            </button>
            <button style={{ padding: '12px 32px', fontWeight: 900, fontSize: 12, letterSpacing: 2, background: 'none', color: '#fff', border: '1px solid #2A2A2A', cursor: 'pointer' }}>
              VER DEMO
            </button>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #1C1C1C', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 900, letterSpacing: -0.5, color: NEON }}>VICE</span>
          <span style={{ fontWeight: 900, letterSpacing: -0.5 }}>OS</span>
        </div>
        <div style={{ fontSize: 11, color: '#333' }}>© 2026 Vice OS. Todos los derechos reservados.</div>
      </footer>
    </div>
  )
}
