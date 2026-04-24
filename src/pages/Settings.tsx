import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { detectMode, getToken, setToken, runQuery, apiBase } from '../api/asky';
import { EXPERIMENTS_TABLE } from '../data/tables';
import PageHeader from '../components/PageHeader';
import { Card } from '../components/Card';

export default function Settings() {
  const mode = detectMode();
  const [token, setLocalToken] = useState(getToken());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const test = useMutation({
    mutationFn: async () => {
      const r = await runQuery({
        modelId: EXPERIMENTS_TABLE,
        query: `SELECT 1 AS ok, COUNT(*)::BIGINT AS rows FROM ${EXPERIMENTS_TABLE} LIMIT 1`,
      });
      return r.rows[0];
    },
  });

  function save() {
    setToken(token);
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Connection mode, API token, and a one-click connection test."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Connection" subtitle="auto-detected from hostname">
          <div className="space-y-3 text-sm">
            <Field label="Mode">
              <span
                className={`inline-flex items-center gap-2 px-2 py-1 rounded font-mono text-xs ${
                  mode === 'deployed'
                    ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {mode}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] ml-2">
                {mode === 'deployed'
                  ? 'Cookie auth — no token needed.'
                  : 'Local development — paste a token below.'}
              </span>
            </Field>
            <Field label="API base">
              <code className="text-xs text-[var(--color-text-muted)] break-all">{apiBase()}</code>
            </Field>
            <Field label="Workspace">
              <code className="text-xs text-[var(--color-text-muted)]">ws_3acb27d1055047e3a42f296396937fa6</code>
            </Field>
            <Field label="Project">
              <code className="text-xs text-[var(--color-text-muted)]">d870e7aaa1eb45e5a856809322cde9f2</code>
            </Field>
          </div>
        </Card>

        <Card title="API token" subtitle="only required in stage / local mode">
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Paste your X-App-Token…"
              value={token}
              onChange={(e) => setLocalToken(e.target.value)}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm font-mono"
              disabled={mode === 'deployed'}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={mode === 'deployed'}
                className="px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-40"
              >
                Save token
              </button>
              <button
                onClick={() => test.mutate()}
                disabled={test.isPending}
                className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-border-strong)] disabled:opacity-40"
              >
                {test.isPending ? 'Testing…' : 'Test connection'}
              </button>
              {savedAt && <span className="text-xs text-[var(--color-success)]">Saved at {savedAt}</span>}
            </div>
            {test.isSuccess && (
              <div className="text-sm text-[var(--color-success)] font-mono">
                ✓ ok — {Number((test.data as any).rows).toLocaleString()} rows in table
              </div>
            )}
            {test.isError && (
              <div className="text-sm text-[var(--color-danger)] font-mono break-all">
                ✗ {(test.error as Error).message}
              </div>
            )}
            <div className="text-[11px] text-[var(--color-text-dim)]">
              Token is stored only in your browser&apos;s localStorage and sent as <code>X-App-Token</code> on every API call.
              In deployed mode, the cookie set by Asky is used instead — no token needed.
            </div>
          </div>
        </Card>

        <Card title="About" subtitle="how this app maps to the Breeze GA4 plugin" className="lg:col-span-2">
          <div className="text-sm text-[var(--color-text-muted)] space-y-2">
            <p>
              This is a web replacement for the Breeze GA4 Claude Code plugin. The plugin&apos;s six skills map to pages here:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><b className="text-[var(--color-text)]">ga4-query</b> → <b>Explore</b> &amp; the per-page query panels</li>
              <li><b className="text-[var(--color-text)]">ga4-learn</b> → <b>Learn</b></li>
              <li><b className="text-[var(--color-text)]">ga4-stats</b> → <b>Experiments</b> (variation breakdown, sample-size split, channel/device mix)</li>
              <li><b className="text-[var(--color-text)]">ga4-setup</b> → <b>Settings</b> (no terminal needed)</li>
              <li><b className="text-[var(--color-text)]">ga4-feedback</b> → posted as a sticky link to your team channel (TODO)</li>
              <li><b className="text-[var(--color-text)]">ga4-analysis-plan</b> → covered by <b>Explore</b> + <b>Experiments</b> templates</li>
            </ul>
            <p className="mt-3">
              Gaps from the call this app addresses: GUI-driven filters, deterministic queries, visible sanity panels,
              and an inline anomaly catalog every consumer sees.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-dim)] w-20">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
