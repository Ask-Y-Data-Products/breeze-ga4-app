import { useFilters, INTERNAL_CHANNELS } from '../state/store';

/**
 * Shows currently-applied filters as removable pill chips, plus a "Filtered
 * to X% of sessions" indicator so users never lose track of what they're
 * looking at. Filters are combined with AND — the bar shows that explicitly.
 */
export default function AppliedFilters({
  filteredSessions,
  totalSessions,
}: {
  filteredSessions?: number;
  totalSessions?: number;
}) {
  const f = useFilters();
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];

  if (f.dateFrom || f.dateTo) {
    chips.push({
      key: 'date',
      label: `Date: ${f.dateFrom ?? 'any'} → ${f.dateTo ?? 'any'}`,
      clear: () => {
        f.setFilter('dateFrom', null);
        f.setFilter('dateTo', null);
      },
    });
  }
  if (f.channel) {
    chips.push({
      key: 'channel',
      label: `Channel: ${f.channel}`,
      clear: () => f.setFilter('channel', null),
    });
  }
  if (f.device) {
    chips.push({
      key: 'device',
      label: `Device: ${f.device}`,
      clear: () => f.setFilter('device', null),
    });
  }
  if (f.country.length > 0) {
    chips.push({
      key: 'country',
      label:
        f.country.length === 1
          ? `Country: ${f.country[0]}`
          : `Countries: ${f.country.slice(0, 2).join(', ')}${f.country.length > 2 ? ` +${f.country.length - 2}` : ''}`,
      clear: () => f.setFilter('country', []),
    });
  }
  if (f.loggedIn !== 'all') {
    chips.push({
      key: 'loggedIn',
      label: `Login: ${f.loggedIn.replace('_', '-')}`,
      clear: () => f.setFilter('loggedIn', 'all'),
    });
  }
  if (f.product) {
    chips.push({
      key: 'product',
      label: `Product: ${f.product} > $0`,
      clear: () => f.setFilter('product', null),
    });
  }
  if (f.excludeInternalTraffic) {
    chips.push({
      key: 'internal',
      label: `Excludes: ${INTERNAL_CHANNELS.join(', ')}`,
      clear: () => f.setFilter('excludeInternalTraffic', false),
    });
  }

  if (chips.length === 0) return null;

  const filteredPct =
    totalSessions && totalSessions > 0 && filteredSessions != null
      ? (filteredSessions / totalSessions) * 100
      : null;

  return (
    <div className="pt-2 mt-0 border-t border-[var(--color-border)]/60 flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] shrink-0">
        Applied
      </span>
      {chips.map((c, i) => (
        <span key={c.key} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-[10px] text-[var(--color-text-dim)] uppercase font-semibold">AND</span>
          )}
          <span className="inline-flex items-center gap-1.5 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-full px-2 py-0.5 text-xs font-medium">
            {c.label}
            <button
              onClick={c.clear}
              className="hover:text-[var(--color-danger)] leading-none ml-0.5"
              aria-label={`Remove ${c.label}`}
              title="Remove this filter"
            >
              ×
            </button>
          </span>
        </span>
      ))}
      {filteredPct != null && (
        <span className="ml-auto text-xs text-[var(--color-text-muted)] whitespace-nowrap">
          Filtered to <b className="text-[var(--color-text)] font-semibold">{filteredPct.toFixed(1)}%</b> of total sessions
          <span className="text-[var(--color-text-dim)] ml-1 font-mono">
            ({filteredSessions!.toLocaleString()} / {totalSessions!.toLocaleString()})
          </span>
        </span>
      )}
    </div>
  );
}
