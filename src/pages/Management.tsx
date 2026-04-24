import { NavLink, Outlet } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

const TABS = [
  { to: '/management', label: 'Plugin Comparison', icon: '☰', end: true },
  { to: '/management/learn', label: 'Learn', icon: '☷', end: false },
  { to: '/management/data-quality', label: 'Data Quality', icon: '⚠', end: false },
  { to: '/management/settings', label: 'Settings', icon: '⚙', end: false },
];

// Layout component: page header + sticky tab strip + <Outlet /> for the active tab.
// The tab strip stays visible on every Management sub-route so users can switch freely.
export default function Management() {
  return (
    <div>
      <PageHeader
        title="Management"
        subtitle="Admin topics and the plugin-vs-app capability comparison."
      />

      <div className="mb-5 border-b border-[var(--color-border)] sticky top-14 z-10 bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="flex items-end gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]'
                }`
              }
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
