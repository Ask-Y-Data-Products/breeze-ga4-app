import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { runQuery } from '../api/asky';
import { EXPERIMENTS_TABLE } from '../data/tables';
import PageHeader from '../components/PageHeader';
import { Card, KPICard } from '../components/Card';
import { BarChart, StackedBarChart } from '../components/Chart';
import { DataTable } from '../components/DataTable';
import { Loading, ErrorPanel, Empty } from '../components/QueryState';
import { ColumnDef } from '@tanstack/react-table';

type Variation = {
  experiment_variation: string;
  sessions: number;
  users: number;
  logged_in_rate: number;
};

export default function Experiments() {
  // Get the list of experiments to pick from
  const list = useQuery({
    queryKey: ['exp-list'],
    queryFn: () =>
      runQuery({
        modelId: EXPERIMENTS_TABLE,
        query: `
          SELECT experiment_name AS name,
                 COUNT(*)::BIGINT AS impressions,
                 COUNT(DISTINCT experiment_variation)::BIGINT AS variations,
                 COUNT(DISTINCT session_id)::BIGINT AS sessions
          FROM ${EXPERIMENTS_TABLE}
          GROUP BY 1
          ORDER BY sessions DESC
        `,
      }),
  });

  const experiments = (list.data?.rows ?? []) as any[];
  const [selected, setSelected] = useState<string | null>(null);
  const exp = selected ?? experiments[0]?.name ?? null;

  return (
    <div>
      <PageHeader
        title="Experiments"
        subtitle="A/B test analysis grounded in the experiments table."
      />

      {list.isLoading && <Loading />}
      {list.error && <ErrorPanel error={list.error} />}
      {experiments.length > 0 && (
        <>
          <ExperimentPicker
            experiments={experiments}
            current={exp}
            onPick={setSelected}
          />
          {exp && <ExperimentDetail experiment={exp} />}
        </>
      )}
    </div>
  );
}

