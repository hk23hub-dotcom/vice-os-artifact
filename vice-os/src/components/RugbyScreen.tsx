import { useState } from 'react'
import RadarChart from './RadarChart'

const ZONES = [
  { id: 'ala-izq', name: 'Ala Izquierda', pts: '5,5 90,5 90,88 5,88', dist: '5-20m', angle: '40°+', cx: 47, cy: 46 },
  { id: 'centro-corto', name: 'Frente — Corto', pts: '90,5 170,5 170,88 90,88', dist: '0-22m', angle: 'Recto', cx: 130, cy: 46 },
  { id: 'ala-der', name: 'Ala Derecha', pts: '170,5 255,5 255,88 170,88', dist: '5-20m', angle: '40°+', cx: 212, cy: 46 },
  { id: 'izq-medio', name: 'Izquierda — Medio', pts: '5,88 80,88 80,148 5,148', dist: '22-35m', angle: '25-45°', cx: 42, cy: 118 },
  { id: 'centro-medio', name: 'Centro — Medio', pts: '80,88 180,88 180,148 80,148', dist: '22-35m', angle: 'Recto', cx: 130, cy: 118 },
  { id: 'der-medio', name: 'Derecha — Medio', pts: '180,88 255,88 255,148 180,148', dist: '22-35m', angle: '25-45°', cx: 217, cy: 118 },
  { id: 'izq-largo', name: 'Izquierda — Largo', pts: '5,148 75,148 75,185 5,185', dist: '35-50m', angle: '30°+', cx: 40, cy: 166 },
  { id: 'centro-largo', name: 'Centro — Largo', pts: '75,148 185,148 185,185 75,185', dist: '35-50m', angle: 'Recto', cx: 130, cy: 166 },
  { id: 'der-largo', name: 'Derecha — Largo', pts: '185,148 255,148 255,185 185,185', dist: '35-50m', angle: '30°+', cx: 220, cy: 166 },
]

interface KickData { makes: number; attempts: number }
type KickMap = Record<string, KickData>

const initialData: KickMap = {
  'ala-izq': { makes: 5, attempts: 8 },
  'centro-corto': { makes: 10, attempts: 11 },
  'ala-der': { makes: 4, attempts: 7 },
  'izq-medio': { makes: 6, attempts: 12 },
  'centro-medio': { makes: 9, attempts: 12 },
  'der-medio': { makes: 7, attempts: 13 },
  'izq-largo': { makes: 2, attempts: 6 },
  'centro-largo': { makes: 5, attempts: 9 },
  'der-largo': { makes: 1, attempts: 5 },
}

function pct(d: KickData) { return d.attempts === 0 ? 0 : Math.round(d.makes / d.attempts * 100) }
function pctColor(p: number) { return p >= 70 ? '#AAFF00' : p >= 45 ? '#FFD700' : '#FF4040' }

const dnaData = [
  { label: 'Tackle', value: 72 }, { label: 'Ruck', value: 68 }, { label: 'Lineout', value: 55 },
  { label: 'Scrum', value: 80 }, { label: 'Cond.', value: 76 }, { label: 'Game IQ', value: 65 }, { label: 'Kicking', value: 71 },
]

