import { create } from 'zustand';

interface FilterState {
  /** ISO date string YYYY-MM-DD or null. The actual data is 2025-12-31 / 2026-01-01. */
  dateFrom: string | null;
  dateTo: string | null;
  channel: string | null;
  device: string | null;
  /** Multi-select — empty array means no country filter. */
  country: string[];
  experiment: string | null;
  loggedIn: 'all' | 'logged_in' | 'logged_out';
  /** Product drill-down from the "Booking revenue by product" chart.
   *  Values like "Bundles", "Bags" map to a `{col}_revenue_booking > 0` predicate. */
  product: string | null;
  /** Default true — hides Breeze-owned internal surfaces like "Breeze Mobile Apps"
   *  and "Breeze Onboard Referral" from channel breakdowns. Toggleable. */
  excludeInternalTraffic: boolean;
  setFilter: <K extends keyof Omit<FilterState, 'setFilter' | 'reset'>>(k: K, v: FilterState[K]) => void;
  reset: () => void;
}

// First-page-load defaults. Note: excludeInternalTraffic is ON here so
// stakeholders don't see Breeze-owned surfaces mixed into "channel" on
// their first view. `reset()` below uses a different, *truly empty* state.
const initial = {
  dateFrom: null as string | null,
  dateTo: null as string | null,
  channel: null as string | null,
  device: null as string | null,
  country: [] as string[],
  experiment: null as string | null,
  loggedIn: 'all' as const,
  product: null as string | null,
  excludeInternalTraffic: true,
};

/** "Reset all" clears EVERY filter, including the initial default for
 *  internal-traffic exclusion. That way the Reset button and the Applied
 *  chip stack always agree: any chip visible ↔ Reset button highlighted. */
const resetState = {
  ...initial,
  excludeInternalTraffic: false,
};

/** Channels that represent Breeze-owned surfaces (not external marketing). */
export const INTERNAL_CHANNELS = ['Breeze Mobile Apps', 'Breeze Onboard Referral'];

/** Product display name → session column with non-zero revenue for that product. */
export const PRODUCT_TO_COLUMN: Record<string, string> = {
  'Base fare': 'base_revenue_booking',
  Bundles: 'bundle_revenue_booking',
  Bags: 'bag_revenue_booking',
  Seats: 'seat_revenue_booking',
  Insurance: 'insurance_revenue_booking',
  'Car rental': 'car_revenue_booking',
};

export const useFilters = create<FilterState>((set) => ({
  ...initial,
  setFilter: (k, v) => set({ [k]: v } as Partial<FilterState>),
  reset: () => set(resetState),
}));

/** Build a SQL WHERE fragment from current filter state. Always safe (parameterized via constants). */
export function buildWhere(s: Partial<FilterState>, opts?: { table?: string }): string {
  const t = opts?.table ? `${opts.table}.` : '';
  const parts: string[] = [];
  if (s.dateFrom) parts.push(`${t}event_date >= DATE '${escDate(s.dateFrom)}'`);
  if (s.dateTo) parts.push(`${t}event_date <= DATE '${escDate(s.dateTo)}'`);
  if (s.channel) parts.push(`${t}channel_session = ${q(s.channel)}`);
  if (s.device) parts.push(`${t}device_category = ${q(s.device)}`);
  if (s.country && s.country.length > 0) {
    const list = s.country.map((c) => q(c)).join(', ');
    parts.push(`${t}country IN (${list})`);
  }
  if (s.experiment) parts.push(`${t}experiment_name = ${q(s.experiment)}`);
  if (s.loggedIn === 'logged_in') parts.push(`${t}logged_in = 'logged_in'`);
  if (s.loggedIn === 'logged_out') parts.push(`${t}logged_in = 'logged_out'`);
  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

function q(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}
function escDate(v: string): string {
  // Allow only YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '1970-01-01';
}
