'use client';
import type { MonteCarloPercentileSeries } from '@/server/monteCarlo/types';

interface BandChartProps {
  bands: MonteCarloPercentileSeries;
  height?: number;
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

/**
 * SVG percentile band chart for Monte Carlo portfolio balance over time.
 * Renders P10–P90 shaded bands and the P50 median line.
 * Pure SVG — no external chart library required.
 */
export function BandChart({ bands, height = 260 }: BandChartProps) {
  const { years, p10, p25, p50, p75, p90 } = bands;
  if (!years.length) return null;

  const W = 700, H = height;
  const PL = 52, PR = 16, PT = 12, PB = 36;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;
  const n = years.length;

  const allValues = [...p10, ...p90].filter(v => v > 0);
  const yMax = allValues.length > 0 ? Math.max(...allValues) * 1.05 : 1;
  const yMin = Math.min(0, ...p10);
  const yRange = yMax - yMin || 1;

  const toX = (i: number) => PL + (i / Math.max(n - 1, 1)) * plotW;
  const toY = (v: number) => PT + plotH - ((v - yMin) / yRange) * plotH;

  const polyline = (data: number[]) =>
    data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  // Closed polygon for bands: forward through top curve, backward through bottom
  const band = (top: number[], bottom: number[]): string => {
    const fwd = top.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    const bwd = bottom
      .slice()
      .reverse()
      .map((v, i) => `${toX(n - 1 - i)},${toY(v)}`)
      .join(' ');
    return `${fwd} ${bwd}`;
  };

  const tickCount = Math.min(7, n);
  const tickIdxs = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / Math.max(tickCount - 1, 1)) * (n - 1))
  );

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    yMin + (i / (yTicks - 1)) * yRange
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Y-axis ticks */}
      {yTickValues.map((v, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={toY(v)} y2={toY(v)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={PL - 4} y={toY(v) + 4} textAnchor="end" fontSize="8" fill="#94a3b8">
            {fmtM(v)}
          </text>
        </g>
      ))}

      {/* P10–P90 outer band (very light) */}
      <polygon points={band(p90, p10)} fill="#3b82f6" fillOpacity="0.08" />
      {/* P25–P75 inner band */}
      <polygon points={band(p75, p25)} fill="#3b82f6" fillOpacity="0.16" />

      {/* P50 median line */}
      <polyline
        points={polyline(p50)}
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Zero line if applicable */}
      {yMin < 0 && (
        <line x1={PL} x2={W - PR} y1={toY(0)} y2={toY(0)} stroke="#e2e8f0" strokeDasharray="4" />
      )}

      {/* X-axis year labels */}
      {tickIdxs.map(i => (
        <text key={i} x={toX(i)} y={H - PB + 14} textAnchor="middle" fontSize="8" fill="#94a3b8">
          {years[i]}
        </text>
      ))}

      {/* Legend */}
      <g transform={`translate(${PL}, ${H - 12})`}>
        <rect width="10" height="10" rx="2" fill="#3b82f6" fillOpacity="0.25" />
        <text x="14" y="9" fontSize="8" fill="#64748b">P10–P90 range</text>
        <rect x="95" width="10" height="10" rx="2" fill="#3b82f6" fillOpacity="0.45" />
        <text x="109" y="9" fontSize="8" fill="#64748b">P25–P75 range</text>
        <line x1="195" y1="5" x2="205" y2="5" stroke="#2563eb" strokeWidth="2" />
        <text x="209" y="9" fontSize="8" fill="#64748b">Median (P50)</text>
      </g>
    </svg>
  );
}
