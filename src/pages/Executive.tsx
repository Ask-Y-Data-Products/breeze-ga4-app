import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { runQuery } from '../api/asky';
import { SESSIONS_TABLE } from '../data/tables';
import { useFilters, PRODUCT_TO_COLUMN, INTERNAL_CHANNELS } from '../state/store';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import AnomalyBanner from '../components/AnomalyBanner';
import Headlines from '../components/Headlines';
import Sparkline from '../components/Sparkline';
import { KPICard, Card } from '../components/Card';
import { BarChart, LineChart } from '../components/Chart';
import StackedShareBar from '../components/StackedShareBar';
import { Loading, ErrorPanel } from '../components/QueryState';

// Executive page, redesigned following established dashboard UX patterns:
//  - F-pattern hierarchy (primary KPI top-left, largest; secondary KPIs to the right)
//  - Narrative headlines above the fold (tell a story, don't just show numbers)
//  - Sparklines inside every KPI card (context: "where are we today, movement since last, trend")
//  - Bento-grid layout with consistent alignment
//  - Cognitive load: exactly 4 primary KPIs (research suggests ≤9; dropoff past 12)
//  - Anomaly banner demoted to a compact collapsible strip (still visible, not dominant)
//  - Big hourly-trend chart in the left column below the KPIs (trend answers "long-term movement")
//  - Breakdowns (device, country, channel) on the right / below

interface SessionFilterState {
  dateFrom: string | null;
  dateTo: string | null;
  channel: string | null;
  device: string | null;
  country: string[];
  loggedIn: 'all' | 'logged_in' | 'logged_out';
  product: string | null;
  excludeInternalTraffic: boolean;
}

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}

