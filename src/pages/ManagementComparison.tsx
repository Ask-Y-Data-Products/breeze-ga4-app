import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { COMPARISON, STATUS_META, Status } from '../data/comparison';

const TONE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function ManagementComparison() {
  const [filter, setFilter] = useState<Status | 'all'>('all');

  const summary = useMemo(() => {
    const counts: Record<Status, number> = { parity: 0, improved: 0, new: 0, gap: 0 };
    for (const g of COMPARISON) for (const r of g.rows) counts[r.status]++;
    return counts;
  }, []);

  const total = summary.parity + summary.improved + summary.new + summary.gap;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <SummaryCard
          label="Total capabilities"
          value={total}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          tone="slate"
        />
        <SummaryCard
          label="Parity"
          value={summary.parity}
          active={filter === 'parity'}
          onClick={() => setFilter(filter === 'parity' ? 'all' : 'parity')}
          tone="slate"
        />
        <SummaryCard
          label="Improved"
          value={summary.improved}
          active={filter === 'improved'}
          onClick={() => setFilter(filter === 'improved' ? 'all' : 'improved')}
          tone="green"
        />
        <SummaryCard
          label="New in app"
          value={summary.new}
          active={filter === 'new'}
          onClick={() => setFilter(filter === 'new' ? 'all' : 'new')}
          tone="blue"
        />
        <SummaryCard
          label="Gap (open)"
          value={summary.gap}
          active={filter === 'gap'}
          onClick={() => setFilter(filter === 'gap' ? 'all' : 'gap')}
          tone="amber"
        />
      </div>

      <div className="space-y-4">
        {COMPARISON.map((g) => {
          const rows = g.rows.filter((r) => filter === 'all' || r.status === filter);
          if (rows.length === 0) return null;
          return (
            <Card key={g.group} title={g.group} subtitle={g.summary}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                      <th className="px-3 py-2 font-semibold w-[200px]">Capability</th>
                      <th className="px-3 py-2 font-semibold">How the plugin did it</th>
                      <th className="px-3 py-2 font-semibold">How the app does it</th>
                      <th className="px-3 py-2 font-semibold w-[120px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const m = STATUS_META[r.status];
                      return (
                        <tr
                          key={r.capability}
                          className="border-b border-[var(--color-border)]/60 last:border-0 align-top"
                        >
                          <td className="px-3 py-3 font-semibold">{r.capability}</td>
                          <td className="px-3 py-3 text-[var(--color-text-muted)]">{r.pluginHow}</td>
                          <td className="px-3 py-3 text-[var(--color-text-muted)]">
                            {r.appHow}
                            {r.rationale && (
                              <div className="text-xs text-[var(--color-text-dim)] mt-1.5 italic">
                                {r.rationale}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border inline-block ${TONE[m.tone]}`}
                            >
                              {m.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Bottom line" className="mt-4">
        <div className="text-sm text-[var(--color-text-muted)] space-y-2">
          <p>
            The app <b className="text-[var(--color-text)]">covers the core of the plugin</b> (query / learn / experiments / data-quality / paid / funnel)
            without requiring GitLab, gcloud, or a terminal. That unblocks the adoption bottleneck Merritt described — setup.
          </p>
          <p>
            <b className="text-[var(--color-text)]">Outstanding gaps</b>: porting the statistical scripts (power / BH correction),
            a branded HTML export, a few plugin context areas (business funnel docs, attribution narrative), and Twyman&apos;s-Law
            "disprove surprising results" prompts.
          </p>
          <p>
            <b className="text-[var(--color-text)]">Net-new over the plugin</b>: always-visible anomaly banner, deterministic GUI queries,
            one-click experiment explorer, funnel builder with recommended templates, floating chat, and browser-native access with no install.
          </p>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  active,
  onClick,
  tone,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone: 'green' | 'blue' | 'amber' | 'slate';
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-xl border transition-all ${
        active
          ? `${TONE[tone]} ring-2 ring-offset-2 ring-offset-[var(--color-bg)] ring-current/30`
          : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-0.5">{value}</div>
    </button>
  );
}
