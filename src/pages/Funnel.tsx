import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { runQuery } from '../api/asky';
import { EVENTS_TABLE } from '../data/tables';
import PageHeader from '../components/PageHeader';
import { Card, KPICard } from '../components/Card';
import { FunnelChart } from '../components/Chart';
import { Loading, ErrorPanel, Empty } from '../components/QueryState';

type StepKind = 'event' | 'page';
type Metric = 'sessions' | 'users' | 'events';

interface Step {
  kind: StepKind;
  value: string;
  /** Optional match mode for pages: exact or prefix */
  match?: 'exact' | 'prefix';
}

const EVENT_NAMES = [
  'page_view', 'view_item', 'add_to_cart', 'flight_search_ui', 'flight_search_submitted',
  'login', 'track_click', 'user_engagement', 'hovr', 'wifi_check', 'wifi_ad_portal', 'glad_app',
];

const COMMON_PAGES = [
  '/home', '/booking', '/booking/availability', '/booking/seats', '/booking/bags',
  '/booking/extras', '/booking/summary', '/booking/payment', '/booking/confirmation',
  '/check-in/boarding-passes/', '/profile/loyalty', '/u/login', '/flight-deals',
  '/onboard-experience', '/wifi-info',
];

const METRIC_LABEL: Record<Metric, string> = {
  sessions: 'Distinct sessions',
  users: 'Distinct users (user_pseudo_id)',
  events: 'Event rows',
};

const DEFAULT_STEPS: Step[] = [
  { kind: 'event', value: 'page_view' },
  { kind: 'event', value: 'flight_search_submitted' },
  { kind: 'event', value: 'view_item' },
  { kind: 'event', value: 'add_to_cart' },
];

interface FunnelTemplate {
  id: string;
  name: string;
  description: string;
  metric: Metric;
  steps: Step[];
}

// Recommended funnels — chosen to match Breeze's core flows and the event_name
// values that actually exist in ga4_events (page_view, view_item, add_to_cart, etc.).
const TEMPLATES: FunnelTemplate[] = [
  {
    id: 'booking',
    name: 'Booking conversion',
    description: 'Search → results → cart → booking pages',
    metric: 'sessions',
    steps: [
      { kind: 'event', value: 'flight_search_ui' },
      { kind: 'event', value: 'flight_search_submitted' },
      { kind: 'event', value: 'view_item' },
      { kind: 'event', value: 'add_to_cart' },
    ],
  },
  {
    id: 'booking-pages',
    name: 'Booking pages walk',
    description: 'Home → availability → seats → bags → payment',
    metric: 'sessions',
    steps: [
      { kind: 'page', value: '/home', match: 'exact' },
      { kind: 'page', value: '/booking/availability', match: 'exact' },
      { kind: 'page', value: '/booking/seats', match: 'exact' },
      { kind: 'page', value: '/booking/bags', match: 'exact' },
      { kind: 'page', value: '/booking/payment', match: 'exact' },
    ],
  },
  {
    id: 'all-booking',
    name: 'Any booking step',
    description: 'Coarse funnel based on /booking/* path prefix',
    metric: 'sessions',
    steps: [
      { kind: 'page', value: '/home', match: 'exact' },
      { kind: 'page', value: '/booking', match: 'prefix' },
      { kind: 'event', value: 'add_to_cart' },
      { kind: 'page', value: '/booking/payment', match: 'exact' },
    ],
  },
  {
    id: 'login',
    name: 'Login → add to cart',
    description: 'Logged-in users moving from login to cart',
    metric: 'users',
    steps: [
      { kind: 'event', value: 'login' },
      { kind: 'event', value: 'view_item' },
      { kind: 'event', value: 'add_to_cart' },
    ],
  },
  {
    id: 'checkin',
    name: 'Check-in flow',
    description: 'Boarding pass journey',
    metric: 'sessions',
    steps: [
      { kind: 'page', value: '/check-in', match: 'prefix' },
      { kind: 'page', value: '/check-in/boarding-passes/', match: 'prefix' },
    ],
  },
  {
    id: 'engagement',
    name: 'Engagement depth',
    description: 'Page-view → engagement → hovr interaction',
    metric: 'sessions',
    steps: [
      { kind: 'event', value: 'page_view' },
      { kind: 'event', value: 'user_engagement' },
      { kind: 'event', value: 'hovr' },
    ],
  },
  {
    id: 'wifi',
    name: 'Onboard Wi-Fi',
    description: 'Wi-Fi check → ad portal → Wi-Fi info',
    metric: 'sessions',
    steps: [
      { kind: 'event', value: 'wifi_check' },
      { kind: 'event', value: 'wifi_ad_portal' },
      { kind: 'page', value: '/wifi-info', match: 'exact' },
    ],
  },
];