function ExperimentPicker({
  experiments,
  current,
  onPick,
}: {
  experiments: any[];
  current: string | null;
  onPick: (n: string) => void;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-5 overflow-x-auto">
      <div className="flex">
        {experiments.map((e: any) => {
          const isActive = e.name === current;
          return (
            <button
              key={e.name}
              onClick={() => onPick(e.name)}
              className={`text-left px-4 py-3 border-r border-[var(--color-border)] min-w-[180px] transition-colors ${
                isActive
                  ? 'bg-[var(--color-primary-soft)] border-b-2 border-b-[var(--color-primary)]'
                  : 'hover:bg-[var(--color-surface-2)]'
              }`}
            >
              <div className={`text-xs font-mono ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                {e.name}
              </div>
              <div className="text-xs text-[var(--color-text-dim)] mt-1">
                {Number(e.sessions).toLocaleString()} sessions · {e.variations} var
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExperimentDetail({ experiment }: { experiment: string }) {
  const safeName = experiment.replace(/'/g, "''");

  const variations = useQuery({
    queryKey: ['exp-vars', experiment],
    queryFn: () =>
      runQuery({
        modelId: EXPERIMENTS_TABLE,
        query: `
          SELECT
            experiment_variation,
            COUNT(DISTINCT session_id)::BIGINT AS sessions,
            COUNT(DISTINCT user_pseudo_id)::BIGINT AS users,
            SUM(CASE WHEN logged_in='logged_in' THEN 1 ELSE 0 END)::DOUBLE / NULLIF(COUNT(*),0) AS logged_in_rate
          FROM ${EXPERIMENTS_TABLE}
          WHERE experiment_name = '${safeName}'
          GROUP BY 1
          ORDER BY sessions DESC
        `,
      }),
  });

  const channelByVar = useQuery({
    queryKey: ['exp-channel', experiment],
    queryFn: () =>
      runQuery({
        modelId: EXPERIMENTS_TABLE,
        query: `
          SELECT
            experiment_variation,
            COALESCE(channel_session, '(unknown)') AS channel,
            COUNT(DISTINCT session_id)::BIGINT AS sessions
          FROM ${EXPERIMENTS_TABLE}
          WHERE experiment_name = '${safeName}'
          GROUP BY 1,2
        `,
      }),
  });

  const deviceByVar = useQuery({
    queryKey: ['exp-device', experiment],
    queryFn: () =>
      runQuery({
        modelId: EXPERIMENTS_TABLE,
        query: `
          SELECT
            experiment_variation,
            COALESCE(device_category, '(unknown)') AS device,
            COUNT(DISTINCT session_id)::BIGINT AS sessions
          FROM ${EXPERIMENTS_TABLE}
          WHERE experiment_name = '${safeName}'
          GROUP BY 1,2
        `,
      }),
  });

  const vars = (variations.data?.rows ?? []) as Variation[];
  const totalSessions = vars.reduce((s, v) => s + Number(v.sessions), 0);

  // Stack-data shapes
  const channelStack = useMemo(() => buildStack(channelByVar.data?.rows ?? [], 'experiment_variation', 'channel', 'sessions'), [channelByVar.data]);
  const deviceStack = useMemo(() => buildStack(deviceByVar.data?.rows ?? [], 'experiment_variation', 'device', 'sessions'), [deviceByVar.data]);

  const cols: ColumnDef<Variation, any>[] = useMemo(
    () => [
      { header: 'Variation', accessorKey: 'experiment_variation' },
      {
        header: 'Sessions',
        accessorKey: 'sessions',
        cell: (i) => (
          <span className="font-mono">{Number(i.getValue()).toLocaleString()}</span>
        ),
      },
      {
        header: 'Share',
        accessorFn: (r) => Number(r.sessions) / totalSessions,
        cell: (i) => <span className="font-mono">{(Number(i.getValue()) * 100).toFixed(1)}%</span>,
      },
      {
        header: 'Users',
        accessorKey: 'users',
        cell: (i) => <span className="font-mono">{Number(i.getValue()).toLocaleString()}</span>,
      },
      {
        header: 'Logged-in %',
        accessorKey: 'logged_in_rate',
        cell: (i) => <span className="font-mono">{(Number(i.getValue() ?? 0) * 100).toFixed(1)}%</span>,
      },
    ],
    [totalSessions],
  );

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <KPICard label="Variations" value={vars.length} hint="distinct" />
        <KPICard label="Sessions" value={totalSessions.toLocaleString()} />
        <KPICard
          label="Balance"
          value={vars.length ? `${(stddev(vars.map((v) => Number(v.sessions))) / (totalSessions / vars.length) * 100).toFixed(1)}%` : '—'}
          hint="CV across variations"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Card title="Variation breakdown" subtitle="distinct sessions per arm" className="lg:col-span-3">
          {variations.isLoading && <Loading height={250} />}
          {variations.error && <ErrorPanel error={variations.error} />}
          {variations.data && <DataTable data={vars} columns={cols} />}
        </Card>
        <Card title="Sample-size split" subtitle="distinct sessions per variation" className="lg:col-span-2">
          {variations.data && (
            <BarChart
              data={vars.map((v) => ({ name: v.experiment_variation, value: Number(v.sessions) }))}
              height={260}
            />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Channel mix per variation" subtitle="stacked sessions">
          {channelByVar.isLoading && <Loading height={320} />}
          {channelByVar.data && channelStack.categories.length > 0 ? (
            <StackedBarChart {...channelStack} />
          ) : (
            !channelByVar.isLoading && <Empty />
          )}
        </Card>
        <Card title="Device mix per variation" subtitle="stacked sessions">
          {deviceByVar.isLoading && <Loading height={320} />}
          {deviceByVar.data && deviceStack.categories.length > 0 ? (
            <StackedBarChart {...deviceStack} />
          ) : (
            !deviceByVar.isLoading && <Empty />
          )}
        </Card>
      </div>
    </>
  );
}

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
}

function buildStack(
  rows: any[],
  catKey: string,
  seriesKey: string,
  valueKey: string,
): { categories: string[]; series: { name: string; data: number[] }[] } {
  const cats = Array.from(new Set(rows.map((r) => r[catKey])));
  const series = Array.from(new Set(rows.map((r) => r[seriesKey])));
  const lookup = new Map(rows.map((r) => [r[catKey] + '||' + r[seriesKey], Number(r[valueKey])]));
  return {
    categories: cats,
    series: series.map((name) => ({
      name: String(name),
      data: cats.map((c) => lookup.get(c + '||' + name) ?? 0),
    })),
  };
}
