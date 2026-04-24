import { useState } from 'react';
import { useFilters } from '../state/store';
import { anomaliesInRange } from '../data/anomalies';

const SEV_STYLE = {
  info: 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]/30 text-[var(--color-primary)]',
  warning: 'bg-amber-50 border-amber-300 text-amber-700',
  critical: 'bg-red-50 border-red-300 text-red-700',
};

interface Props {
  /** Compact: collapsed single-line summary by default, expands on click. */
  compact?: boolean;
}

export default function AnomalyBanner({ compact = false }: Props) {
  const { dateFrom, dateTo } = useFilters();
  const [expanded, setExpanded] = useState(!compact);
  const items = anomaliesInRange(dateFrom, dateTo);
  if (items.length === 0) return null;

  // In compact mode, render a single-line summary chip by default.
  if (compact && !expanded) {
    const maxSev = items.some((a) => a.severity === 'critical')
      ? 'critical'
      : items.some((a) => a.severity === 'warning')
      ? 'warning'
      : 'info';
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`w-full text-left border rounded-lg px-4 py-2 text-xs flex items-center gap-2 mb-5 hover:opacity-80 transition ${SEV_STYLE[maxSev as 'info' | 'warning' | 'critical']}`}
      >
        <span className="font-bold tabular-nums text-[11px] shrink-0">({items.length})</span>
        <span className="font-bold uppercase tracking-wider text-[10px] shrink-0">Notes</span>
        <span className="text-[var(--color-text)] font-medium truncate">
          data-quality / industry note{items.length === 1 ? '' : 's'} for this date range
        </span>
        <span className="ml-auto text-[var(--color-text-muted)]">expand ↓</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 mb-5">
      {compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-dim)]">
            <span className="tabular-nums text-[11px]">({items.length})</span>
            <span>Notes for this date range</span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            collapse ↑
          </button>
        </div>
      )}
      {items.map((a) => (
        <div
          key={a.id}
          className={`border rounded-lg px-4 py-2.5 text-xs flex items-start gap-3 ${SEV_STYLE[a.severity]}`}
        >
          <span className="font-bold uppercase tracking-wider text-[10px] mt-0.5 shrink-0">{a.severity}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold text-sm text-[var(--color-text)]">{a.title}</div>
              {a.kind === 'industry-event' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  industry event
                </span>
              )}
            </div>
            <div className="text-[var(--color-text-muted)] mt-0.5">{a.detail}</div>
            {a.workaround && (
              <div className="text-[var(--color-text-muted)] mt-1">
                <span className="font-semibold">Workaround:</span> {a.workaround}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
