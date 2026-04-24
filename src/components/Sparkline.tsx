// Dependency-free sparkline. Tiny SVG line + area fill, intended to sit inline
// next to a KPI number so readers can see the "shape" of the day.

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Index of the peak value — highlighted with a dot if set. */
  highlightIndex?: number | null;
}

export default function Sparkline({
  data,
  width = 120,
  height = 36,
  color = 'var(--color-primary)',
  highlightIndex = null,
}: Props) {
  if (data.length === 0) {
    return <div style={{ width, height }} className="text-[10px] text-[var(--color-text-dim)] flex items-center justify-center">—</div>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const y = (v: number) => height - ((v - min) / range) * (height - 4) - 2;

  const pts = data.map((v, i) => [i * step, y(v)] as const);
  const line = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  const peak = highlightIndex != null && highlightIndex >= 0 && highlightIndex < data.length
    ? pts[highlightIndex]
    : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-grad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-grad-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {peak && (
        <circle cx={peak[0]} cy={peak[1]} r={2.5} fill={color} />
      )}
    </svg>
  );
}
