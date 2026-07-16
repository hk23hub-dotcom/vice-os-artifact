const NEON = '#AAFF00'
const ELECTRIC = '#00F0FF'

export default function Architecture() {
  const techStack = [
    { name: 'Next.js 15', color: '#fff', bg: '#141414', desc: 'App framework' },
    { name: 'Supabase', color: '#3ECF8E', bg: '#0D1F17', desc: 'Auth + DB + Storage' },
    { name: 'Stripe', color: '#635BFF', bg: '#0D0C1F', desc: 'Membresías & billing' },
    { name: 'Vercel', color: '#fff', bg: '#111', desc: 'Deploy & edge' },
    { name: 'React Native', color: '#61DAFB', bg: '#0A1520', desc: 'Mobile (próximo)' },
    { name: 'PostgreSQL', color: '#336791', bg: '#0A0F1A', desc: 'Base de datos' },
  ]

  const dbSchema = [
    { table: 'users', color: NEON, cols: ['id', 'email', 'full_name', 'membership_tier', 'sport_access[]', 'created_at'] },
    { table: 'kick_sessions', color: ELECTRIC, cols: ['id', 'user_id', 'date', 'total_makes', 'total_attempts', 'zone_data (jsonb)'] },
    { table: 'kick_attempts', color: ELECTRIC, cols: ['id', 'session_id', 'zone_id', 'result (make|miss)', 'note', 'timestamp'] },
    { table: 'rugby_profiles', color: '#A855F7', cols: ['id', 'user_id', 'position', 'club', 'dna_scores (jsonb)', 'mental_scores (jsonb)'] },
    { table: 'media_content', color: '#FFD700', cols: ['id', 'user_id', 'sport', 'type (video|photo)', 'url', 'title', 'is_featured'] },
    { table: 'golf_sessions', color: NEON, cols: ['id', 'user_id', 'score', 'putts', 'fairways_hit', 'dna_snapshot (jsonb)'] },
  ]

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100vh', padding: '64px 48px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: '#555', marginBottom: 12 }}>ARQUITECTURA TÉCNICA</div>
        <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1, marginBottom: 12 }}>Cómo está construido VICE OS</h2>
        <p style={{ color: '#555', fontSize: 13, marginBottom: 64, maxWidth: 560 }}>
          Plataforma modular donde cada vertical deportiva comparte el mismo core de identidad, datos y contenido, pero mantiene su lógica independiente.
        </p>

        {/* Architecture diagram */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 64 }}>
          {/* Tree */}
          <div style={{ border: '1px solid #2A2A2A', background: '#0D0D0D', padding: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, color: '#444', marginBottom: 16 }}>ÁRBOL DE COMPONENTES</div>
            <pre style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8, color: '#888' }}>{`\x1b[0mVICE OS PLATFORM
├── \x1b[32mCore Layer\x1b[0m
│   ├── Auth & Identity (Supabase)
│   ├── User Profile & CV
│   ├── Membership (Stripe)
│   └── Notifications
├── \x1b[36mData Layer\x1b[0m
│   ├── PostgreSQL (Supabase)
│   ├── Storage (video/foto)
│   ├── Realtime subscriptions
│   └── Analytics pipeline
├── \x1b[33mApp Verticals\x1b[0m
│   ├── VICEGOLFER
│   │   ├── Performance DNA (5)
│   │   ├── Putting Protocol
│   │   └── Caddie / Tournaments
│   └── RUGBY VICE
│       ├── Kick Tracker 2D
│       ├── Performance DNA (7)
│       ├── Rugby CV
│       └── Mental Exercises
└── \x1b[35mShared Modules\x1b[0m
    ├── Content Engine
    ├── Ranking (cross-sport)
    ├── Community Feed
    └── Analytics Dashboard`}</pre>
          </div>

          {/* Visual boxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Platform wrapper */}
            <div style={{ border: `2px solid rgba(170,255,0,0.25)`, padding: 16, position: 'relative' }}>
              <div style={{ position: 'absolute', top: -10, left: 12, background: '#0A0A0A', padding: '0 8px', fontSize: 10, fontWeight: 900, letterSpacing: 2, color: NEON }}>VICE OS PLATFORM</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ border: `1px solid rgba(170,255,0,0.2)`, background: '#0D1A00', padding: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: NEON, marginBottom: 8 }}>CORE LAYER</div>
                  {['Auth', 'Profile', 'Billing', 'Notifications'].map(t => (
                    <div key={t} style={{ fontSize: 9, color: '#555', padding: '2px 0', borderBottom: '1px solid #1C1C1C' }}>{t}</div>
                  ))}
                </div>
                <div style={{ border: `1px solid rgba(0,240,255,0.2)`, background: '#00181F', padding: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: ELECTRIC, marginBottom: 8 }}>DATA LAYER</div>
                  {['PostgreSQL', 'Storage', 'Realtime', 'Analytics'].map(t => (
                    <div key={t} style={{ fontSize: 9, color: '#555', padding: '2px 0', borderBottom: '1px solid #1C1C1C' }}>{t}</div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ border: `1px solid rgba(170,255,0,0.3)`, background: '#0A1200', padding: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: NEON, marginBottom: 8 }}>⛳ VICEGOLFER</div>
                  {['DNA (5 ejes)', 'Putting Protocol', 'Caddie Booking', 'Tournaments'].map(t => (
                    <div key={t} style={{ fontSize: 9, color: '#555', padding: '2px 0', borderBottom: '1px solid #1C1C1C' }}>{t}</div>
                  ))}
                </div>
                <div style={{ border: `1px solid rgba(0,240,255,0.3)`, background: '#001A20', padding: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: ELECTRIC, marginBottom: 8 }}>🏉 RUGBY VICE</div>
                  {['Kick Tracker 2D', 'DNA (7 ejes)', 'Rugby CV', 'Mental'].map(t => (
                    <div key={t} style={{ fontSize: 9, color: '#555', padding: '2px 0', borderBottom: '1px solid #1C1C1C' }}>{t}</div>
                  ))}
                </div>
              </div>

              <div style={{ border: `1px solid rgba(168,85,247,0.3)`, background: '#0F0A1A', padding: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#A855F7', marginBottom: 8 }}>SHARED MODULES</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Content Engine', 'Rankings', 'Community', 'Dashboard'].map(t => (
                    <span key={t} style={{ fontSize: 9, color: 'rgba(168,85,247,0.6)', border: '1px solid rgba(168,85,247,0.2)', padding: '2px 6px' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, color: '#444', marginBottom: 20 }}>TECH STACK</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
            {techStack.map((t, i) => (
              <div key={i} style={{ border: '1px solid #2A2A2A', background: t.bg, padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: t.color, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* DB Schema */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, color: '#444', marginBottom: 20 }}>ESQUEMA DE BASE DE DATOS — Supabase / PostgreSQL</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {dbSchema.map((t, i) => (
              <div key={i} style={{ border: '1px solid #2A2A2A', background: '#0D0D0D', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #2A2A2A', borderLeft: `3px solid ${t.color}` }}>
                  <div style={{ fontWeight: 900, fontSize: 11, letterSpacing: 1, color: t.color }}>{t.table}</div>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  {t.cols.map((c, j) => (
                    <div key={j} style={{ fontSize: 10, color: '#555', padding: '2px 0', borderBottom: j < t.cols.length - 1 ? '1px solid #1C1C1C' : 'none', fontFamily: 'monospace' }}>{c}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Data Flow */}
        <section>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, color: '#444', marginBottom: 20 }}>FLUJO DE DATOS — KICK TRACKER</div>
          <div style={{ border: '1px solid #2A2A2A', background: '#0D0D0D', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {[
                { step: '1', label: 'Usuario selecciona zona', color: ELECTRIC },
                null,
                { step: '2', label: 'Toca "Registrar patada"', color: ELECTRIC },
                null,
                { step: '3', label: 'Make / Miss + Nota', color: NEON },
                null,
                { step: '4', label: 'INSERT kick_attempts', color: '#A855F7' },
                null,
                { step: '5', label: 'UPDATE kick_sessions', color: '#A855F7' },
                null,
                { step: '6', label: 'Realtime → UI actualiza %', color: NEON },
              ].map((s, i) =>
                s === null ? (
                  <span key={i} style={{ color: '#333', fontSize: 20, fontWeight: 700 }}>→</span>
                ) : (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #2A2A2A', padding: '8px 12px' }}>
                    <span style={{ fontWeight: 900, fontSize: 18, color: s.color }}>{s.step}</span>
                    <span style={{ fontSize: 11, color: '#666' }}>{s.label}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
