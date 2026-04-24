import { useQuery } from '@tanstack/react-query';
import { Fragment, useMemo } from 'react';
import { runQuery } from '../api/asky';
import { SESSIONS_TABLE } from '../data/tables';
import { useFilters, PRODUCT_TO_COLUMN, INTERNAL_CHANNELS } from '../state/store';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import { KPICard, Card } from '../components/Card';
import { BarChart } from '../components/Chart';
import { Loading, ErrorPanel, Empty } from '../components/QueryState';

// Segments page — airline-specific slices of the same session grain used on
// the Executive page. All cards share the sticky FilterBar, so every slice
// respects the same date/channel/device/country/product filters.

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

export default function Segments() {
  const filters = useFilters();
  const where = buildSessionWhere(filters);

  // Unfiltered baseline so the FilterBar's Applied pill can show "X% of total".
  const baseline = useQuery({
    queryKey: ['seg-baseline'],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `SELECT COUNT(*)::BIGINT AS sessions FROM ${SESSIONS_TABLE}`,
      }),
  });
  const baselineSessions = Number((baseline.data?.rows[0] as any)?.sessions ?? 0);

  // Filtered session count, for header context + the FilterBar indicator.
  const totals = useQuery({
    queryKey: ['seg-totals', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `SELECT COUNT(*)::BIGINT AS sessions, SUM(bookings)::BIGINT AS bookings,
                       SUM(booking_revenue)::DOUBLE AS revenue
                FROM ${SESSIONS_TABLE} ${where}`,
      }),
  });
  const t = totals.data?.rows[0] as any;
  const totalSessions = Number(t?.sessions ?? 0);
  const totalBookings = Number(t?.bookings ?? 0);

  // 1) Top routes (origin → destination pairs).
  const routes = useQuery({
    queryKey: ['seg-routes', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT origin, destination,
                 COUNT(*)::BIGINT AS sessions,
                 SUM(bookings)::BIGINT AS bookings,
                 SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where || 'WHERE 1=1'}
          AND origin IS NOT NULL AND destination IS NOT NULL
          GROUP BY 1, 2
          ORDER BY bookings DESC NULLS LAST, sessions DESC
          LIMIT 20
        `,
      }),
  });

  // 2) Booking curve by days-to-departure bucket.
  const bookingCurve = useQuery({
    queryKey: ['seg-booking-curve', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT
            CASE
              WHEN days_to_departure IS NULL THEN 'Unknown'
              WHEN days_to_departure < 0 THEN 'Past'
              WHEN days_to_departure <= 3 THEN '0–3 d'
              WHEN days_to_departure <= 7 THEN '4–7 d'
              WHEN days_to_departure <= 14 THEN '8–14 d'
              WHEN days_to_departure <= 30 THEN '15–30 d'
              WHEN days_to_departure <= 60 THEN '31–60 d'
              WHEN days_to_departure <= 90 THEN '61–90 d'
              ELSE '90+ d'
            END AS bucket,
            CASE
              WHEN days_to_departure IS NULL THEN 99
              WHEN days_to_departure < 0 THEN -1
              WHEN days_to_departure <= 3 THEN 0
              WHEN days_to_departure <= 7 THEN 1
              WHEN days_to_departure <= 14 THEN 2
              WHEN days_to_departure <= 30 THEN 3
              WHEN days_to_departure <= 60 THEN 4
              WHEN days_to_departure <= 90 THEN 5
              ELSE 6
            END AS sort_order,
            COUNT(*)::BIGINT AS sessions,
            SUM(bookings)::BIGINT AS bookings,
            SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where}
          GROUP BY 1, 2
          ORDER BY sort_order
        `,
      }),
  });

  // 3) New vs returning visitors — uses days_since_first_session.
  const newVsReturning = useQuery({
    queryKey: ['seg-new-returning', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT
            CASE
              WHEN days_since_first_session IS NULL THEN 'Unknown'
              WHEN days_since_first_session = 0 THEN 'New'
              ELSE 'Returning'
            END AS segment,
            COUNT(*)::BIGINT AS sessions,
            COUNT(DISTINCT user_pseudo_id)::BIGINT AS users,
            SUM(bookings)::BIGINT AS bookings,
            SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where}
          GROUP BY 1
          ORDER BY sessions DESC
        `,
      }),
  });

  // 4) Origin tier × Destination tier matrix.
  const tierMatrix = useQuery({
    queryKey: ['seg-tier-matrix', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT origin_tier_name AS origin_tier,
                 destination_tier_name AS dest_tier,
                 COUNT(*)::BIGINT AS sessions,
                 SUM(bookings)::BIGINT AS bookings,
                 SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where || 'WHERE 1=1'}
          AND origin_tier_name IS NOT NULL AND destination_tier_name IS NOT NULL
          GROUP BY 1, 2
          ORDER BY sessions DESC
        `,
      }),
  });

  // 5) Trip type (one-way vs round-trip, derived from return_date) + passenger mix.
  const tripType = useQuery({
    queryKey: ['seg-trip-type', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT
            CASE
              WHEN departure_date IS NULL THEN 'No itinerary'
              WHEN return_date IS NULL THEN 'One-way'
              ELSE 'Round-trip'
            END AS trip_type,
            COUNT(*)::BIGINT AS sessions,
            SUM(bookings)::BIGINT AS bookings,
            SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where}
          GROUP BY 1
          ORDER BY sessions DESC
        `,
      }),
  });

  const paxMix = useQuery({
    queryKey: ['seg-pax-mix', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          WITH p AS (
            SELECT
              COALESCE(adult_passengers,0) AS a,
              COALESCE(child_passengers,0) AS c,
              COALESCE(infant_passengers,0) AS i,
              bookings, booking_revenue
            FROM ${SESSIONS_TABLE}
            ${where || 'WHERE 1=1'}
            AND (adult_passengers IS NOT NULL OR child_passengers IS NOT NULL OR infant_passengers IS NOT NULL)
          )
          SELECT
            CASE
              WHEN a = 0 AND c = 0 AND i = 0 THEN 'None'
              WHEN a = 1 AND c = 0 AND i = 0 THEN 'Solo adult'
              WHEN a = 2 AND c = 0 AND i = 0 THEN '2 adults'
              WHEN a >= 3 AND c = 0 AND i = 0 THEN '3+ adults'
              WHEN c >= 1 OR i >= 1 THEN 'With kids/infants'
              ELSE 'Other'
            END AS group_type,
            COUNT(*)::BIGINT AS sessions,
            SUM(bookings)::BIGINT AS bookings,
            SUM(booking_revenue)::DOUBLE AS revenue
          FROM p
          GROUP BY 1
          ORDER BY sessions DESC
        `,
      }),
  });

  // 6) Ad-intent mix — parsed paid channel × targeting.
  const adIntent = useQuery({
    queryKey: ['seg-ad-intent', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT parsed_channel_session AS channel,
                 parsed_publisher_session AS publisher,
                 parsed_targeting_session AS targeting,
                 COUNT(*)::BIGINT AS sessions,
                 SUM(bookings)::BIGINT AS bookings,
                 SUM(booking_revenue)::DOUBLE AS revenue
          FROM ${SESSIONS_TABLE}
          ${where || 'WHERE 1=1'}
          AND parsed_channel_session IS NOT NULL
          GROUP BY 1, 2, 3
          ORDER BY sessions DESC
          LIMIT 15
        `,
      }),
  });

  // 7) Cardholder / loyalty KPI.
  const cardholder = useQuery({
    queryKey: ['seg-cardholder', where],
    queryFn: () =>
      runQuery({
        modelId: SESSIONS_TABLE,
        query: `
          SELECT
            SUM(CASE WHEN cardholder THEN 1 ELSE 0 END)::BIGINT AS ch_sessions,
            COUNT(*)::BIGINT AS total_sessions,
            SUM(CASE WHEN cardholder THEN bookings ELSE 0 END)::BIGINT AS ch_bookings,
            SUM(bookings)::BIGINT AS total_bookings,
            SUM(CASE WHEN cardholder THEN booking_revenue ELSE 0 END)::DOUBLE AS ch_revenue,
            SUM(booking_revenue)::DOUBLE AS total_revenue,
            SUM(CASE WHEN purchase_history = 'prior_purchase' THEN 1 ELSE 0 END)::BIGINT AS repeat_sessions,
            SUM(CASE WHEN purchase_history = 'prior_purchase' THEN bookings ELSE 0 END)::BIGINT AS repeat_bookings
          FROM ${SESSIONS_TABLE}
          ${where}
        `,
      }),
  });

  const ch = cardholder.data?.rows[0] as any;

  // Route list — memoized shaping for the top-routes table.
  const topRoutes = useMemo(() => {
    const rows = (routes.data?.rows ?? []) as any[];
    return rows.map((r) => {
      const sess = Number(r.sessions ?? 0);
      const book = Number(r.bookings ?? 0);
      return {
        route: `${r.origin} → ${r.destination}`,
        origin: String(r.origin),
        destination: String(r.destination),
        sessions: sess,
        bookings: book,
        revenue: Number(r.revenue ?? 0),
        cr: sess > 0 ? (book / sess) * 100 : 0,
        rps: sess > 0 ? Number(r.revenue ?? 0) / sess : 0,
      };
    });
  }, [routes.data]);

  // Tier matrix — pivot rows into a 2D grid.
  const tierGrid = useMemo(() => {
    const rows = (tierMatrix.data?.rows ?? []) as any[];
    const origins = new Set<string>();
    const dests = new Set<string>();
    const cells = new Map<string, { sessions: number; bookings: number; revenue: number }>();
    for (const r of rows) {
      const o = String(r.origin_tier);
      const d = String(r.dest_tier);
      origins.add(o);
      dests.add(d);
      cells.set(`${o}|${d}`, {
        sessions: Number(r.sessions ?? 0),
        bookings: Number(r.bookings ?? 0),
        revenue: Number(r.revenue ?? 0),
      });
    }
    const originList = Array.from(origins).sort();
    const destList = Array.from(dests).sort();
    return { originList, destList, cells };
  }, [tierMatrix.data]);

  return (
    <div>
      <PageHeader
        title="Segments"
        subtitle="Airline-specific slices — routes, booking curve, audience, trip + pax mix, ad intent, cardholders."
      />
      <FilterBar filteredSessions={totalSessions} totalSessions={baselineSessions} />

      {/* Top KPI band — one-glance summary row. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KPICard
          primary
          icon="◇"
          label="Sessions (filtered)"
          value={fmt(totalSessions)}
          hint={
            baselineSessions > 0
              ? `${((totalSessions / baselineSessions) * 100).toFixed(1)}% of all sessions`
              : undefined
          }
        />
        <KPICard
          icon="⎈"
          label="Bookings"
          value={fmt(totalBookings)}
          trend={{
            dir: totalBookings / Math.max(totalSessions, 1) >= 0.015 ? 'up' : 'flat',
            text: `${((totalBookings / Math.max(totalSessions, 1)) * 100).toFixed(2)}% CR`,
          }}
        />
        <KPICard
          icon="♣"
          label="Cardholder share"
          value={
            ch && Number(ch.total_sessions) > 0
              ? `${((Number(ch.ch_sessions) / Number(ch.total_sessions)) * 100).toFixed(1)}%`
              : '—'
          }
          hint={
            ch
              ? `${fmt(ch.ch_sessions)} sessions · ${fmt(ch.ch_bookings)} bookings`
              : undefined
          }
        />
        <KPICard
          icon="↺"
          label="Repeat buyer share"
          value={
            ch && Number(ch.total_sessions) > 0
              ? `${((Number(ch.repeat_sessions) / Number(ch.total_sessions)) * 100).toFixed(1)}%`
              : '—'
          }
          hint={
            ch
              ? `${fmt(ch.repeat_bookings)} bookings from prior-purchase users`
              : undefined
          }
        />
      </div>

      {/* Row: Top routes (wide) + Booking curve (narrow). */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Card
          title="Top routes by bookings"
          subtitle="Origin → destination pairs · top 20 · CR and $/session shown for comparable lanes"
          className="lg:col-span-3"
        >
          {routes.isLoading && <Loading height={360} />}
          {routes.error && <ErrorPanel error={routes.error} />}
          {routes.data && topRoutes.length === 0 && <Empty>No route data for this filter.</Empty>}
          {routes.data && topRoutes.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-3 py-2 text-left font-semibold">Route</th>
                    <th className="px-3 py-2 text-right font-semibold">Sessions</th>
                    <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                    <th className="px-3 py-2 text-right font-semibold">CR</th>
                    <th className="px-3 py-2 text-right font-semibold">$ / session</th>
                    <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topRoutes.map((r) => (
                    <tr
                      key={r.route}
                      className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{r.route}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.sessions.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.bookings.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span
                          className={
                            r.cr >= 1.5
                              ? 'text-[var(--color-success)] font-semibold'
                              : r.sessions >= 200 && r.cr < 0.5
                              ? 'text-[var(--color-warning)] font-semibold'
                              : ''
                          }
                        >
                          {r.cr.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">${r.rps.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono">${fmtMoney(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Booking curve"
          subtitle="Sessions by days to departure · earlier buckets = longer-lead shoppers"
          className="lg:col-span-2"
        >
          {bookingCurve.isLoading && <Loading height={320} />}
          {bookingCurve.error && <ErrorPanel error={bookingCurve.error} />}
          {bookingCurve.data && bookingCurve.data.rows.length > 0 && (
            <>
              <BarChart
                height={240}
                data={bookingCurve.data.rows.map((r: any) => ({
                  name: String(r.bucket),
                  value: Number(r.sessions ?? 0),
                }))}
              />
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-[var(--color-text-muted)]">
                {bookingCurve.data.rows.map((r: any) => {
                  const sess = Number(r.sessions ?? 0);
                  const book = Number(r.bookings ?? 0);
                  const cr = sess > 0 ? (book / sess) * 100 : 0;
                  return (
                    <div
                      key={String(r.bucket)}
                      className="flex items-center justify-between border border-[var(--color-border)]/60 rounded-md px-2 py-1"
                    >
                      <span className="truncate">{String(r.bucket)}</span>
                      <span className="font-mono tabular-nums">{cr.toFixed(2)}% CR</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Row: New vs returning + Trip type + Passenger mix. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card title="New vs returning" subtitle="Based on days_since_first_session">
          {newVsReturning.isLoading && <Loading height={180} />}
          {newVsReturning.error && <ErrorPanel error={newVsReturning.error} />}
          {newVsReturning.data && (
            <SegmentTiles
              rows={newVsReturning.data.rows.map((r: any) => ({
                name: String(r.segment),
                sessions: Number(r.sessions ?? 0),
                bookings: Number(r.bookings ?? 0),
                revenue: Number(r.revenue ?? 0),
              }))}
            />
          )}
        </Card>

        <Card title="Trip type" subtitle="Derived: return_date absent → one-way">
          {tripType.isLoading && <Loading height={180} />}
          {tripType.error && <ErrorPanel error={tripType.error} />}
          {tripType.data && (
            <SegmentTiles
              rows={tripType.data.rows.map((r: any) => ({
                name: String(r.trip_type),
                sessions: Number(r.sessions ?? 0),
                bookings: Number(r.bookings ?? 0),
                revenue: Number(r.revenue ?? 0),
              }))}
            />
          )}
        </Card>

        <Card title="Passenger mix" subtitle="Adult / child / infant composition">
          {paxMix.isLoading && <Loading height={180} />}
          {paxMix.error && <ErrorPanel error={paxMix.error} />}
          {paxMix.data && paxMix.data.rows.length === 0 && (
            <Empty>No passenger data for this filter.</Empty>
          )}
          {paxMix.data && paxMix.data.rows.length > 0 && (
            <SegmentTiles
              rows={paxMix.data.rows.map((r: any) => ({
                name: String(r.group_type),
                sessions: Number(r.sessions ?? 0),
                bookings: Number(r.bookings ?? 0),
                revenue: Number(r.revenue ?? 0),
              }))}
            />
          )}
        </Card>
      </div>

      {/* Row: Origin × Destination tier matrix. */}
      <Card
        title="Origin × destination tier matrix"
        subtitle="Session volume by market-tier pair · darker cell = more sessions · hover for bookings + revenue"
        className="mb-4"
      >
        {tierMatrix.isLoading && <Loading height={260} />}
        {tierMatrix.error && <ErrorPanel error={tierMatrix.error} />}
        {tierMatrix.data && tierGrid.originList.length === 0 && (
          <Empty>No tier data for this filter.</Empty>
        )}
        {tierMatrix.data && tierGrid.originList.length > 0 && (
          <TierHeatmap
            origins={tierGrid.originList}
            dests={tierGrid.destList}
            cells={tierGrid.cells}
          />
        )}
      </Card>

      {/* Row: Ad intent. */}
      <Card
        title="Ad-intent mix"
        subtitle="Parsed channel × publisher × targeting for paid sessions · top 15 combinations"
        className="mb-4"
      >
        {adIntent.isLoading && <Loading height={300} />}
        {adIntent.error && <ErrorPanel error={adIntent.error} />}
        {adIntent.data && adIntent.data.rows.length === 0 && (
          <Empty>No paid sessions in this filter.</Empty>
        )}
        {adIntent.data && adIntent.data.rows.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-3 py-2 text-left font-semibold">Channel</th>
                  <th className="px-3 py-2 text-left font-semibold">Publisher</th>
                  <th className="px-3 py-2 text-left font-semibold">Targeting</th>
                  <th className="px-3 py-2 text-right font-semibold">Sessions</th>
                  <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                  <th className="px-3 py-2 text-right font-semibold">CR</th>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {adIntent.data.rows.map((r: any, idx: number) => {
                  const sess = Number(r.sessions ?? 0);
                  const book = Number(r.bookings ?? 0);
                  const cr = sess > 0 ? (book / sess) * 100 : 0;
                  return (
                    <tr
                      key={`${r.channel}|${r.publisher}|${r.targeting}|${idx}`}
                      className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]"
                    >
                      <td className="px-3 py-2 font-medium">{r.channel ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{r.publisher ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{r.targeting ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{sess.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{book.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={cr >= 1.5 ? 'text-[var(--color-success)] font-semibold' : ''}>
                          {cr.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        ${fmtMoney(Number(r.revenue ?? 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Row: Cardholder / loyalty detail. */}
      <Card
        title="Cardholders & loyalty"
        subtitle="Breeze co-brand card holders vs. prior-purchase repeat buyers — share and yield"
      >
        {cardholder.isLoading && <Loading height={160} />}
        {cardholder.error && <ErrorPanel error={cardholder.error} />}
        {ch && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LoyaltyPanel
              label="Cardholders"
              audienceSessions={Number(ch.ch_sessions)}
              audienceBookings={Number(ch.ch_bookings)}
              audienceRevenue={Number(ch.ch_revenue)}
              totalSessions={Number(ch.total_sessions)}
              totalBookings={Number(ch.total_bookings)}
              totalRevenue={Number(ch.total_revenue)}
              color="#3b5bdb"
            />
            <LoyaltyPanel
              label="Prior-purchase users"
              audienceSessions={Number(ch.repeat_sessions)}
              audienceBookings={Number(ch.repeat_bookings)}
              audienceRevenue={0}
              totalSessions={Number(ch.total_sessions)}
              totalBookings={Number(ch.total_bookings)}
              totalRevenue={Number(ch.total_revenue)}
              color="#059669"
              hideRevenue
            />
          </div>
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

/** Small 3-up tile layout for categorical segments: share bar + CR chip. */
function SegmentTiles({
  rows,
}: {
  rows: { name: string; sessions: number; bookings: number; revenue: number }[];
}) {
  const total = rows.reduce((s, r) => s + r.sessions, 0);
  if (total === 0) return <Empty>No data.</Empty>;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const share = (r.sessions / total) * 100;
        const cr = r.sessions > 0 ? (r.bookings / r.sessions) * 100 : 0;
        return (
          <div
            key={r.name}
            className="border border-[var(--color-border)]/60 rounded-lg px-3 py-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-medium truncate">{r.name}</div>
              <div className="text-xs text-[var(--color-text-muted)] font-mono tabular-nums">
                {share.toFixed(1)}%
              </div>
            </div>
            <div className="h-1.5 bg-[var(--color-surface-2)] rounded mt-1 overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary)] rounded"
                style={{ width: `${share}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--color-text-muted)] font-mono tabular-nums">
              <span>{r.sessions.toLocaleString()} sess · {r.bookings.toLocaleString()} bk</span>
              <span
                className={cr >= 1.5 ? 'text-[var(--color-success)] font-semibold' : ''}
              >
                {cr.toFixed(2)}% CR
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Simple DIV-based heatmap — background opacity scales with session count. */
function TierHeatmap({
  origins,
  dests,
  cells,
}: {
  origins: string[];
  dests: string[];
  cells: Map<string, { sessions: number; bookings: number; revenue: number }>;
}) {
  const max = Math.max(...Array.from(cells.values()).map((c) => c.sessions), 1);
  return (
    <div className="overflow-auto">
      <div
        className="grid text-xs"
        style={{
          gridTemplateColumns: `minmax(140px, auto) repeat(${dests.length}, minmax(80px, 1fr))`,
        }}
      >
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
          Origin ↓ / Dest →
        </div>
        {dests.map((d) => (
          <div
            key={`h-${d}`}
            className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] text-center"
          >
            {d}
          </div>
        ))}
        {origins.map((o) => (
          <Fragment key={`row-${o}`}>
            <div
              className="px-2 py-2 text-xs font-medium truncate border-t border-[var(--color-border)]/60"
            >
              {o}
            </div>
            {dests.map((d) => {
              const cell = cells.get(`${o}|${d}`);
              const sess = cell?.sessions ?? 0;
              const opacity = sess > 0 ? 0.12 + (sess / max) * 0.78 : 0;
              const cr =
                cell && cell.sessions > 0 ? (cell.bookings / cell.sessions) * 100 : 0;
              return (
                <div
                  key={`c-${o}-${d}`}
                  className="border-t border-[var(--color-border)]/60 px-2 py-2 text-center font-mono tabular-nums relative group"
                  style={{ background: `rgba(59, 91, 219, ${opacity})` }}
                  title={
                    cell
                      ? `${o} → ${d}\n${cell.sessions.toLocaleString()} sessions\n${cell.bookings.toLocaleString()} bookings (${cr.toFixed(2)}% CR)\n$${fmtMoney(cell.revenue)} revenue`
                      : `${o} → ${d}\nNo data`
                  }
                >
                  {sess > 0 ? sess.toLocaleString() : '—'}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Side-by-side audience-vs-rest comparison for a loyalty/cardholder audience. */
function LoyaltyPanel({
  label,
  audienceSessions,
  audienceBookings,
  audienceRevenue,
  totalSessions,
  totalBookings,
  totalRevenue,
  color,
  hideRevenue = false,
}: {
  label: string;
  audienceSessions: number;
  audienceBookings: number;
  audienceRevenue: number;
  totalSessions: number;
  totalBookings: number;
  totalRevenue: number;
  color: string;
  hideRevenue?: boolean;
}) {
  const sessShare = totalSessions > 0 ? (audienceSessions / totalSessions) * 100 : 0;
  const bookShare = totalBookings > 0 ? (audienceBookings / totalBookings) * 100 : 0;
  const revShare = totalRevenue > 0 ? (audienceRevenue / totalRevenue) * 100 : 0;
  const audCR = audienceSessions > 0 ? (audienceBookings / audienceSessions) * 100 : 0;
  const restSess = totalSessions - audienceSessions;
  const restBook = totalBookings - audienceBookings;
  const restCR = restSess > 0 ? (restBook / restSess) * 100 : 0;

  return (
    <div className="border border-[var(--color-border)]/60 rounded-lg p-4">
      <div className="text-sm font-semibold mb-2">{label}</div>
      <div className="space-y-2">
        <MiniBar label="Share of sessions" value={sessShare} color={color} />
        <MiniBar label="Share of bookings" value={bookShare} color={color} />
        {!hideRevenue && (
          <MiniBar label="Share of revenue" value={revShare} color={color} />
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)]/60 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
            Audience CR
          </div>
          <div className="font-mono tabular-nums text-lg font-semibold mt-0.5">
            {audCR.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
            Rest CR
          </div>
          <div className="font-mono tabular-nums text-lg font-semibold mt-0.5 text-[var(--color-text-muted)]">
            {restCR.toFixed(2)}%
          </div>
        </div>
      </div>
      {audCR > 0 && restCR > 0 && (
        <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          {audCR >= restCR
            ? `${label} convert ${(audCR / restCR).toFixed(2)}× the rest`
            : `${label} convert ${((restCR - audCR) / restCR * 100).toFixed(0)}% less than the rest`}
        </div>
      )}
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className="font-mono tabular-nums">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--color-surface-2)] rounded mt-0.5 overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
    </div>
  );
}
