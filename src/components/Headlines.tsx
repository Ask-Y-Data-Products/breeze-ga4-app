// Auto-generated narrative insights — the "tell a story, don't just show
// numbers" principle. Each headline is a derived takeaway computed from the
// query results already on the page; no extra backend call.

interface Headline {
  title: string;
  detail?: string;
  tone?: 'positive' | 'neutral' | 'attention';
  icon?: string;
  /** Optional action — renders as an "Investigate →" button that pre-filters the page. */
  action?: { label: string; onClick: () => void };
}

export default function Headlines({ items, loading }: { items: Headline[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[84px] rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] animate-pulse"
          />
        ))}
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
      {items.slice(0, 3).map((h, i) => (
        <div
          key={i}
          className={`px-4 py-3 rounded-xl border flex gap-3 items-start ${toneClass(h.tone)}`}
        >
          <span className="text-lg leading-none mt-0.5 shrink-0" aria-hidden>
            {h.icon ?? defaultIcon(h.tone)}
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-dim)]">
              Key insight {i + 1}
            </div>
            <div className="text-sm font-semibold mt-0.5 leading-snug">{h.title}</div>
            {h.detail && (
              <div className="text-xs text-[var(--color-text-muted)] mt-1 leading-snug">{h.detail}</div>
            )}
            {h.action && (
              <button
                onClick={h.action.onClick}
                className="mt-2 text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
              >
                {h.action.label} →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function toneClass(t?: Headline['tone']): string {
  switch (t) {
    case 'positive':
      return 'bg-emerald-50 border-emerald-200';
    case 'attention':
      return 'bg-amber-50 border-amber-200';
    default:
      return 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]/30';
  }
}

function defaultIcon(t?: Headline['tone']): string {
  switch (t) {
    case 'positive':
      return '▲';
    case 'attention':
      return '⚠';
    default:
      return '◆';
  }
}
