import RadarChart from './RadarChart'

const dnaData = [
  { label: 'Driver', value: 78 },
  { label: 'Irons', value: 65 },
  { label: 'Short', value: 82 },
  { label: 'Putting', value: 71 },
  { label: 'Mental', value: 59 },
]
const personalBest = [88, 72, 85, 80, 68]

const S: Record<string, React.CSSProperties> = {
  screen: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', color: '#fff', overflow: 'hidden' },
  header: { padding: '10px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1C1C1C' },
  scroll: { flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#141414', border: '1px solid #2A2A2A', padding: '12px' },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 8 },
  bottomNav: { borderTop: '1px solid #1C1C1C', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: '#0A0A0A' },
}

export default function GolfScreen() {
  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: -0.5, color: '#AAFF00' }}>VICEGOLFER</div>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 2 }}>PERFORMANCE DNA</div>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1C1C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
      </div>

      <div style={S.scroll} className="scrollbar-hide">
        {/* DNA Radar */}
        <div style={S.card}>
          <div style={S.label}>PERFORMANCE DNA</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RadarChart data={dnaData} size={130} color="#AAFF00" secondaryData={personalBest} showLabels />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dnaData.map((d, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: '#888' }}>{d.label}</span>
                    <span style={{ fontWeight: 700 }}>{d.value}</span>
                  </div>
                  <div style={{ height: 3, background: '#2A2A2A', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${d.value}%`, background: '#AAFF00', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 8, borderTop: '1px solid #2A2A2A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#444' }}>
              <div style={{ width: 12, height: 1.5, background: '#AAFF00', borderRadius: 1 }} />
              <span>Sesión actual</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#444' }}>
              <div style={{ width: 12, height: 1.5, borderTop: '1px dashed rgba(0,240,255,0.4)' }} />
              <span>Mejor personal</span>
            </div>
          </div>
        </div>

        {/* Session stats */}
        <div style={S.card}>
          <div style={S.label}>HOY — RONDA AM</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center' }}>
            {[
              { label: 'GHI', value: '74', sub: '−2', color: '#AAFF00' },
              { label: 'PUTTS', value: '28', sub: 'ronda', color: '#fff' },
              { label: 'FIR', value: '71%', sub: 'fairways', color: '#00F0FF' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#555' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Putting Protocol */}
        <div style={{ ...S.card, background: '#0D1A00', border: '1px solid rgba(170,255,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ ...S.label, color: '#AAFF00', marginBottom: 0 }}>PUTTING PROTOCOL</div>
            <div style={{ fontSize: 9, color: '#555' }}>67/100</div>
          </div>
          <div style={{ height: 6, background: '#1C1C1C', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '67%', background: '#AAFF00', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 9, color: '#555', marginTop: 4 }}>33 putts restantes hoy</div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[{ label: 'Reservar Caddie', icon: '👤' }, { label: 'Simulator', icon: '🎯' }].map((a, i) => (
            <button key={i} style={{ ...S.card, textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{a.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={S.bottomNav}>
        {[
          { icon: '⊞', label: 'Home', active: true },
          { icon: '◎', label: 'Track' },
          { icon: '◈', label: 'Book' },
          { icon: '◉', label: 'Social' },
          { icon: '▣', label: 'Perfil' },
        ].map((n, i) => (
          <button key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 2, fontSize: 9, fontWeight: 700, letterSpacing: 1, background: 'none', border: 'none', color: n.active ? '#AAFF00' : '#444', cursor: 'pointer' }}>
            <span style={{ fontSize: 14 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
