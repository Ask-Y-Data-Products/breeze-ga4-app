import { ReactNode } from 'react';

export function Loading({ height = 200 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center text-[var(--color-text-dim)] text-sm" style={{ height }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" />
        Loading…
      </div>
    </div>
  );
}

export function ErrorPanel({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="border border-red-300 bg-red-50 rounded-lg p-4 text-sm text-red-700">
      <div className="font-semibold mb-1">Query failed</div>
      <code className="text-xs text-red-600/90 break-all">{msg}</code>
    </div>
  );
}

export function Empty({ children = 'No data.' }: { children?: ReactNode }) {
  return (
    <div className="text-center text-[var(--color-text-muted)] text-sm py-8">{children}</div>
  );
}
