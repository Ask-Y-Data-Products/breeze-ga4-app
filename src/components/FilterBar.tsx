import { useState } from 'react';
import { useFilters } from '../state/store';
import AppliedFilters from './AppliedFilters';

const CHANNELS = [
  'Direct', 'Organic Search', 'Paid Search', 'Email', 'Paid Social', 'Referral',
  'Paid Other', 'Airports & Partnerships', 'OTAs', 'Breeze Mobile Apps',
  'Breeze Onboard Referral', 'Organic Shopping', 'Organic Social', '(Other)',
  'Paid Video', 'Display', 'Organic AI',
];
const DEVICES = ['mobile', 'desktop', 'tablet', 'smart tv'];

// Time presets — Merritt's #1 UX ask from the call: "checkboxes for common
// time periods so people don't have to define it themselves or accept defaults".
const TODAY_ISO = new Date().toISOString().slice(0, 10);
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function startOfYear(): string {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

interface Preset {
  id: string;
  label: string;
  from: string | null;
  to: string | null;
}

const PRESETS: Preset[] = [
  { id: 'today', label: 'Today', from: TODAY_ISO, to: TODAY_ISO },
  { id: 'yesterday', label: 'Yesterday', from: daysAgo(1), to: daysAgo(1) },
  { id: '7d', label: 'Last 7 days', from: daysAgo(6), to: TODAY_ISO },
  { id: '30d', label: 'Last 30 days', from: daysAgo(29), to: TODAY_ISO },
  { id: '90d', label: 'Last 90 days', from: daysAgo(89), to: TODAY_ISO },
  { id: 'mtd', label: 'Month to date', from: startOfMonth(), to: TODAY_ISO },
  { id: 'ytd', label: 'Year to date', from: startOfYear(), to: TODAY_ISO },
  { id: 'all', label: 'All time', from: null, to: null },
];

export default function FilterBar({
  showExperiment = false,
  experiments = [],
  countries = [],
  filteredSessions,
  totalSessions,
}: {
  showExperiment?: boolean;
  experiments?: string[];
  countries?: string[];
  /** If provided, renders the AppliedFilters chip stack + "X% of sessions"
   *  indicator INSIDE the sticky filter bar instead of as a separate block. */
  filteredSessions?: number;
  totalSessions?: number;
}) {
  const f = useFilters();

  const activePresetId =
    PRESETS.find((p) => p.from === f.dateFrom && p.to === f.dateTo)?.id ?? 'custom';

  // Any filter that is not at its default value counts as "active".
  // Date range is considered active only when non-null (defaults are null on both).
  const activeCount =
    (f.dateFrom != null ? 1 : 0) +
    (f.dateTo != null ? 1 : 0) +
    (f.channel != null ? 1 : 0) +
    (f.device != null ? 1 : 0) +
    (f.country.length > 0 ? 1 : 0) +
    (f.experiment != null ? 1 : 0) +
    (f.product != null ? 1 : 0) +
    (f.loggedIn !== 'all' ? 1 : 0) +
    (f.excludeInternalTraffic ? 1 : 0);
  const hasActive = activeCount > 0;

  return (
    // Sticky wrapper sits just below the 56px top header (top-14 = 3.5rem).
    // Negative margin lets the translucent backdrop visually merge with the
    // page padding when scrolled.
    <div className="sticky top-14 z-10 -mx-6 px-6 pt-2 pb-0 bg-[var(--color-bg)]/95 backdrop-blur mb-5">
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 space-y-3 shadow-sm">
      {/* Quick range preset first, then custom date pickers, then dimension selectors */}
      <div className="flex items-end flex-wrap gap-2">
        <Field label="Quick range">
          <select
            value={activePresetId}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value);
              if (p) {
                f.setFilter('dateFrom', p.from);
                f.setFilter('dateTo', p.to);
              }
            }}
            className={inp + ' min-w-[130px]'}
          >
            {activePresetId === 'custom' && <option value="custom">Custom…</option>}
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input
            type="date"
            value={f.dateFrom ?? ''}
            onChange={(e) => f.setFilter('dateFrom', e.target.value || null)}
            className={inp}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={f.dateTo ?? ''}
            onChange={(e) => f.setFilter('dateTo', e.target.value || null)}
            className={inp}
          />
        </Field>
        <Field label="Channel">
          <Select value={f.channel ?? ''} onChange={(v) => f.setFilter('channel', v || null)} options={['', ...CHANNELS]} />
        </Field>
        <Field label="Device">
          <Select value={f.device ?? ''} onChange={(v) => f.setFilter('device', v || null)} options={['', ...DEVICES]} />
        </Field>
        <Field label="Country">
          <CountryPicker
            selected={f.country}
            options={countries}
            onToggle={(name) => {
              if (f.country.includes(name)) {
                f.setFilter('country', f.country.filter((c) => c !== name));
              } else {
                f.setFilter('country', [...f.country, name]);
              }
            }}
            onClear={() => f.setFilter('country', [])}
          />
        </Field>
        {showExperiment && (
          <Field label="Experiment">
            <Select value={f.experiment ?? ''} onChange={(v) => f.setFilter('experiment', v || null)} options={['', ...experiments]} />
          </Field>
        )}

        <button
          onClick={() => f.reset()}
          disabled={!hasActive}
          title={hasActive ? `Clear ${activeCount} active filter${activeCount === 1 ? '' : 's'}` : 'No filters applied'}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ml-auto flex items-center gap-1.5 ${
            hasActive
              ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:opacity-90'
              : 'border-[var(--color-border)] text-[var(--color-text-dim)] opacity-60 cursor-not-allowed'
          }`}
        >
          {hasActive && (
            <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {activeCount}
            </span>
          )}
          Reset all
        </button>
      </div>

      {/* Quick-filter chips — tick-box style toggles for common constraints */}
      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[var(--color-border)]/50">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mr-1">
          Quick filters
        </span>
        <ChipToggle
          active={f.loggedIn === 'logged_in'}
          onToggle={() => f.setFilter('loggedIn', f.loggedIn === 'logged_in' ? 'all' : 'logged_in')}
          label="Logged-in only"
        />
        <ChipToggle
          active={f.loggedIn === 'logged_out'}
          onToggle={() => f.setFilter('loggedIn', f.loggedIn === 'logged_out' ? 'all' : 'logged_out')}
          label="Logged-out only"
        />
        <ChipToggle
          active={f.device === 'mobile'}
          onToggle={() => f.setFilter('device', f.device === 'mobile' ? null : 'mobile')}
          label="Mobile only"
        />
        <ChipToggle
          active={f.device === 'desktop'}
          onToggle={() => f.setFilter('device', f.device === 'desktop' ? null : 'desktop')}
          label="Desktop only"
        />
        <ChipToggle
          active={f.channel === 'Direct'}
          onToggle={() => f.setFilter('channel', f.channel === 'Direct' ? null : 'Direct')}
          label="Direct traffic"
        />
        <ChipToggle
          active={f.channel === 'Paid Search'}
          onToggle={() => f.setFilter('channel', f.channel === 'Paid Search' ? null : 'Paid Search')}
          label="Paid Search"
        />
        <ChipToggle
          active={f.excludeInternalTraffic}
          onToggle={() => f.setFilter('excludeInternalTraffic', !f.excludeInternalTraffic)}
          label="Exclude internal traffic"
          tone="amber"
        />
      </div>

      {/* Applied-filters summary inside the sticky wrapper so it travels
          with the filter bar instead of leaving a gap below it. */}
      <AppliedFilters filteredSessions={filteredSessions} totalSessions={totalSessions} />
    </div>
    </div>
  );
}

const inp =
  'bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-dim)]">{label}</span>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inp + ' min-w-[120px]'}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o === '' ? 'all' : o}
        </option>
      ))}
    </select>
  );
}

function ChipToggle({
  active,
  onToggle,
  label,
  tone = 'primary',
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  tone?: 'primary' | 'amber';
}) {
  const activeCls =
    tone === 'amber'
      ? 'bg-amber-100 border-amber-400 text-amber-900'
      : 'bg-[var(--color-primary-soft)] border-[var(--color-primary)] text-[var(--color-primary)]';
  const checkCls =
    tone === 'amber'
      ? 'bg-amber-600 border-amber-600'
      : 'bg-[var(--color-primary)] border-[var(--color-primary)]';
  return (
    <button
      onClick={onToggle}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
        active
          ? activeCls
          : 'bg-[var(--color-surface)] border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
      }`}
    >
      <span className={`w-3 h-3 rounded-[3px] border flex items-center justify-center ${active ? checkCls : 'border-[var(--color-border-strong)] bg-[var(--color-bg)]'}`}>
        {active && <span className="text-white text-[9px] leading-none font-bold">✓</span>}
      </span>
      {label}
    </button>
  );
}

