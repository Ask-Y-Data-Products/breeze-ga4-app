import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { runQuery } from '../api/asky';
import { AD_SPEND_TABLE, SESSIONS_TABLE } from '../data/tables';
import PageHeader from '../components/PageHeader';
import { Card, KPICard } from '../components/Card';
import { BarChart, DonutChart } from '../components/Chart';
import { DataTable } from '../components/DataTable';
import { Loading, ErrorPanel, Empty } from '../components/QueryState';
import { ColumnDef } from '@tanstack/react-table';

// Paid Media queries are all small aggregations against the 291-row ad_spend
// table. They're chained sequentially via `enabled` so the Asky backend
// never processes more than one at a time per session — some backends
// serialize queries per token and stall when they pile up concurrently.

type CampaignRow = {
  campaign: string;
  source: string;
  account_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export default function PaidMedia() {
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'spend' | 'clicks' | 'impressions' | 'cpc'>('spend');

  const kpis = useQuery({
    queryKey: ['paid-kpis'],
    retry: 0,
    queryFn: () =>
      runQuery({
        modelId: AD_SPEND_TABLE,
        pageSize: 100,
        offset: 0,
        query: `
          SELECT
            SUM(spend)::DOUBLE AS total_spend,
            SUM(clicks)::BIGINT AS total_clicks,
            SUM(impressions)::BIGINT AS total_impressions,
            COUNT(DISTINCT campaign)::BIGINT AS campaigns,
            COUNT(DISTINCT source)::BIGINT AS sources,
            MIN(date)::VARCHAR AS min_date,
            MAX(date)::VARCHAR AS max_date
          FROM ${AD_SPEND_TABLE}
        `,
      }),
  });

  // Chain queries sequentially — each waits for the previous to resolve.
  const bySource = useQuery({
    queryKey: ['paid-source'],
    retry: 0,
    enabled: !!kpis.data,
    queryFn: () =>
      runQuery({
        modelId: AD_SPEND_TABLE,
        pageSize: 100,
        offset: 0,
        query: `
          SELECT
            source,
            SUM(spend)::DOUBLE AS spend,
            SUM(clicks)::BIGINT AS clicks,
            SUM(impressions)::BIGINT AS impressions
          FROM ${AD_SPEND_TABLE}
          GROUP BY 1
          ORDER BY spend DESC
        `,
      }),
  });

  const byAccount = useQuery({
    queryKey: ['paid-account'],
    retry: 0,
    enabled: !!bySource.data,
    queryFn: () =>
      runQuery({
        modelId: AD_SPEND_TABLE,
        pageSize: 100,
        offset: 0,
        query: `
          SELECT account_name, SUM(spend)::DOUBLE AS spend
          FROM ${AD_SPEND_TABLE}
          GROUP BY 1
          ORDER BY spend DESC
        `,
      }),
  });

  const topCampaigns = useQuery({
    queryKey: ['paid-campaigns', sourceFilter, sortBy],
    retry: 0,
    enabled: !!byAccount.data,
    queryFn: () =>
      runQuery({
        modelId: AD_SPEND_TABLE,
        pageSize: 100,
        offset: 0,
        query: `
          SELECT
            campaign,
            source,
            account_name,
            SUM(spend)::DOUBLE AS spend,
            SUM(clicks)::BIGINT AS clicks,
            SUM(impressions)::BIGINT AS impressions
          FROM ${AD_SPEND_TABLE}
          ${sourceFilter ? `WHERE source = '${sourceFilter.replace(/'/g, "''")}'` : ''}
          GROUP BY 1, 2, 3
          ORDER BY ${sortBy} DESC
          LIMIT 25
        `,
      }),
  });

  // ROAS is gated behind the Compute button because it joins against ga4_sessions.
  const [loadRoas, setLoadRoas] = useState(false);
  const roas = useQuery({
    queryKey: ['paid-roas'],
    retry: 0,
    enabled: loadRoas,
    queryFn: () =>
      runQuery({
        modelId: AD_SPEND_TABLE,
        pageSize: 100,
        offset: 0,
        timeoutMs: 60_000,
        query: `
          WITH a AS (
            SELECT LOWER(campaign) AS campaign_key, SUM(spend)::DOUBLE AS spend
            FROM ${AD_SPEND_TABLE}
            GROUP BY 1
          ),
          s AS (
            SELECT LOWER(campaign_last_click) AS campaign_key,
                   SUM(booking_revenue)::DOUBLE AS revenue,
                   SUM(bookings)::BIGINT AS bookings
            FROM ${SESSIONS_TABLE}
            WHERE campaign_last_click IS NOT NULL
            GROUP BY 1
          )
          SELECT a.campaign_key AS campaign,
                 a.spend,
                 COALESCE(s.revenue, 0)::DOUBLE AS revenue,
                 COALESCE(s.bookings, 0)::BIGINT AS bookings,
                 (COALESCE(s.revenue, 0)::DOUBLE / NULLIF(a.spend, 0))::DOUBLE AS roas,
                 (a.spend / NULLIF(COALESCE(s.bookings, 0), 0))::DOUBLE AS cpb
          FROM a LEFT JOIN s ON a.campaign_key = s.campaign_key
          WHERE a.spend > 0
          ORDER BY revenue DESC
          LIMIT 25
        `,
      }),
  });
  const roasRows = (roas.data?.rows ?? []) as any[];

  const k = kpis.data?.rows[0] as Record<string, any> | undefined;
  const sourceRows = (bySource.data?.rows ?? []) as any[];
  const accountRows = (byAccount.data?.rows ?? []) as any[];

  // Compute CTR/CPC/CPM client-side (can't be averaged across rows correctly).
  const sourceEconomics = useMemo(() => {
    return sourceRows.map((r) => {
      const spend = Number(r.spend ?? 0);
      const clicks = Number(r.clicks ?? 0);
      const impressions = Number(r.impressions ?? 0);
      return {
        source: String(r.source ?? ''),
        spend,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend * 1000) / impressions : 0,
      };
    });
  }, [sourceRows]);

  const campaignRows: CampaignRow[] = useMemo(() => {
    const rows = (topCampaigns.data?.rows ?? []) as any[];
    return rows.map((r) => {
      const spend = Number(r.spend ?? 0);
      const clicks = Number(r.clicks ?? 0);
      const impressions = Number(r.impressions ?? 0);
      return {
        campaign: String(r.campaign ?? ''),
        source: String(r.source ?? ''),
        account_name: String(r.account_name ?? ''),
        spend,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend * 1000) / impressions : 0,
      };
    });
  }, [topCampaigns.data]);

  const campaignCols: ColumnDef<CampaignRow, any>[] = useMemo(
    () => [
      {
        header: 'Campaign',
        accessorKey: 'campaign',
        cell: (i) => (
          <span className="font-mono text-xs" title={String(i.getValue())}>
            {String(i.getValue())}
          </span>
        ),
      },
      { header: 'Source', accessorKey: 'source' },
      { header: 'Spend', accessorKey: 'spend', cell: (i) => <span className="font-mono">${fmtNum(i.getValue(), 2)}</span> },
      { header: 'Clicks', accessorKey: 'clicks', cell: (i) => <span className="font-mono">{Number(i.getValue()).toLocaleString()}</span> },
      { header: 'Impr.', accessorKey: 'impressions', cell: (i) => <span className="font-mono">{Number(i.getValue()).toLocaleString()}</span> },
      { header: 'CTR', accessorKey: 'ctr', cell: (i) => <span className="font-mono">{(Number(i.getValue() ?? 0) * 100).toFixed(2)}%</span> },
      { header: 'CPC', accessorKey: 'cpc', cell: (i) => <span className="font-mono">${fmtNum(i.getValue(), 2)}</span> },
      { header: 'CPM', accessorKey: 'cpm', cell: (i) => <span className="font-mono">${fmtNum(i.getValue(), 2)}</span> },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Paid Media"
        subtitle="WindsorAI ad_spend — spend, clicks, impressions, CTR, CPC, CPM by source and campaign."
      />

      {kpis.error && <ErrorPanel error={kpis.error} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {kpis.isPending && !kpis.error && <div className="md:col-span-4"><Loading height={80} /></div>}
        {k && (
          <>
            <KPICard
              label="Total spend"
              value={`$${fmtNum(k.total_spend, 0)}`}
              hint={k.min_date && k.max_date ? `${k.min_date} → ${k.max_date}` : undefined}
            />
            <KPICard label="Clicks" value={Number(k.total_clicks).toLocaleString()} />
            <KPICard label="Impressions" value={Number(k.total_impressions).toLocaleString()} />
            <KPICard label="Campaigns" value={Number(k.campaigns).toLocaleString()} hint={`across ${k.sources} sources`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Card title="Spend by source" subtitle="google / facebook / bing" className="lg:col-span-2">
          {bySource.error && <ErrorPanel error={bySource.error} />}
          {bySource.isPending && !bySource.error && <Loading height={240} />}
          {bySource.data && sourceEconomics.length === 0 && <Empty />}
          {bySource.data && sourceEconomics.length > 0 && (
            <DonutChart data={sourceEconomics.map((r) => ({ name: r.source, value: r.spend }))} />
          )}
        </Card>
        <Card title="Source economics" subtitle="CTR, CPC, CPM per source" className="lg:col-span-3">
          {bySource.error && <ErrorPanel error={bySource.error} />}
          {bySource.isPending && !bySource.error && <Loading height={240} />}
          {bySource.data && sourceEconomics.length === 0 && <Empty />}
          {bySource.data && sourceEconomics.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-3 py-2 text-left font-semibold">Source</th>
                    <th className="px-3 py-2 text-right font-semibold">Spend</th>
                    <th className="px-3 py-2 text-right font-semibold">Clicks</th>
                    <th className="px-3 py-2 text-right font-semibold">Impr.</th>
                    <th className="px-3 py-2 text-right font-semibold">CTR</th>
                    <th className="px-3 py-2 text-right font-semibold">CPC</th>
                    <th className="px-3 py-2 text-right font-semibold">CPM</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceEconomics.map((r) => (
                    <tr key={r.source} className="border-b border-[var(--color-border)]/50">
                      <td className="px-3 py-2 font-medium">{r.source}</td>
                      <td className="px-3 py-2 text-right font-mono">${fmtNum(r.spend, 2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.impressions.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{(r.ctr * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-mono">${fmtNum(r.cpc, 2)}</td>
                      <td className="px-3 py-2 text-right font-mono">${fmtNum(r.cpm, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Card title="Spend by account" subtitle="distinct account_name" className="lg:col-span-2">
          {byAccount.error && <ErrorPanel error={byAccount.error} />}
          {byAccount.isPending && !byAccount.error && <Loading height={200} />}
          {byAccount.data && accountRows.length === 0 && <Empty />}
          {byAccount.data && accountRows.length > 0 && (
            <BarChart
              horizontal
              height={Math.max(200, accountRows.length * 36)}
              data={accountRows.map((r) => ({ name: String(r.account_name), value: Number(r.spend) }))}
            />
          )}
        </Card>
        <Card
          title="Top campaigns"
          subtitle="top 25 by chosen metric"
          right={
            <div className="flex items-center gap-2">
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selCls}>
                <option value="">all sources</option>
                <option value="google">google</option>
                <option value="facebook">facebook</option>
                <option value="bing">bing</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={selCls}>
                <option value="spend">by spend</option>
                <option value="clicks">by clicks</option>
                <option value="impressions">by impressions</option>
                <option value="cpc">by CPC</option>
              </select>
            </div>
          }
          className="lg:col-span-3"
        >
          {topCampaigns.error && <ErrorPanel error={topCampaigns.error} />}
          {topCampaigns.isPending && !topCampaigns.error && <Loading height={340} />}
          {topCampaigns.data && campaignRows.length === 0 && <Empty />}
          {topCampaigns.data && campaignRows.length > 0 && (
            <DataTable data={campaignRows} columns={campaignCols} height={500} />
          )}
        </Card>
      </div>

      <Card
        title="ROAS by campaign"
        subtitle="ad_spend ⋈ ga4_sessions on LOWER(campaign) — top 25 by revenue"
        right={
          loadRoas ? (
            <button
              onClick={() => roas.refetch()}
              disabled={roas.isFetching}
              className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40"
            >
              {roas.isFetching ? 'Refreshing…' : '↻ Refresh'}
            </button>
          ) : (
            <button
              onClick={() => setLoadRoas(true)}
              className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white font-medium"
            >
              Compute ROAS
            </button>
          )
        }
      >
        {!loadRoas && (
          <div className="text-sm text-[var(--color-text-muted)]">
            The ROAS join scans all sessions and is slower than the other panels on this page.
            Click <b>Compute ROAS</b> to run it on demand.
          </div>
        )}
        {loadRoas && roas.isFetching && <Loading height={300} />}
        {roas.error && <ErrorPanel error={roas.error} />}
        {roas.data && roasRows.length === 0 && <Empty>No joined rows — campaign names may not match between sources.</Empty>}
        {roas.data && roasRows.length > 0 && (
          <div className="overflow-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface-2)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Campaign (lowered)</th>
                  <th className="px-3 py-2 text-right font-semibold">Spend</th>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                  <th className="px-3 py-2 text-right font-semibold">ROAS</th>
                  <th className="px-3 py-2 text-right font-semibold">CPB</th>
                </tr>
              </thead>
              <tbody>
                {roasRows.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]/50">
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[380px]" title={r.campaign}>{r.campaign}</td>
                    <td className="px-3 py-2 text-right font-mono">${fmtNum(r.spend, 2)}</td>
                    <td className="px-3 py-2 text-right font-mono">${fmtNum(r.revenue, 2)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.bookings).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{r.roas == null ? '—' : `${fmtNum(r.roas, 2)}×`}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.cpb == null ? '—' : `$${fmtNum(r.cpb, 2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-xs text-[var(--color-text-muted)] mt-3">
          <b>Coverage caveat</b>: ad_spend includes only Google Ads, Bing, and Facebook. Other paid channels
          (TikTok, DV360, etc.) are not represented, so paid ROAS from this table will undercount total spend.
          Attribution is <code>campaign_last_click</code>; non-paid sessions (direct, organic) are excluded by the join.
        </div>
      </Card>
    </div>
  );
}

const selCls =
  'bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs text-[var(--color-text)]';

function fmtNum(v: any, dp = 0): string {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