function buildSessionWhere(f: SessionFilterState): string {
  const parts: string[] = [];
  if (f.dateFrom) parts.push(`session_date >= DATE '${f.dateFrom}'`);
  if (f.dateTo) parts.push(`session_date <= DATE '${f.dateTo}'`);
  if (f.channel) parts.push(`channel_session = '${escSql(f.channel)}'`);
  if (f.device) parts.push(`device_category = '${escSql(f.device)}'`);
  if (f.country && f.country.length > 0) {
    const list = f.country.map((c) => `'${escSql(c)}'`).join(', ');
    parts.push(`country IN (${list})`);
  }
  if (f.loggedIn === 'logged_in') parts.push(`logged_in = TRUE`);
  if (f.loggedIn === 'logged_out') parts.push(`logged_in = FALSE`);
  if (f.product && PRODUCT_TO_COLUMN[f.product]) {
    parts.push(`${PRODUCT_TO_COLUMN[f.product]} > 0`);
  }
  if (f.excludeInternalTraffic && !f.channel) {
    const list = INTERNAL_CHANNELS.map((c) => `'${escSql(c)}'`).join(', ');
    parts.push(`(channel_session IS NULL OR channel_session NOT IN (${list}))`);
  }
  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

export default function Executive() {
  const filters = useFilters();
  const where = buildSessionWhere(filters);

  // Unfiltered baseline session count — powers the "Filtered to X% of sessions"
  // indicator in the applied-filters bar. Fires once and is reused.
  const baseline = useQuery({
    queryKey: ['exec-baseline'],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `SELECT COUNT(*)::BIGINT AS sessions FROM ${SESSIONS_TABLE}`,
      }),
  });
  const baselineSessions = Number((baseline.data?.rows[0] as any)?.sessions ?? 0);

  const kpis = useQuery({
    queryKey: ['exec-kpis-v4', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT
            COUNT(*)::BIGINT AS sessions,
            COUNT(DISTINCT user_pseudo_id)::BIGINT AS users,
            COUNT(DISTINCT CASE WHEN logged_in THEN user_pseudo_id END)::BIGINT AS logged_in_users,
            COUNT(DISTINCT CASE WHEN NOT logged_in THEN user_pseudo_id END)::BIGINT AS logged_out_users,
            SUM(bookings)::BIGINT AS bookings,
            SUM(sign_ups)::BIGINT AS sign_ups,
            SUM(booking_revenue)::DOUBLE AS booking_revenue,
            SUM(modify_trip_revenue)::DOUBLE AS modify_revenue,
            SUM(checkin_revenue)::DOUBLE AS checkin_revenue,
            SUM(refunded_amount)::DOUBLE AS refunds
          FROM ${SESSIONS_TABLE}
          ${where}
        `,
      }),
  });

  // UTC vs local-time view of the hour-of-day chart. GA4 provides both columns.
  const [tz, setTz] = useState<'utc' | 'local'>('utc');
  const tsCol =
    tz === 'utc' ? 'session_start_timestamp_utc' : 'session_start_timestamp_local';

  // Hourly trend for sparklines + the big chart. Uses session_start_timestamp_utc
  // or session_start_timestamp_local depending on the toggle.
  const hourly = useQuery({
    queryKey: ['exec-hourly', where, tz],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT EXTRACT(HOUR FROM ${tsCol})::INTEGER AS hour,
                 COUNT(*)::BIGINT AS sessions,
                 COUNT(DISTINCT user_pseudo_id)::BIGINT AS users,
                 SUM(bookings)::BIGINT AS bookings,
                 SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where || 'WHERE 1=1'}
          AND ${tsCol} IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `,
      }),
  });

  const channel = useQuery({
    queryKey: ['exec-channel-v3', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT channel_session AS name,
                 COUNT(*)::BIGINT AS sessions,
                 SUM(bookings)::BIGINT AS bookings,
                 SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where || 'WHERE 1=1'}
          AND channel_session IS NOT NULL
          GROUP BY 1
          ORDER BY sessions DESC
          LIMIT 10
        `,
      }),
  });

  const device = useQuery({
    queryKey: ['exec-device-v4', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT device_category AS name,
                 COUNT(*)::BIGINT AS sessions,
                 SUM(bookings)::BIGINT AS bookings,
                 SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where || 'WHERE 1=1'}
          AND device_category IS NOT NULL
          GROUP BY 1
          ORDER BY sessions DESC
        `,
      }),
  });

  const country = useQuery({
    queryKey: ['exec-country-v4', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT country AS name,
                 COUNT(*)::BIGINT AS sessions,
                 SUM(bookings)::BIGINT AS bookings,
                 SUM(booking_revenue)::DOUBLE AS revenue,
                 (SUM(booking_revenue)::DOUBLE / NULLIF(COUNT(*), 0))::DOUBLE AS rev_per_session
          FROM ${SESSIONS_TABLE}
          ${where || 'WHERE 1=1'}
          AND country IS NOT NULL
          GROUP BY 1
          ORDER BY sessions DESC
          LIMIT 10
        `,
      }),
  });

  const revenueByProduct = useQuery({
    queryKey: ['exec-revenue-product-v4', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          WITH base AS (
            SELECT NULLIF(SUM(CASE WHEN bookings > 0 THEN 1 ELSE 0 END), 0)::DOUBLE AS booking_sessions
            FROM ${SESSIONS_TABLE} ${where || ''}
          )
          SELECT 'Base fare' AS product,
                 SUM(base_revenue_booking)::DOUBLE AS revenue,
                 (SUM(CASE WHEN base_revenue_booking > 0 THEN 1 ELSE 0 END)::DOUBLE / (SELECT booking_sessions FROM base)) AS attach_rate
          FROM ${SESSIONS_TABLE} ${where || ''}
          UNION ALL
          SELECT 'Bundles', SUM(bundle_revenue_booking)::DOUBLE,
                 (SUM(CASE WHEN bundle_revenue_booking > 0 THEN 1 ELSE 0 END)::DOUBLE / (SELECT booking_sessions FROM base))
          FROM ${SESSIONS_TABLE} ${where || ''}
          UNION ALL
          SELECT 'Bags', SUM(bag_revenue_booking)::DOUBLE,
                 (SUM(CASE WHEN bag_revenue_booking > 0 THEN 1 ELSE 0 END)::DOUBLE / (SELECT booking_sessions FROM base))
          FROM ${SESSIONS_TABLE} ${where || ''}
          UNION ALL
          SELECT 'Seats', SUM(seat_revenue_booking)::DOUBLE,
                 (SUM(CASE WHEN seat_revenue_booking > 0 THEN 1 ELSE 0 END)::DOUBLE / (SELECT booking_sessions FROM base))
          FROM ${SESSIONS_TABLE} ${where || ''}
          UNION ALL
          SELECT 'Insurance', SUM(insurance_revenue_booking)::DOUBLE,
                 (SUM(CASE WHEN insurance_revenue_booking > 0 THEN 1 ELSE 0 END)::DOUBLE / (SELECT booking_sessions FROM base))
          FROM ${SESSIONS_TABLE} ${where || ''}
          UNION ALL
          SELECT 'Car rental', SUM(car_revenue_booking)::DOUBLE,
                 (SUM(CASE WHEN car_revenue_booking > 0 THEN 1 ELSE 0 END)::DOUBLE / (SELECT booking_sessions FROM base))
          FROM ${SESSIONS_TABLE} ${where || ''}
          ORDER BY revenue DESC
        `,
      }),
  });
  const [productMode, setProductMode] = useState<'revenue' | 'attach'>('revenue');

  const k = kpis.data?.rows[0] as Record<string, any> | undefined;
  const totalSessions = Number(k?.sessions ?? 0);
  const totalBookings = Number(k?.bookings ?? 0);
  const totalRevenue =
    Number(k?.booking_revenue ?? 0) +
    Number(k?.modify_revenue ?? 0) +
    Number(k?.checkin_revenue ?? 0);
  const conversionRate = totalSessions > 0 ? (totalBookings / totalSessions) * 100 : 0;

  // Hourly series shaped to full 24 hours. Missing hours are zero-filled so the
  // sparkline doesn't skip buckets.
  const hourlySeries = useMemo(() => {
    const base: Array<{ hour: number; sessions: number; users: number; bookings: number; revenue: number }> =
      Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: 0, users: 0, bookings: 0, revenue: 0 }));
    for (const r of (hourly.data?.rows ?? []) as any[]) {
      const h = Number(r.hour);
      if (h >= 0 && h < 24) {
        base[h] = {
          hour: h,
          sessions: Number(r.sessions ?? 0),
          users: Number(r.users ?? 0),
          bookings: Number(r.bookings ?? 0),
          revenue: Number(r.revenue ?? 0),
        };
      }
    }
    return base;
  }, [hourly.data]);

  const peakIndex = (arr: number[]) => (arr.length === 0 ? null : arr.indexOf(Math.max(...arr)));
  const hourLabel = (h: number) => {
    const suffix = h >= 12 ? 'pm' : 'am';
    const shown = h % 12 === 0 ? 12 : h % 12;
    return `${shown}${suffix}`;
  };

  // Variance-based headlines — each insight is a *deviation* (CR outlier,
  // channel with 0 conversions, CR dip relative to average), with an
  // "Investigate →" action that pre-filters the page to the relevant slice.
  const headlines = useMemo(() => {
    if (!k) return [];
    const out: {
      title: string;
      detail?: string;
      tone?: 'positive' | 'neutral' | 'attention';
      icon?: string;
      action?: { label: string; onClick: () => void };
    }[] = [];

    const chRows = (channel.data?.rows ?? []) as any[];
    const enoughVolume = chRows.filter((r) => Number(r.sessions) >= 200);

    if (enoughVolume.length >= 2 && totalSessions > 0) {
      const pageCR = (totalBookings / totalSessions) * 100;
      // Variance from the overall CR across channels
      const withDelta = enoughVolume.map((r) => {
        const s = Number(r.sessions);
        const b = Number(r.bookings);
        const cr = s > 0 ? (b / s) * 100 : 0;
        return { name: r.name as string, sessions: s, bookings: b, cr, delta: cr - pageCR };
      });
      const best = [...withDelta].sort((a, b) => b.delta - a.delta)[0];
      const worst = [...withDelta].sort((a, b) => a.delta - b.delta)[0];

      if (best && best.delta >= 0.3) {
        out.push({
          title: `${best.name} outperforms on conversion`,
          detail: `${best.cr.toFixed(2)}% CR vs. ${pageCR.toFixed(2)}% overall — ${best.delta >= 0 ? '+' : ''}${best.delta.toFixed(2)}pp`,
          tone: 'positive',
          icon: '▲',
          action: {
            label: `Filter to ${best.name}`,
            onClick: () => filters.setFilter('channel', best.name),
          },
        });
      }
      if (worst && worst.delta <= -0.3 && worst.name !== best?.name) {
        out.push({
          title: `${worst.name} underperforms on conversion`,
          detail: `${worst.cr.toFixed(2)}% CR vs. ${pageCR.toFixed(2)}% overall — ${worst.delta.toFixed(2)}pp below`,
          tone: 'attention',
          icon: '▼',
          action: {
            label: `Investigate ${worst.name}`,
            onClick: () => filters.setFilter('channel', worst.name),
          },
        });
      }
    }

    // Peak hour — kept as useful operational context (not strictly a variance)
    const sessHourly = hourlySeries.map((h) => h.sessions);
    const peak = peakIndex(sessHourly);
    const pageCR = totalSessions > 0 ? (totalBookings / totalSessions) * 100 : 0;
    if (peak != null && sessHourly[peak] > 0 && out.length < 3) {
      const peakSess = sessHourly[peak];
      const peakBook = hourlySeries[peak].bookings;
      const peakCR = peakSess > 0 ? (peakBook / peakSess) * 100 : 0;
      const crDelta = peakCR - pageCR;
      out.push({
        title: `Peak traffic at ${hourLabel(peak)} ${tz === 'utc' ? 'UTC' : 'local'}`,
        detail: `${fmt(peakSess)} sessions · CR ${peakCR.toFixed(2)}% (${
          crDelta >= 0 ? '+' : ''
        }${crDelta.toFixed(2)}pp vs. day avg)`,
        tone: crDelta >= 0 ? 'neutral' : 'attention',
        icon: '⟡',
      });
    }

    // Refund rate callout if the filtered view has meaningful refunds
    if (Number(k.refunds) > 0 && Number(k.booking_revenue) > 0 && out.length < 3) {
      const refundPct =
        (Number(k.refunds) / Number(k.booking_revenue)) * 100;
      if (refundPct >= 3) {
        out.push({
          title: `Refunds are ${refundPct.toFixed(1)}% of booking revenue`,
          detail: `$${fmtMoney(Number(k.refunds))} refunded against $${fmtMoney(Number(k.booking_revenue))} in bookings`,
          tone: refundPct >= 8 ? 'attention' : 'neutral',
          icon: '⟲',
        });
      }
    }

    return out;
  }, [k, channel.data, hourlySeries, totalBookings, totalSessions, filters, tz]);

  const sessionsSpark = hourlySeries.map((h) => h.sessions);
  const usersSpark = hourlySeries.map((h) => h.users);
  const bookingsSpark = hourlySeries.map((h) => h.bookings);
  const revenueSpark = hourlySeries.map((h) => h.revenue);

  return (
    <div>
      <PageHeader
        title="Executive Summary"
        subtitle="Session-grain KPIs, narrative insights and hourly trend from GA4 sessions."
      />
      <FilterBar filteredSessions={totalSessions} totalSessions={baselineSessions} />
      <AnomalyBanner compact />

      {/* Headlines — narrative insights above the fold. */}
      {kpis.isLoading ? (
        <Headlines items={[]} loading />
      ) : (
        <Headlines items={headlines} />
      )}

      {kpis.error && <ErrorPanel error={kpis.error} />}

      {/* KPI row — F-pattern: primary (Revenue) top-left with gradient accent,
          secondary KPIs right, each with sparkline + peak context. */}
      {kpis.isLoading && <Loading />}
      {k && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <KPICard
            primary
            icon="$"
            label="Total revenue"
            value={`$${fmtMoney(totalRevenue)}`}
            hint={`− $${fmtMoney(k.refunds)} refunded`}
            sparkline={<Sparkline data={revenueSpark} highlightIndex={peakIndex(revenueSpark)} />}
          />
          <KPICard
            icon="⎈"
            label="Bookings"
            value={fmt(totalBookings)}
            trend={{ dir: conversionRate >= 1.5 ? 'up' : 'down', text: `${conversionRate.toFixed(2)}% CR` }}
            sparkline={<Sparkline data={bookingsSpark} highlightIndex={peakIndex(bookingsSpark)} />}
          />
          <KPICard
            icon="◔"
            label="Sessions"
            value={fmt(totalSessions)}
            hint={peakIndex(sessionsSpark) != null ? `peak ${hourLabel(peakIndex(sessionsSpark)!)}` : undefined}
            sparkline={<Sparkline data={sessionsSpark} highlightIndex={peakIndex(sessionsSpark)} />}
          />
          <KPICard
            icon="⌘"
            label="Users"
            value={fmt(k.users)}
            hint={(() => {
              const li = Number(k.logged_in_users ?? 0);
              const lo = Number(k.logged_out_users ?? 0);
              const total = li + lo || 1;
              return `${((li / total) * 100).toFixed(0)}% logged-in · ${((lo / total) * 100).toFixed(0)}% anon`;
            })()}
            sparkline={<Sparkline data={usersSpark} highlightIndex={peakIndex(usersSpark)} />}
          />
        </div>
      )}

      {/* Primary chart row — big trend on the left (F-pattern), breakdown on the right. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Card
          title="Sessions & conversion by hour of day"
          subtitle="Left axis: sessions · right axis: conversion rate %"
          className="lg:col-span-3"
          right={
            <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden text-[11px]">
              {(['utc', 'local'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTz(t)}
                  className={`px-2.5 py-1 uppercase tracking-wider font-semibold ${
                    tz === t
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                  }`}
                >
                  {t === 'utc' ? 'UTC' : 'Local'}
                </button>
              ))}
            </div>
          }
        >
          {hourly.isLoading && <Loading height={280} />}
          {hourly.error && <ErrorPanel error={hourly.error} />}
          {hourly.data && (
            <LineChart
              categories={hourlySeries.map((h) => hourLabel(h.hour))}
              series={[
                { name: 'Sessions', data: sessionsSpark },
                {
                  name: 'Conversion rate %',
                  yAxisIndex: 1,
                  data: hourlySeries.map((h) => (h.sessions > 0 ? (h.bookings / h.sessions) * 100 : 0)),
                  formatter: '{value}%',
                },
              ]}
              height={280}
            />
          )}
        </Card>
        <Card
          title="Device mix — traffic vs conversion"
          subtitle={filters.device ? `Filtered by ${filters.device} · click a tile to clear` : 'Click a tile to filter the page'}
          className="lg:col-span-2"
        >
          {device.isLoading && <Loading height={280} />}
          {device.error && <ErrorPanel error={device.error} />}
          {device.data && device.data.rows.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1.5">
                Share of sessions
              </div>
              <StackedShareBar
                items={device.data.rows.map((r: any) => ({
                  name: String(r.name),
                  value: Number(r.sessions),
                }))}
              />
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mt-5 mb-1.5">
                Conversion rate per device
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {device.data.rows.map((r: any) => {
                  const sess = Number(r.sessions);
                  const book = Number(r.bookings);
                  const cr = sess > 0 ? (book / sess) * 100 : 0;
                  const isActive = filters.device === r.name;
                  return (
                    <button
                      key={r.name}
                      onClick={() => filters.setFilter('device', isActive ? null : r.name)}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
                        {r.name}
                      </div>
                      <div className="text-lg font-semibold tracking-tight leading-none mt-1">
                        {cr.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                        CR · {book.toLocaleString()} / {sess.toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Secondary breakdown row — channel table (F-pattern: bigger left),
          top countries (right). */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Card
          title="Sessions & bookings by channel"
          subtitle={
            filters.channel
              ? `Filtered by ${filters.channel} · click a row to change`
              : 'channel_session, top 10 · CR ≥ 1.5% benchmark is shown in green · click a row to filter'
          }
          className="lg:col-span-3"
        >
          {channel.isLoading && <Loading height={300} />}
          {channel.error && <ErrorPanel error={channel.error} />}
          {channel.data && (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-3 py-2 text-left font-semibold">Channel</th>
                    <th className="px-3 py-2 text-right font-semibold">Sessions</th>
                    <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                    <th className="px-3 py-2 text-right font-semibold">Conv.</th>
                    <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {channel.data.rows.map((r: any) => {
                    const sess = Number(r.sessions);
                    const book = Number(r.bookings);
                    const cr = sess > 0 ? (book / sess) * 100 : 0;
                    const isActive = filters.channel === r.name;
                    return (
                      <tr
                        key={r.name}
                        onClick={() => filters.setFilter('channel', isActive ? null : r.name)}
                        className={`border-b border-[var(--color-border)]/50 cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[var(--color-primary-soft)]'
                            : 'hover:bg-[var(--color-surface-2)]'
                        }`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {isActive && <span className="text-[var(--color-primary)] mr-1">✓</span>}
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{sess.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono">{book.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          <span
                            className={
                              cr >= 1.5
                                ? 'text-[var(--color-success)] font-semibold'
                                : sess >= 200 && cr < 0.5
                                ? 'text-[var(--color-warning)] font-semibold'
                                : ''
                            }
                            title={
                              cr >= 1.5
                                ? 'Above 1.5% CR benchmark'
                                : sess >= 200 && cr < 0.5
                                ? 'Well below 1.5% CR benchmark with meaningful volume'
                                : 'Within ±0.5pp of 1.5% benchmark'
                            }
                          >
                            {cr.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">${fmtMoney(Number(r.revenue))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card
          title="Top countries — traffic vs yield"
          subtitle={
            filters.country.length > 0
              ? `Filtered to ${filters.country.length === 1 ? filters.country[0] : `${filters.country.length} countries`} · click to toggle`
              : 'Bar = sessions · $/session = revenue per session · click to toggle'
          }
          className="lg:col-span-2"
        >
          {country.isLoading && <Loading height={300} />}
          {country.error && <ErrorPanel error={country.error} />}
          {country.data && (
            <CountryYieldTable
              rows={country.data.rows.map((r: any) => ({
                name: String(r.name),
                sessions: Number(r.sessions ?? 0),
                revenue: Number(r.revenue ?? 0),
                revPerSession: Number(r.rev_per_session ?? 0),
              }))}
              selected={filters.country}
              onToggle={(name) =>
                filters.setFilter(
                  'country',
                  filters.country.includes(name)
                    ? filters.country.filter((c) => c !== name)
                    : [...filters.country, name],
                )
              }
            />
          )}
        </Card>
      </div>

      {/* Bottom row — product revenue breakdown (supporting detail). */}
      <Card
        title={productMode === 'revenue' ? 'Booking revenue by product' : 'Attach rate by product'}
        subtitle={
          filters.product
            ? `Filtered by sessions with ${filters.product} revenue · click the same bar to clear`
            : productMode === 'revenue'
            ? 'Total $ by product · click a bar to filter the page'
            : '% of booking sessions that included each product · industry-native metric'
        }
        right={
          <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden text-[11px]">
            {(['revenue', 'attach'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setProductMode(m)}
                className={`px-2.5 py-1 uppercase tracking-wider font-semibold ${
                  productMode === m
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                }`}
              >
                {m === 'revenue' ? 'Revenue' : 'Attach rate'}
              </button>
            ))}
          </div>
        }
      >
        {revenueByProduct.isLoading && <Loading height={260} />}
        {revenueByProduct.error && <ErrorPanel error={revenueByProduct.error} />}
        {revenueByProduct.data && (
          <BarChart
            horizontal
            height={260}
            data={revenueByProduct.data.rows.map((r: any) => ({
              name: r.product,
              value:
                productMode === 'revenue'
                  ? Number(r.revenue ?? 0)
                  : Number(r.attach_rate ?? 0) * 100,
            }))}
            onItemClick={(name) => filters.setFilter('product', filters.product === name ? null : name)}
          />
        )}
      </Card>
    </div>
  );
}

function fmt(n: any): string {
  const x = Number(n ?? 0);
  if (!isFinite(x)) return '—';
  return x.toLocaleString();
}
function fmtMoney(n: any): string {
  const x = Number(n ?? 0);
  if (!isFinite(x)) return '0';
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Two-metric country table: horizontal bar for sessions (length)
 *  + numeric revenue-per-session column (second encoding). */
function CountryYieldTable({
  rows,
  selected,
  onToggle,
}: {
  rows: { name: string; sessions: number; revenue: number; revPerSession: number }[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  if (rows.length === 0) return <div className="text-sm text-[var(--color-text-muted)]">No data</div>;
  const maxSess = Math.max(...rows.map((r) => r.sessions), 1);
  const maxRps = Math.max(...rows.map((r) => r.revPerSession), 0.01);

  return (
    <div className="divide-y divide-[var(--color-border)]/60">
      <div className="grid grid-cols-[1fr_90px_80px] gap-2 px-1 pb-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
        <span>Country</span>
        <span className="text-right">Sessions</span>
        <span className="text-right">$ / session</span>
      </div>
      {rows.map((r) => {
        const isActive = selected.includes(r.name);
        return (
          <button
            key={r.name}
            onClick={() => onToggle(r.name)}
            className={`w-full grid grid-cols-[1fr_90px_80px] gap-2 px-1 py-1.5 text-sm text-left items-center transition-colors ${
              isActive ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="min-w-0 flex items-center gap-2">
              {isActive && <span className="text-[var(--color-primary)] text-xs">✓</span>}
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs">{r.name}</div>
                <div className="h-1.5 bg-[var(--color-surface-2)] rounded overflow-hidden mt-1">
                  <div
                    className="h-full rounded bg-[var(--color-primary)]"
                    style={{ width: `${(r.sessions / maxSess) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-xs text-[var(--color-text)]">
              {r.sessions.toLocaleString()}
            </div>
            <div className="text-right">
              <div className="font-mono text-xs font-semibold">${r.revPerSession.toFixed(2)}</div>
              <div
                className="h-1 rounded mt-0.5 ml-auto"
                style={{
                  width: `${Math.round((r.revPerSession / maxRps) * 56)}px`,
                  background: '#059669',
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
