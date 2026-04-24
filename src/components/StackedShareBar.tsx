// 100%-stacked horizontal bar with inline percentage labels. Replaces a donut
// when the actual question is "share + benchmark comparison across groups",
// which is hard to read on pie/donut (Few, Knaflic).

interface Item {
  name: string;
  value: number;
  color?: string;
}

const PALETTE = ['#3b5bdb', '#0ea5e9', '#059669', '#d97706', '#db2777', '#7c3aed', '#eab308'];

export default function StackedShareBar({
  items,
  height = 28,
}: {
  items: Item[];
  height?: number;
}) {
  const total = items.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return <div className="text-xs text-[var(--color-text-muted)]">No data</div>;
  }
  return (
    <div>
      <div
        className="w-full flex rounded-md overflow-hidden border border-[var(--color-border)]"
        style={{ height }}
      >
        {items.map((item, i) => {
          const pct = (item.value / total) * 100;
          const color = item.color ?? PALETTE[i % PALETTE.length];
          return (
            <div
              key={item.name}
              style={{ width: `${pct}%`, background: color }}
              className="flex items-center justify-center text-white text-[11px] font-semibold whitespace-nowrap overflow-hidden"
              title={`${item.name}: ${pct.toFixed(1)}% (${item.value.toLocaleString()})`}
            >
              {pct >= 8 ? `${pct.toFixed(0)}%` : ''}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {items.map((item, i) => {
          const color = item.color ?? PALETTE[i % PALETTE.length];
          const pct = (item.value / total) * 100;
          return (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
              <span className="text-[var(--color-text)] font-medium">{item.name}</span>
              <span className="text-[var(--color-text-muted)]">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
