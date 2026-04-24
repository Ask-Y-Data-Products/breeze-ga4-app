// Data quality anomaly catalog. Modeled after the Breeze plugin's
// context/data-quality/anomalies-*.yaml — surfaces known issues to consumers.

export type AnomalyKind = 'data-quality' | 'industry-event';

export interface Anomaly {
  id: string;
  startDate: string;
  endDate: string;
  severity: 'info' | 'warning' | 'critical';
  /** Data-quality issue (NULL spike, tracking bug) vs. external industry event (plane crash, weather). */
  kind?: AnomalyKind;
  affectedTables: string[];
  affectedColumns?: string[];
  title: string;
  detail: string;
  workaround?: string;
}

export const ANOMALIES: Anomaly[] = [
  // Industry-event annotations — the sample of "plane crash / weather event"
  // context Merritt mentioned wanting to surface alongside queries.
  {
    id: 'industry-2025-holiday-travel',
    startDate: '2025-12-24',
    endDate: '2026-01-02',
    severity: 'info',
    kind: 'industry-event',
    affectedTables: ['ga4_sessions', 'ga4_events'],
    title: 'Holiday travel peak (industry-wide)',
    detail: 'Week-of-holiday bookings and check-ins run 2–3× a typical week across US carriers. Expect inflated absolute volumes; compare to the same 2-week window YoY for a cleaner read.',
  },
  {
    id: 'industry-2025-winter-storm',
    startDate: '2025-12-22',
    endDate: '2025-12-23',
    severity: 'warning',
    kind: 'industry-event',
    affectedTables: ['ga4_sessions', 'ga4_events'],
    title: 'Winter storm — Northeast cancellations',
    detail: 'Widespread cancellations along BOS / BDL / ALB / PVD routes caused a spike in modify-trip and check-in traffic and a drop in new bookings. This is demand displacement, not an organic shift.',
    workaround: 'Filter out the affected origins/destinations or note the effect when comparing against the prior period.',
  },
  // Data-quality annotations
  {
    id: '2025-12-cardholder-coverage',
    startDate: '2025-12-31',
    endDate: '2026-01-01',
    severity: 'info',
    kind: 'data-quality',
    affectedTables: ['ga4_experiments'],
    affectedColumns: ['cardholder'],
    title: 'cardholder is mostly NULL',
    detail:
      '~97% of sessions have NULL cardholder. The column is only set for users known to hold the co-brand credit card. Treat NULL as "unknown / non-cardholder", not as an opt-out.',
  },
  {
    id: '2025-12-user-id-coverage',
    startDate: '2025-12-31',
    endDate: '2026-01-01',
    severity: 'info',
    kind: 'data-quality',
    affectedTables: ['ga4_experiments'],
    affectedColumns: ['user_id'],
    title: 'user_id missing on ~60% of rows',
    detail:
      'user_id is only populated for logged-in sessions. Use logged_in = "logged_in" or user_pseudo_id for un-authenticated traffic.',
  },
];

/** Anomalies overlapping a date range. */
export function anomaliesInRange(from: string | null, to: string | null): Anomaly[] {
  if (!from && !to) return ANOMALIES;
  return ANOMALIES.filter((a) => {
    if (from && a.endDate < from) return false;
    if (to && a.startDate > to) return false;
    return true;
  });
}