export default function Funnel() {
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS);
  const [metric, setMetric] = useState<Metric>('sessions');
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  function applyTemplate(t: FunnelTemplate) {
    setSteps(t.steps.map((s) => ({ ...s })));
    setMetric(t.metric);
    setActiveTemplate(t.id);
  }

  const sql = useMemo(() => buildFunnelSQL(steps, metric), [steps, metric]);
  const stepKey = steps.map((s) => `${s.kind}:${s.value}:${s.match ?? ''}`).join('|');

  const q = useQuery({
    queryKey: ['funnel', stepKey, metric],
    queryFn: () => runQuery({ modelId: EVENTS_TABLE, query: sql }),
    enabled: steps.length > 0 && steps.every((s) => s.value.trim() !== ''),
  });

  // Response: one row with columns step_1, step_2, … step_N
  const counts: number[] = useMemo(() => {
    if (!q.data || q.data.rows.length === 0) return [];
    const row = q.data.rows[0] as Record<string, unknown>;
    return steps.map((_, i) => Number(row[`step_${i + 1}`] ?? 0));
  }, [q.data, steps]);

  const topCount = counts[0] ?? 0;
  const bottomCount = counts[counts.length - 1] ?? 0;
  const overallConv = topCount > 0 ? (bottomCount / topCount) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Funnel"
        subtitle="Pick a recommended funnel or build your own — events or page paths, any metric."
      />

      <Card title="Recommended" subtitle="Click a preset to apply — you can still edit steps after." className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {TEMPLATES.map((t) => {
            const active = activeTemplate === t.id;
            return (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className={`text-left p-3 rounded-lg border transition ${
                  active
                    ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]/40 shadow-sm'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-semibold ${active ? 'text-[var(--color-primary)]' : ''}`}>
                    {t.name}
                  </span>
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-dim)]">
                    {t.steps.length}·{t.metric}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] leading-snug">{t.description}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Build funnel" subtitle="up to 8 steps — edit freely from any template">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">
          <div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <StepRow
                  key={i}
                  index={i}
                  step={step}
                  onChange={(s) => { setActiveTemplate(null); setSteps((prev) => prev.map((p, j) => (j === i ? s : p))); }}
                  onDelete={() => { setActiveTemplate(null); setSteps((prev) => prev.filter((_, j) => j !== i)); }}
                  onMoveUp={i > 0 ? () => { setActiveTemplate(null); setSteps((prev) => swap(prev, i, i - 1)); } : undefined}
                  onMoveDown={i < steps.length - 1 ? () => { setActiveTemplate(null); setSteps((prev) => swap(prev, i, i + 1)); } : undefined}
                />
              ))}
              {steps.length < 8 && (
                <button
                  onClick={() => setSteps((prev) => [...prev, { kind: 'event', value: '' }])}
                  className="w-full py-2 text-sm border border-dashed border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
                >
                  + Add step
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-dim)] mb-1">Count</div>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as Metric)}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
              >
                {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                  <option key={m} value={m}>{METRIC_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]">View generated SQL</summary>
              <pre className="mt-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-2 overflow-x-auto font-mono text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap">
{sql.trim()}
              </pre>
            </details>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Steps" value={steps.length} />
        <KPICard label={`Top: ${stepLabel(steps[0])}`} value={fmt(topCount)} />
        <KPICard label={`Bottom: ${stepLabel(steps[steps.length - 1])}`} value={fmt(bottomCount)} />
        <KPICard label="Overall conversion" value={`${overallConv.toFixed(2)}%`} hint={`${fmt(bottomCount)} / ${fmt(topCount)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
        <Card title="Funnel view" className="lg:col-span-3">
          {q.isLoading && <Loading height={360} />}
          {q.error && <ErrorPanel error={q.error} />}
          {!q.isLoading && q.data && counts.length > 0 && topCount > 0 && (
            <FunnelChart
              data={steps.map((s, i) => ({ name: stepLabel(s), value: counts[i] }))}
              height={Math.max(280, steps.length * 60)}
            />
          )}
          {q.data && topCount === 0 && <Empty>No data for the first step.</Empty>}
        </Card>

        <Card title="Step table" subtitle="absolute counts + conversion" className="lg:col-span-2">
          {counts.length > 0 && (
            <div className="overflow-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Step</th>
                    <th className="px-3 py-2 text-right font-semibold">Count</th>
                    <th className="px-3 py-2 text-right font-semibold">% of top</th>
                    <th className="px-3 py-2 text-right font-semibold">% of prev</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s, i) => {
                    const cur = counts[i] ?? 0;
                    const prev = i === 0 ? cur : counts[i - 1] ?? 0;
                    const pctTop = topCount > 0 ? (cur / topCount) * 100 : 0;
                    const pctPrev = prev > 0 ? (cur / prev) * 100 : 0;
                    return (
                      <tr key={i} className="border-t border-[var(--color-border)]/50">
                        <td className="px-3 py-2 font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs truncate max-w-[180px]" title={stepLabel(s)}>{stepLabel(s)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(cur)}</td>
                        <td className="px-3 py-2 text-right font-mono">{pctTop.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-mono">{i === 0 ? '—' : `${pctPrev.toFixed(1)}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StepRow({
  index,
  step,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  step: Step;
  onChange: (s: Step) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-[var(--color-surface-2)] rounded-lg p-2">
      <span className="w-6 h-6 rounded-md bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">
        {index + 1}
      </span>
      <select
        value={step.kind}
        onChange={(e) => onChange({ kind: e.target.value as StepKind, value: '' })}
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs"
      >
        <option value="event">event_name</option>
        <option value="page">page path</option>
      </select>
      {step.kind === 'event' ? (
        <select
          value={step.value}
          onChange={(e) => onChange({ ...step, value: e.target.value })}
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm"
        >
          <option value="">— pick an event —</option>
          {EVENT_NAMES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      ) : (
        <>
          <input
            type="text"
            list="funnel-page-list"
            placeholder="/some/path"
            value={step.value}
            onChange={(e) => onChange({ ...step, value: e.target.value })}
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm font-mono"
          />
          <datalist id="funnel-page-list">
            {COMMON_PAGES.map((p) => <option key={p} value={p} />)}
          </datalist>
          <select
            value={step.match ?? 'exact'}
            onChange={(e) => onChange({ ...step, match: e.target.value as 'exact' | 'prefix' })}
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs"
          >
            <option value="exact">exact</option>
            <option value="prefix">starts-with</option>
          </select>
        </>
      )}
      <button
        onClick={onMoveUp}
        disabled={!onMoveUp}
        className="px-1.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30"
        title="Move up"
      >↑</button>
      <button
        onClick={onMoveDown}
        disabled={!onMoveDown}
        className="px-1.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30"
        title="Move down"
      >↓</button>
      <button
        onClick={onDelete}
        className="px-1.5 py-1 text-xs text-[var(--color-danger)] hover:opacity-70"
        title="Remove step"
      >×</button>
    </div>
  );
}

function stepLabel(s?: Step): string {
  if (!s) return '—';
  if (!s.value) return `(${s.kind})`;
  return s.kind === 'event' ? s.value : `${s.value}${s.match === 'prefix' ? '*' : ''}`;
}

function swap<T>(xs: T[], i: number, j: number): T[] {
  const out = [...xs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function fmt(n: number): string {
  return Number(n ?? 0).toLocaleString();
}

// Generate the funnel SQL. We produce a single row with step_1..step_N counts.
// Semantic: each step is matched within sessions; we count how many sessions (or users/events) hit step K.
// No ordering/sequence assumption (GA4-style "reached step K at all" — simpler and matches most funnel tools).
function buildFunnelSQL(steps: Step[], metric: Metric): string {
  if (steps.length === 0) return 'SELECT 1 WHERE FALSE';
  const valid = steps.filter((s) => s.value.trim() !== '');
  if (valid.length === 0) return 'SELECT 1 WHERE FALSE';

  const countExpr =
    metric === 'sessions' ? 'COUNT(DISTINCT session_id)' :
    metric === 'users' ? 'COUNT(DISTINCT user_pseudo_id)' :
    'COUNT(*)';

  const clauses = steps.map(stepClause);
  const projections = clauses
    .map((c, i) => `${countExpr} FILTER (WHERE ${c})::BIGINT AS step_${i + 1}`)
    .join(',\n    ');

  return `SELECT
    ${projections}
  FROM ${EVENTS_TABLE}`;
}

function stepClause(step: Step): string {
  const v = step.value.replace(/'/g, "''");
  if (!v) return 'FALSE';
  if (step.kind === 'event') return `event_name = '${v}'`;
  if (step.match === 'prefix') return `path LIKE '${v}%'`;
  return `path = '${v}'`;
}
