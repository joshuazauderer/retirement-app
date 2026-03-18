interface DataPoint { x: number; y: number }
interface Series { data: DataPoint[]; color: string; name: string }

export function SimpleLineChart({ series, height = 220 }: { series: Series[]; height?: number }) {
  if (!series.length || !series[0].data.length) return null;
  const allY = series.flatMap(s => s.data.map(d => d.y));
  const allX = series[0].data.map(d => d.x);
  const yMin = Math.min(0, ...allY);
  const yMax = Math.max(...allY) || 1;
  const yRange = yMax - yMin || 1;
  const W = 700, H = height, PL = 10, PR = 10, PT = 10, PB = 40;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const n = allX.length;
  const toX = (i: number) => PL + (i / Math.max(n - 1, 1)) * plotW;
  const toY = (v: number) => PT + plotH - ((v - yMin) / yRange) * plotH;
  const tickCount = Math.min(8, n);
  const tickIdxs = Array.from({ length: tickCount }, (_, i) => Math.round((i / Math.max(tickCount - 1, 1)) * (n - 1)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yMin < 0 && <line x1={PL} x2={W - PR} y1={toY(0)} y2={toY(0)} stroke="#e2e8f0" strokeDasharray="4" />}
      {series.map((s, si) => (
        <polyline key={si} points={s.data.map((_, i) => `${toX(i)},${toY(s.data[i].y)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" />
      ))}
      {tickIdxs.map(i => (
        <text key={i} x={toX(i)} y={H - PB + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">{allX[i]}</text>
      ))}
      {series.map((s, i) => (
        <g key={i} transform={`translate(${PL + i * 130}, ${H - 14})`}>
          <rect width="10" height="3" y="3" fill={s.color} rx="1" />
          <text x="14" y="9" fontSize="9" fill="#64748b">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}
