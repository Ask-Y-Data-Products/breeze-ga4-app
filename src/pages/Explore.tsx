import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { runQuery } from '../api/asky';
import { EXPERIMENTS_TABLE } from '../data/tables';
import { useFilters, buildWhere } from '../state/store';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import AnomalyBanner from '../components/AnomalyBanner';
import { Card } from '../components/Card';
import { BarChart } from '../components/Chart';
import { DataTable } from '../components/DataTable';
import { Loading, ErrorPanel, Empty } from '../components/QueryState';
import { ColumnDef } from '@tanstack/react-table';
import { EXPERIMENT_COLUMNS } from '../data/schema';

const DIMS = EXPERIMENT_COLUMNS
  .filter((c) => c.type === 'Varchar' || c.type === 'Boolean' || c.type === 'Date')
  .map((c) => c.name);

const METRICS = [
  { key: 'sessions', label: 'Distinct sessions', sql: 'COUNT(DISTINCT session_id)' },
  { key: 'users', label: 'Distinct users', sql: 'COUNT(DISTINCT user_pseudo_id)' },
  { key: 'authed_users', label: 'Authed users', sql: 'COUNT(DISTINCT user_id)' },
  { key: 'rows', label: 'Row count', sql: 'COUNT(*)' },
  { key: 'experiments', label: 'Distinct experiments', sql: 'COUNT(DISTINCT experiment_name)' },
];

export default function Explore() {
  const filters = useFilters();
  const [groupBy, setGroupBy] = useState<string>('channel_session');
  const [metric, setMetric] = useState<string>('sessions');
  const [limit, setLimit] = useState<number>(20);

  const safeGroup = DIMS.includes(groupBy) ? groupBy : 'channel_session';
  const m = METRICS.find((x) => x.key === metric) ?? METRICS[0];

  const where = buildWhere(filters);
  const sql = `
    SELECT "${safeGroup}" AS dim, ${m.sql}::BIGINT AS metric
    FROM ${EXPERIMENTS_TABLE}
    ${where || 'WHERE 1=1'}
    AND "${safeGroup}" IS NOT NULL
    GROUP BY 1
    ORDER BY metric DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 20, 1), 200)}
  `;

  const q = useQuery({
    queryKey: ['explore', safeGroup, m.key, where, limit],
    queryFn: () => runQuery({ modelId: EXPERIMENTS_TABLE, query: sql }),
  });

  const cols: ColumnDef<any, any>[] = useMemo(
    () => [
      { header: safeGroup, accessorKey: 'dim' },
      {
        header: m.label,
        accessorKey: 'metric',
        cell: (i) => <span className="font-mono">{Number(i.getValue()).toLocaleString()}</span>,
      },
    ],
    [safeGroup, m.label],
  );

  const totalForShare = (q.data?.rows ?? []).reduce((s: number, r: any) => s + Number(r.metric), 0);

  return (
    <div>
      <PageHeader
        title="Explore"
        subtitle="Deterministic GUI for ad-hoc queries — pick filters, a dimension, and a metric. SQL is generated and validated server-side."
      />
      <FilterBar />
      <AnomalyBanner />

      <Card title="Build query" className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Group by">
            <select
              value={safeGroup}
              onChange={(e) => setGroupBy(e.target.value)}
              className={inp + ' w-full'}
            >
              {DIMS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Metric">
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className={inp + ' w-full'}>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Limit">
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className={inp + ' w-full'}
            />
          </Field>
        </div>
        <details>
          <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text)]">
            View generated SQL
          </summary>
          <pre className="mt-2 text-[11px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap font-mono text-[var(--color-text-muted)]">
{sql.trim()}
          </pre>
        </details>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card title={`${m.label} by ${safeGroup}`} className="lg:col-span-3">
          {q.isLoading && <Loading height={320} />}
          {q.error && <ErrorPanel error={q.error} />}
          {q.data && q.data.rows.length === 0 && <Empty />}
          {q.data && q.data.rows.length > 0 && (
            <BarChart
              horizontal
              height={Math.max(280, q.data.rows.length * 22)}
              data={q.data.rows.map((r: any) => ({ name: String(r.dim), value: Number(r.metric) }))}
            />
          )}
        </Card>
        <Card title="Results" subtitle={q.data ? `${q.data.rows.length} rows · total ${totalForShare.toLocaleString()}` : ''} className="lg:col-span-2">
          {q.data && <DataTable data={q.data.rows} columns={cols} height={420} />}
        </Card>
      </div>
    </div>
  );
}

const inp =
  'bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-dim)] mb-1">{label}</div>
      {children}
    </div>
  );
}
