import { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl ${className}`}
    >
      {(title || subtitle || right) && (
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-start justify-between gap-3">
          <div>
            {title && <div className="text-sm font-semibold">{title}</div>}
            {subtitle && (
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</div>
            )}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function KPICard({
  label,
  value,
  hint,
  trend,
  sparkline,
  primary = false,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { dir: 'up' | 'down' | 'flat'; text: string };
  /** Optional inline sparkline component to render alongside the number. */
  sparkline?: ReactNode;
  /** Highlighted as the primary metric of the dashboard (larger font, accent border). */
  primary?: boolean;
  /** Small glyph/icon left of the label for scanability. */
  icon?: string;
}) {
  const dirColor = {
    up: 'text-[var(--color-success)]',
    down: 'text-[var(--color-danger)]',
    flat: 'text-[var(--color-text-muted)]',
  }[trend?.dir ?? 'flat'];
  const dirGlyph = { up: '▲', down: '▼', flat: '·' }[trend?.dir ?? 'flat'];

  const frame = primary
    ? 'bg-gradient-to-br from-[var(--color-primary-soft)] to-[var(--color-surface)] border-[var(--color-primary)]/30'
    : 'bg-[var(--color-surface)] border-[var(--color-border)]';
  const valueSize = primary ? 'text-3xl' : 'text-2xl';

  return (
    <div className={`border rounded-xl px-5 py-4 flex flex-col justify-between min-h-[112px] ${frame}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-[13px] leading-none text-[var(--color-text-muted)]" aria-hidden>{icon}</span>}
        <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
          {label}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div className={`${valueSize} font-semibold tracking-tight leading-none`}>{value}</div>
        {sparkline && <div className="opacity-90 -mr-1">{sparkline}</div>}
      </div>
      {(hint || trend) && (
        <div className="text-[11px] text-[var(--color-text-muted)] mt-2 flex items-center gap-2 flex-wrap">
          {trend && (
            <span className={`${dirColor} font-semibold inline-flex items-center gap-1`}>
              <span aria-hidden>{dirGlyph}</span>
              {trend.text}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
