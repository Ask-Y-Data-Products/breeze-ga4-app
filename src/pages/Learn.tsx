import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Card } from '../components/Card';
import { TABLES } from '../data/tables';
import { columnsForTable, ColumnDoc } from '../data/schema';

export default function Learn() {
  const [tableKey, setTableKey] = useState<string>('ga4_experiments');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('');

  const table = TABLES.find((t) => t.key === tableKey)!;
  const { columns: allCols, groups: allGroups } = columnsForTable(table.key);

  const filteredCols = useMemo(() => {
    if (allCols.length === 0) return [] as ColumnDoc[];
    const s = search.trim().toLowerCase();
    return allCols.filter((c) => {
      if (groupFilter && c.group !== groupFilter) return false;
      if (s && !c.name.toLowerCase().includes(s) && !c.description.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [search, groupFilter, allCols]);

  return (
    <div>
      <PageHeader
        title="Learn"
        subtitle="Schema and tracking documentation. Use this before writing queries — never guess column names."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-1 space-y-2">
          {TABLES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTableKey(t.key)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                t.key === tableKey
                  ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]/40'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">{t.displayName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                    t.status === 'available'
                      ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                      : 'bg-[var(--color-text-dim)]/15 text-[var(--color-text-dim)]'
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">{t.modelId}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card title={table.displayName} subtitle={table.grain}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
              <Meta label="Status" value={table.status} />
              <Meta label="Partition" value={table.partition} />
              <Meta label="Rows" value={table.rowEstimate} />
              <Meta label="modelId" value={<code className="text-[10px] break-all">{table.modelId}</code>} />
            </div>
            <div className="text-sm">
              <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-semibold mb-1.5">Use for</div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-1">
                {table.useFor.map((u) => <li key={u}>{u}</li>)}
              </ul>
            </div>
            {table.notes && (
              <div className="mt-4 text-sm">
                <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] font-semibold mb-1.5">Caveats</div>
                <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-1">
                  {table.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            )}
          </Card>

          {table.status === 'available' && (
            <Card
              title="Columns"
              subtitle={`${filteredCols.length} of ${allCols.length}`}
              right={
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Search columns…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs w-48"
                  />
                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs"
                  >
                    <option value="">all groups</option>
                    {allGroups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              }
            >
              <div className="overflow-auto max-h-[600px] divide-y divide-[var(--color-border)]/50">
                {filteredCols.map((c) => (
                  <div key={c.name} className="py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <code className="text-sm font-semibold text-[var(--color-primary)]">{c.name}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)] uppercase font-bold tracking-wider">
                        {c.type}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-dim)]">
                        {c.group}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)] mt-1">{c.description}</div>
                    {c.values && (
                      <div className="text-xs text-[var(--color-text-dim)] mt-1.5 flex flex-wrap gap-1">
                        {c.values.map((v) => (
                          <span key={v} className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] font-mono">{v}</span>
                        ))}
                      </div>
                    )}
                    {c.notes && (
                      <div className="text-xs text-amber-300/80 mt-1.5">⚠ {c.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {table.status === 'planned' && (
            <Card title="Not yet imported">
              <div className="text-sm text-[var(--color-text-muted)]">
                This table exists in the Breeze GA4 plugin spec but has not been loaded into Asky for this app.
                Once the source parquet is uploaded as a project table, the Explore and Executive pages can
                query it via <code>modelId</code> = <code className="text-[var(--color-primary)]">{table.modelId}</code>.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-dim)]">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
