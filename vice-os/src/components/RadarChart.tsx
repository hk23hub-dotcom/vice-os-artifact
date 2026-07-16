interface RadarChartProps {
  data: { label: string; value: number; max?: number }[]
  size?: number
  color?: string
  secondaryData?: number[]
  showLabels?: boolean
}

export default function RadarChart({ data, size = 120, color = '#AAFF00', secondaryData, showLabels = true }: RadarChartProps) {
  const center = size / 2
  const radius = (size / 2) * 0.72
  const levels = 4
  const n = data.length
  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2

  const toXY = (angle: number, r: number) => ({ x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) })

  const gridPolygons = Array.from({ length: levels }, (_, i) => {
    const r = (radius / levels) * (i + 1)
    return Array.from({ length: n }, (_, j) => {
      const p = toXY(startAngle + j * angleStep, r)
      return `${p.x},${p.y}`
    }).join(' ')
  })

  const dataPoints = data.map((d, i) => toXY(startAngle + i * angleStep, (d.value / (d.max || 100)) * radius))
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  const secondaryPoints = secondaryData?.map((v, i) => toXY(startAngle + i * angleStep, (v / 100) * radius))
  const secondaryPolygon = secondaryPoints?.map(p => `${p.x},${p.y}`).join(' ')

  const labelRadius = radius + 14
  const labels = data.map((d, i) => ({ ...toXY(startAngle + i * angleStep, labelRadius), text: d.label }))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const pt = toXY(startAngle + i * angleStep, radius)
        return <line key={i} x1={center} y1={center} x2={pt.x} y2={pt.y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      })}
      {secondaryPolygon && (
        <polygon points={secondaryPolygon} fill="rgba(0,240,255,0.05)" stroke="rgba(0,240,255,0.3)" strokeWidth="0.8" strokeDasharray="2,2" />
      )}
      <polygon points={dataPolygon} fill={`${color}20`} stroke={color} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
      {dataPoints.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={2} fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      ))}
      {showLabels && labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize="6" fill="#777" fontWeight="600" fontFamily="system-ui,sans-serif">
          {l.text}
        </text>
      ))}
    </svg>
  )
}