function KickTracker() {
  const [kickData, setKickData] = useState<KickMap>(initialData)
  const [selected, setSelected] = useState<string>('centro-corto')
  const [hovered, setHovered] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [result, setResult] = useState<'make' | 'miss'>('make')
  const [note, setNote] = useState('')

  const totalMakes = Object.values(kickData).reduce((s, d) => s + d.makes, 0)
  const totalAttempts = Object.values(kickData).reduce((s, d) => s + d.attempts, 0)
  const totalPct = totalAttempts > 0 ? Math.round(totalMakes / totalAttempts * 100) : 0

  const selData = kickData[selected]
  const selZone = ZONES.find(z => z.id === selected)

  function addKick() {
    if (!selected) return
    setKickData(prev => {
      const d = prev[selected]
      return { ...prev, [selected]: { makes: d.makes + (result === 'make' ? 1 : 0), attempts: d.attempts + 1 } }
    })
    setNote('')
    setShowModal(false)
  }

  const radarData = ZONES.map(z => ({ label: z.id.slice(0, 4), value: pct(kickData[z.id]), max: 100 }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1C1C1C', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#00F0FF' }}>KICK TRACKER</div>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 2 }}>SESIÓN ACTIVA</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{totalMakes}/{totalAttempts}</div>
            <div style={{ fontSize: 8, color: '#444', letterSpacing: 1 }}>PATADAS</div>
          </div>
          <div style={{ width: 1, height: 24, background: '#2A2A2A' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: pctColor(totalPct) }}>{totalPct}%</div>
            <div style={{ fontSize: 8, color: '#444', letterSpacing: 1 }}>ACIERTO</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="scrollbar-hide">
        {/* SVG Field */}
        <div style={{ padding: '10px 10px 0' }}>
          <div style={{ fontSize: 8, color: '#444', letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>SELECCIONA ZONA</div>
          <div style={{ border: '1px solid #1C1C1C', overflow: 'hidden' }}>
            <svg viewBox="0 0 260 195" style={{ width: '100%', height: 'auto', background: '#0D1E0D', display: 'block' }}>
              {/* Grass stripes */}
              {[0,1,2,3,4,5].map(i => (
                <rect key={i} x="5" y={5+i*32} width="250" height="16" fill="rgba(255,255,255,0.012)" />
              ))}
              {/* Field border */}
              <rect x="5" y="5" width="250" height="185" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              {/* Try line */}
              <line x1="5" y1="5" x2="255" y2="5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
              {/* 22m line */}
              <line x1="5" y1="88" x2="255" y2="88" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
              <text x="258" y="91" fontSize="5" fill="rgba(255,255,255,0.3)">22m</text>
              {/* 35m line */}
              <line x1="5" y1="148" x2="255" y2="148" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
              <text x="258" y="151" fontSize="5" fill="rgba(255,255,255,0.2)">35m</text>
              {/* Center dashed */}
              <line x1="130" y1="5" x2="130" y2="190" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3,3" />
              {/* Goalposts */}
              <line x1="115" y1="3" x2="145" y2="3" stroke="#FFD700" strokeWidth="1.8" />
              <line x1="115" y1="3" x2="115" y2="-5" stroke="#FFD700" strokeWidth="1.8" />
              <line x1="145" y1="3" x2="145" y2="-5" stroke="#FFD700" strokeWidth="1.8" />
              <line x1="130" y1="3" x2="130" y2="10" stroke="#FFD700" strokeWidth="1" opacity="0.5" />
              {/* Kick zones */}
              {ZONES.map(z => {
                const d = kickData[z.id]
                const p = pct(d)
                const isSel = selected === z.id
                const isHov = hovered === z.id
                let fill = 'rgba(255,255,255,0.025)'
                let stroke = 'rgba(255,255,255,0.06)'
                let sw = 0.5
                if (isSel) { fill = 'rgba(0,240,255,0.18)'; stroke = '#00F0FF'; sw = 1.5 }
                else if (isHov) { fill = 'rgba(170,255,0,0.1)'; stroke = '#AAFF00'; sw = 1 }
                else if (d.attempts > 0) {
                  const rgb = p >= 70 ? '170,255,0' : p >= 45 ? '255,210,0' : '255,60,60'
                  fill = `rgba(${rgb},0.06)`
                }
                return (
                  <g key={z.id} onClick={() => setSelected(z.id)} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHovered(z.id)} onMouseLeave={() => setHovered(null)}>
                    <polygon points={z.pts} fill={fill} stroke={stroke} strokeWidth={sw} />
                    {d.attempts > 0 && (
                      <>
                        <circle cx={z.cx} cy={z.cy} r="9" fill="rgba(0,0,0,0.75)" />
                        <text x={z.cx} y={z.cy} textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="700" fill={pctColor(p)} fontFamily="system-ui,sans-serif">{p}%</text>
                      </>
                    )}
                    {d.attempts === 0 && (
                      <text x={z.cx} y={z.cy} textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="rgba(255,255,255,0.15)" fontFamily="system-ui,sans-serif">—</text>
                    )}
                  </g>
                )
              })}
              {/* Ball marker */}
              {selected && (() => {
                const z = ZONES.find(z => z.id === selected)!
                return <text x={z.cx} y={z.cy + 14} textAnchor="middle" fontSize="9" opacity="0.7">🏉</text>
              })()}
            </svg>
          </div>
        </div>

        {/* Selected zone stats */}
        {selData && selZone && (
          <div style={{ margin: '8px 10px 0', background: '#0A1A0A', border: '1px solid rgba(0,240,255,0.2)', padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#00F0FF', letterSpacing: 2 }}>{selZone.name.toUpperCase()}</div>
                <div style={{ fontSize: 8, color: '#444' }}>{selZone.dist} · {selZone.angle}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: pctColor(pct(selData)) }}>{pct(selData)}%</div>
                <div style={{ fontSize: 8, color: '#555' }}>{selData.makes}/{selData.attempts}</div>
              </div>
            </div>
            <div style={{ height: 4, background: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct(selData)}%`, background: pctColor(pct(selData)), borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 8, color: '#555' }}>
              <span>✓ {selData.makes} convertidas</span>
              <span>✗ {selData.attempts - selData.makes} fallidas</span>
            </div>
          </div>
        )}

        {/* Radar */}
        <div style={{ margin: '8px 10px 0', background: '#141414', border: '1px solid #2A2A2A', padding: 10 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 6 }}>MAPA DE RENDIMIENTO</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RadarChart data={radarData} size={90} color="#00F0FF" showLabels />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ZONES.slice(0, 6).map(z => {
                const p = pct(kickData[z.id])
                return (
                  <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, color: '#555', width: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name.split('—')[0].trim()}</span>
                    <div style={{ flex: 1, height: 3, background: '#2A2A2A', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p}%`, background: pctColor(p), borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 700, color: pctColor(p), minWidth: 22, textAlign: 'right' }}>{p}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ margin: '8px 10px 12px', background: '#141414', border: '1px solid #2A2A2A', padding: 10 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 4 }}>NOTAS DE SESIÓN</div>
          <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>"Mejorar postura en ala izquierda. Wind compensation."</div>
        </div>
      </div>

      {/* Add kick */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #1C1C1C' }}>
        <button onClick={() => setShowModal(true)} style={{
          width: '100%', padding: '10px', fontWeight: 900, fontSize: 11, letterSpacing: 2,
          background: '#00F0FF', color: '#000', border: 'none', cursor: 'pointer',
        }}>
          + REGISTRAR PATADA
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 10 }}>
          <div style={{ background: '#141414', borderTop: '1px solid #2A2A2A', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: -0.5 }}>REGISTRAR PATADA</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: 2 }}>{selZone?.name.toUpperCase()}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setResult('make')} style={{ flex: 1, padding: 12, fontWeight: 900, fontSize: 13, border: 'none', cursor: 'pointer', background: result === 'make' ? '#AAFF00' : '#1C1C1C', color: result === 'make' ? '#000' : '#555' }}>
                ✓ MAKE
              </button>
              <button onClick={() => setResult('miss')} style={{ flex: 1, padding: 12, fontWeight: 900, fontSize: 13, border: 'none', cursor: 'pointer', background: result === 'miss' ? '#FF4040' : '#1C1C1C', color: result === 'miss' ? '#fff' : '#555' }}>
                ✗ MISS
              </button>
            </div>
            <input
              type="text" placeholder="Nota opcional..." value={note} onChange={e => setNote(e.target.value)}
              style={{ background: '#0A0A0A', border: '1px solid #2A2A2A', padding: '8px 10px', fontSize: 11, color: '#fff', outline: 'none', width: '100%' }}
            />
            <button onClick={addKick} style={{ width: '100%', padding: 12, fontWeight: 900, fontSize: 12, letterSpacing: 2, background: '#AAFF00', color: '#000', border: 'none', cursor: 'pointer' }}>
              CONFIRMAR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function VideoTab() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="scrollbar-hide">
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 8 }}>MI CONTENIDO</div>
      <button style={{
        width: '100%', border: '1px dashed rgba(0,240,255,0.3)', background: 'none',
        padding: '20px 0', textAlign: 'center', cursor: 'pointer', marginBottom: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
      }}>
        <div style={{ fontSize: 22, color: '#00F0FF' }}>↑</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#555' }}>SUBIR VIDEO / FOTO</div>
        <div style={{ fontSize: 8, color: '#333' }}>MP4, MOV, JPG, PNG</div>
      </button>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 8 }}>MEJORES MOMENTOS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
        {[
          { label: 'Try vs Los Leones', e: '🏉' }, { label: 'Entrenamiento', e: '💪' },
          { label: 'Drop Goal 45m', e: '🎯' }, { label: 'Match Day', e: '🏟️' },
          { label: 'Tackle perfecto', e: '🔥' }, { label: 'Lineout win', e: '✋' },
        ].map((m, i) => (
          <div key={i} style={{ aspectRatio: '1', background: '#141414', border: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>{m.e}</span>
            <span style={{ fontSize: 7, color: '#555', textAlign: 'center', padding: '0 2px' }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProfileTab() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="scrollbar-hide">
      <div style={{ background: '#141414', border: '1px solid #2A2A2A', padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 8 }}>RUGBY CV</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { l: 'POSICIÓN', v: 'Apertura / 10' }, { l: 'EDAD', v: '24 años' },
            { l: 'CLUB', v: 'CR Santiago' }, { l: 'EXP.', v: '8 temporadas' },
          ].map((f, i) => (
            <div key={i}>
              <div style={{ fontSize: 7, color: '#444', letterSpacing: 2, fontWeight: 700 }}>{f.l}</div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{f.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#141414', border: '1px solid #2A2A2A', padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 8 }}>PERFORMANCE DNA</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <RadarChart data={dnaData} size={140} color="#00F0FF" showLabels />
        </div>
      </div>

      <div style={{ background: '#0A0018', border: '1px solid rgba(168,85,247,0.2)', padding: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#A855F7', marginBottom: 8 }}>EJERCICIOS MENTALES</div>
        {[
          { name: 'Visualización Pre-Patada', dur: '5 min', done: true },
          { name: 'Respiración 4-7-8', dur: '3 min', done: true },
          { name: 'Rutina de Presión', dur: '15 min', done: false },
          { name: 'Revisión de Errores', dur: '10 min', done: false },
        ].map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < 3 ? '1px solid #1C1C1C' : 'none' }}>
            <div style={{ width: 14, height: 14, border: `1px solid ${e.done ? '#AAFF00' : '#2A2A2A'}`, background: e.done ? '#AAFF00' : 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#000', fontWeight: 900 }}>
              {e.done ? '✓' : ''}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: e.done ? '#fff' : '#666' }}>{e.name}</div>
              <div style={{ fontSize: 8, color: '#444' }}>{e.dur}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type Tab = 'kick' | 'video' | 'profile' | 'team'

export default function RugbyScreen() {
  const [tab, setTab] = useState<Tab>('kick')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', color: '#fff' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {tab === 'kick' && <KickTracker />}
        {tab === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1C1C1C' }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>MI CONTENIDO</div>
              <div style={{ fontSize: 9, color: '#444', letterSpacing: 2 }}>VIDEOS & FOTOS</div>
            </div>
            <VideoTab />
          </div>
        )}
        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1C1C1C', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1C1C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏉</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>RUGBY CV</div>
                <div style={{ fontSize: 9, color: '#444', letterSpacing: 2 }}>PERFIL DE JUGADOR</div>
              </div>
            </div>
            <ProfileTab />
          </div>
        )}
        {tab === 'team' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: 12 }}>
            Team / Club — próximamente
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #1C1C1C', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: '#0A0A0A', flexShrink: 0 }}>
        {([
          { id: 'kick' as Tab, icon: '🎯', label: 'Patadas' },
          { id: 'video' as Tab, icon: '▶', label: 'Clips' },
          { id: 'profile' as Tab, icon: '◉', label: 'Perfil' },
          { id: 'team' as Tab, icon: '◈', label: 'Team' },
          { id: 'kick' as Tab, icon: '⊞', label: 'Home' },
        ]).map((n, i) => (
          <button key={i} onClick={() => setTab(n.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 2,
            fontSize: 9, fontWeight: 700, letterSpacing: 1, background: 'none', border: 'none',
            color: tab === n.id ? '#00F0FF' : '#444', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 13 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
