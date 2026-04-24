import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { detectMode } from '../api/asky';
import ChatWidget from './ChatWidget';
import { exportPageAsHtml } from '../lib/export';

// Workspace nav: the pages stakeholders use day-to-day.
// Admin topics (Learn, Data Quality, Settings) live under Management to keep this list short.
const NAV = [
  { to: '/', label: 'Executive', icon: '◆' },
  { to: '/experiments', label: 'Experiments', icon: '⚗︎' },
  { to: '/paid-media', label: 'Paid Media', icon: '◉' },
  { to: '/funnel', label: 'Funnel', icon: '▽' },
  { to: '/explore', label: 'Explore', icon: '⌕' },
  { to: '/management', label: 'Management', icon: '☰' },
];

// Pathname → user-facing report title, used when the user exports a page.
const PAGE_TITLES: Record<string, string> = {
  '/': 'Executive Summary',
  '/experiments': 'Experiments',
  '/paid-media': 'Paid Media',
  '/funnel': 'Funnel Analysis',
  '/explore': 'Explore',
  '/management': 'Plugin Comparison',
  '/management/learn': 'Learn — Schema & Tables',
  '/management/data-quality': 'Data Quality',
  '/management/settings': 'Settings',
};

export default function Layout() {
  const mode = detectMode();
  const location = useLocation();
  const [exporting, setExporting] = useState(false);
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Report';

  async function handleExport() {
    try {
      setExporting(true);
      await exportPageAsHtml(pageTitle);
    } catch (e) {
      console.error('Export failed', e);
      alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)] text-[var(--color-text)]">
      <aside data-no-export className="fixed left-0 top-0 h-screen w-[240px] bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col">
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm">G4</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Breeze GA4</div>
            <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">Analytics</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <div className="px-3 mb-2 text-[10px] font-semibold text-[var(--color-text-dim)] uppercase tracking-wider">Workspace</div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                }`
              }
            >
              <span className="w-4 text-center text-[15px] leading-none">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3 text-[11px] text-[var(--color-text-dim)]">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${mode === 'deployed' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-accent)]'}`} />
            <span className="uppercase tracking-wider font-semibold">{mode}</span>
            <span>mode</span>
          </div>
          <div className="mt-1 text-[var(--color-text-dim)]">v0.1.0 · replaces ga4 plugin</div>
        </div>
      </aside>

      <div className="flex-1 ml-[240px] min-w-0 flex flex-col">
        <header data-no-export className="h-14 sticky top-0 z-20 bg-[var(--color-surface)]/80 backdrop-blur border-b border-[var(--color-border)] px-6 flex items-center gap-3">
          <div className="flex-1" />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-50 flex items-center gap-1.5"
            title="Download current page as a standalone, branded HTML report"
          >
            <span aria-hidden>↓</span>
            {exporting ? 'Exporting…' : 'Export HTML'}
          </button>
          <div className="text-xs text-[var(--color-text-dim)] font-mono">
            workspace · <span className="text-[var(--color-primary)]">d870e7aa…</span>
          </div>
        </header>
        <main className="flex-1 px-6 py-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <div data-no-export>
        <ChatWidget />
      </div>
    </div>
  );
}