/** Multi-select country picker with typeahead. */
function CountryPicker({
  selected,
  options,
  onToggle,
  onClear,
}: {
  selected: string[];
  options: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const hasSelection = selected.length > 0;
  const label =
    selected.length === 0
      ? 'All countries'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} countries`;
  const filtered = (options.length === 0 ? DEFAULT_COUNTRIES : options).filter((c) =>
    c.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${inp} min-w-[160px] flex items-center gap-2 text-left ${
          hasSelection ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : ''
        }`}
      >
        <span className="flex-1 truncate">{label}</span>
        <span className="text-[var(--color-text-dim)] text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-[260px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg flex flex-col max-h-[340px]">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country…"
              className="px-3 py-2 text-sm border-b border-[var(--color-border)] focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              <span>{selected.length} selected</span>
              {hasSelection && (
                <button
                  onClick={() => {
                    onClear();
                    setQuery('');
                  }}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.slice(0, 200).map((c) => {
                const isSelected = selected.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => onToggle(c)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-surface-2)]"
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                          : 'border-[var(--color-border-strong)]'
                      }`}
                    >
                      {isSelected && <span className="text-white text-[9px] leading-none font-bold">✓</span>}
                    </span>
                    {c}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-xs text-[var(--color-text-muted)] text-center">No matches</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const DEFAULT_COUNTRIES = [
  'United States', 'Canada', 'Mexico', 'United Kingdom', 'Germany', 'France', 'Spain',
  'Italy', 'Netherlands', 'Ireland', 'Brazil', 'Argentina', 'Australia', 'Japan',
  'India', 'China', 'Israel', 'Puerto Rico', 'Bahamas', 'Costa Rica',
];
