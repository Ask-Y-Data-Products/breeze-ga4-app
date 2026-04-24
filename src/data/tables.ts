// Catalog of GA4 tables. Only EXPERIMENTS is currently materialized in Asky;
// the others are listed for parity with the Breeze GA4 plugin schema.

export type TableStatus = 'available' | 'planned';

export interface TableDef {
  key: string;
  /** Friendly name shown in UI. */
  displayName: string;
  /** modelId / table name to use in SQL. */
  modelId: string;
  status: TableStatus;
  grain: string;
  partition: string;
  rowEstimate: string;
  useFor: string[];
  notes?: string[];
}

// Real, queryable tables in Asky.
export const EXPERIMENTS_TABLE =
  'prismview_ptbl_d870e7aaa1eb45e5a856809322cde9f2_ga4_experiments_data_467183_1';

export const AD_SPEND_TABLE =
  'prismview_ptbl_d870e7aaa1eb45e5a856809322cde9f2_adspend_metrics_sheet1_678cfd_1';

export const SESSIONS_TABLE =
  'prismview_ptbl_d870e7aaa1eb45e5a856809322cde9f2_ga4_sessions_bluster_a7e307_1';

export const EVENTS_TABLE =
  'prismview_ptbl_d870e7aaa1eb45e5a856809322cde9f2_ga4_events_breeze_de288a_1';

export const TABLES: TableDef[] = [
  {
    key: 'ga4_experiments',
    displayName: 'GA4 Experiments',
    modelId: EXPERIMENTS_TABLE,
    status: 'available',
    grain: 'One row per experiment impression',
    partition: 'event_date_utc',
    rowEstimate: '~3M / month (currently 200k loaded)',
    useFor: [
      'A/B test analysis',
      'Experiment user segmentation',
      'Variation assignment verification',
    ],
    notes: [
      'Stability: is_final = TRUE after ~3 days. Optional filter — metrics are stable across final/non-final data.',
    ],
  },
  {
    key: 'ga4_sessions',
    displayName: 'GA4 Sessions',
    modelId: SESSIONS_TABLE,
    status: 'available',
    grain: 'One row per session (200k loaded for 2026-01-01)',
    partition: 'session_date',
    rowEstimate: '~2M / month (currently 200k loaded)',
    useFor: [
      'Conversion analysis (bookings, sign_ups, check_in)',
      'Channel / attribution performance (channel_first_click / last_click / session)',
      'Revenue breakdowns (booking_revenue, modify_trip_revenue, checkin_revenue, product-level *_booking)',
      'ROAS when joined to ad_spend on LOWER(campaign)',
    ],
    notes: [
      'Has both first-click and last-click attribution columns — pick one and stick with it for comparability.',
      'Revenue columns are Numeric but mostly NULL for sessions without purchases.',
    ],
  },
  {
    key: 'ga4_events',
    displayName: 'GA4 Events',
    modelId: EVENTS_TABLE,
    status: 'available',
    grain: 'One row per event (200k loaded for 2026-01-01)',
    partition: 'event_date',
    rowEstimate: '~50M / month (currently 200k loaded)',
    useFor: [
      'Funnel analysis by event_name or page path',
      'Page flow (prev / next page paths)',
      'Detailed ecommerce breakdowns (items, value_* columns)',
      'Search for specific clicked_element or event_detail',
    ],
    notes: [
      'ALWAYS filter by event_date AND event_name when possible (large table).',
      '12 distinct event_name values observed: wifi_check, add_to_cart, user_engagement, track_click, page_view, hovr, login, glad_app, flight_search_submitted, flight_search_ui, view_item, wifi_ad_portal.',
    ],
  },
  {
    key: 'ad_spend',
    displayName: 'Ad Spend (WindsorAI)',
    modelId: AD_SPEND_TABLE,
    status: 'available',
    grain: 'One row per (date, source, account, campaign)',
    partition: 'date',
    rowEstimate: 'Currently 291 rows loaded (2026-01-01)',
    useFor: [
      'Spend / clicks / impressions by source & campaign',
      'CTR and CPC by campaign',
      'CPM by source',
      'Combined with GA4 sessions (join required): ROAS, cost per booking',
    ],
    notes: [
      'Coverage: google_ads, facebook, bing ONLY (3 source values seen). No TikTok / DV360 / Audio etc.',
      'To compute ROAS you need a JOIN to ga4_sessions on LOWER(campaign) — not yet loaded.',
      'campaign names are mixed-case here but lowercase in GA4 — always LOWER() both sides.',
    ],
  },
];

export function tableByKey(k: string): TableDef | undefined {
  return TABLES.find((t) => t.key === k);
}
