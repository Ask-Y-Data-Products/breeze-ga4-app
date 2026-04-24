import { useQuery } from '@tanstack/react-query';
import { runQuery } from '../api/asky';
import { EXPERIMENTS_TABLE } from '../data/tables';
import { ANOMALIES } from '../data/anomalies';
import PageHeader from '../components/PageHeader';
import { Card, KPICard } from '../components/Card';
import { Loading, ErrorPanel } from '../components/QueryState';

const SEV = {
  info: 'border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]',
  warning: 'border-amber-300 bg-amber-50',
  critical: 'border-red-300 bg-red-50',
};

export default function DataQuality() {
  const sanity = useQuery({
    queryKey: ['dq-sanity'],
    queryFn: () =>
      runQuery({
        modelId: EXPERIMENTS_TABLE,
        query: `
          SELECT
            COUNT(*)::BIGINT AS rows,
            SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END)::BIGINT AS null_user_id,
            SUM(CASE WHEN user_pseudo_id IS NULL THEN 1 ELSE 0 END)::BIGINT AS null_user_pseudo_id,
            SUM(CASE WHEN session_id IS NULL THEN 1 ELSE 0 END)::BIGINT AS null_session_id,
            SUM(CASE WHEN cardholder IS NULL THEN 1 ELSE 0 END)::BIGINT AS null_cardholder,
            SUM(CASE WHEN is_final = TRUE THEN 1 ELSE 0 END)::BIGINT AS final_rows,
            MIN(event_date)::VARCHAR AS min_date,
            MAX(event_date)::VARCHAR AS max_date
          FROM ${EXPERIMENTS_TABLE}
        `,
      }),
  });

  const k = sanity.data?.rows[0] as Record<string, any> | undefined;

  return (
    <div>
      <PageHeader
        title="Data Quality"
        subtitle="Anomaly catalog and NULL coverage for the experiments table."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {sanity.isLoading && <Loading height={80} />}
        {sanity.error && <ErrorPanel error={sanity.error} />}
        {k && (
          <>
            <KPICard label="Total rows" value={fmt(k.rows)} hint={`${k.min_date} → ${k.max_date}`} />
            <KPICard label="Final rows" value={pct(k.final_rows, k.rows)} hint="is_final = TRUE" />
            <KPICard label="user_id NULL" value={pct(k.null_user_id, k.rows)} hint="logged-out sessions" />
            <KPICard label="cardholder NULL" value={pct(k.null_cardholder, k.rows)} hint="non-cardholders" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Anomaly catalog" subtitle="known issues with date ranges, ported from plugin YAML">
          <div className="space-y-3">
            {ANOMALIES.map((a) => (
              <div key={a.id} className={`border rounded-lg p-3 ${SEV[a.severity]}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-bg)]/50">
                    {a.severity}
                  </span>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    {a.startDate} → {a.endDate}
                  </span>
                  <span className="text-xs text-[var(--color-text-dim)]">·</span>
                  <span className="text-xs text-[var(--color-text-muted)] font-mono">
                    {a.affectedTables.join(', ')}
                  </span>
                </div>
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{a.detail}</div>
                {a.workaround && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-1.5">
                    <span className="font-semibold text-[var(--color-text)]">Workaround:</span> {a.workaround}
                  </div>
                )}
                {a.affectedColumns && (
                  <div className="text-[10px] text-[var(--color-text-dim)] mt-1.5 flex flex-wrap gap-1">
                    {a.affectedColumns.map((c) => (
                      <code key={c} className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">
                        {c}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Sanity counts" subtitle="raw values behind each KPI">
          {k && (
            <ul className="text-sm space-y-1.5">
              <Row label="Total rows" v={fmt(k.rows)} />
              <Row label="Final rows" v={fmt(k.final_rows)} hint="is_final = TRUE" />
              <Row label="Date min" v={k.min_date} />
              <Row label="Date max" v={k.max_date} />
              <Row label="session_id NULL" v={`${fmt(k.null_session_id)} (${pct(k.null_session_id, k.rows)})`} />
              <Row label="user_pseudo_id NULL" v={`${fmt(k.null_user_pseudo_id)} (${pct(k.null_user_pseudo_id, k.rows)})`} />
              <Row label="user_id NULL" v={`${fmt(k.null_user_id)} (${pct(k.null_user_id, k.rows)})`} />
              <Row label="cardholder NULL" v={`${fmt(k.null_cardholder)} (${pct(k.null_cardholder, k.rows)})`} />
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, v, hint }: { label: string; v: string; hint?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1 border-b border-[var(--color-border)]/50 last:border-0">
      <span className="text-[var(--color-text-muted)]">
        {label}
        {hint && <span className="text-[var(--color-text-dim)] text-xs ml-2 font-mono">{hint}</span>}
      </span>
      <span className="font-mono">{v}</span>
    </li>
  );
}

function fmt(n: any): string {
  return Number(n ?? 0).toLocaleString();
}
function pct(n: any, d: any): string {
  const a = Number(n ?? 0);
  const b = Number(d ?? 0);
  if (b === 0) return '—';
  return ((a / b) * 100).toFixed(1) + '%';
}
