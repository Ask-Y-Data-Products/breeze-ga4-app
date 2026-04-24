// Asky API client — auto-detects Stage (with token) vs Deployed (cookie auth) mode.

export const WORKSPACE_ID = 'ws_3acb27d1055047e3a42f296396937fa6';
export const PROJECT_ID = 'd870e7aaa1eb45e5a856809322cde9f2';

const STAGE_BASE = 'https://askycore-stage-ethnd4drf6fsgscb.centralus-01.azurewebsites.net/api';
const TOKEN_KEY = 'ga4app:askyToken';

export type AuthMode = 'deployed' | 'stage';

/** Decide which mode we're in based on hostname. */
export function detectMode(): AuthMode {
  if (typeof window === 'undefined') return 'stage';
  const host = window.location.hostname;
  // Anything served from Asky's CDN is "deployed" (cookie auth, relative URL).
  // Matches askycore-* (stage API host) and ask-y.ai / appstage.ask-y.ai (prod app host).
  if (host.includes('askycore') || host.includes('asky') || host.includes('ask-y')) {
    return 'deployed';
  }
  return 'stage';
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(t: string): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function apiBase(): string {
  if (detectMode() !== 'deployed') return STAGE_BASE;
  // Use absolute path relative to Vite's base so nested routes like
  // /blusterplugin/management/learn don't cause "./api" to resolve to the
  // current route directory.
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${base}/api`;
}

export interface ColSchema {
  name: string;
  type: string;
}

export interface QueryResult {
  cols: ColSchema[];
  rows: Record<string, unknown>[];
  raw: unknown[][];
}

export interface QueryOptions {
  modelId: string;
  query: string;
  /** Optional page window size. Paired with offset, the server wraps your SQL as SELECT * FROM (query) LIMIT pageSize OFFSET offset. */
  pageSize?: number;
  offset?: number;
  /** Request timeout in ms. Default 30000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Run a DuckDB SQL query against the Asky data backend. */
export async function runQuery({ modelId, query, pageSize, offset, timeoutMs = DEFAULT_TIMEOUT_MS }: QueryOptions): Promise<QueryResult> {
  const url = `${apiBase()}/Data/getModelView`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (detectMode() === 'stage') {
    const tok = getToken();
    if (!tok) throw new Error('No Asky token configured. Open Settings to add one.');
    headers['X-App-Token'] = tok;
  }

  const body: Record<string, unknown> = {
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    modelId,
    query,
  };
  if (pageSize != null && offset != null) {
    body.pageSize = pageSize;
    body.offset = offset;
  }

  // AbortController guarantees a clear failure if the backend hangs.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. The Asky backend may be slow or unavailable.`);
    }
    throw e;
  }
  clearTimeout(timeout);

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: response was not JSON`);
  }

  if (!res.ok || !json.Success) {
    throw new Error(json.ErrorMessage || json.errorMessage || `HTTP ${res.status}`);
  }

  const cols: ColSchema[] = json.Data.colSchema ?? [];
  const raw: unknown[][] = json.Data.data ?? [];
  const rows = raw.map((r) => Object.fromEntries(cols.map((c, i) => [c.name, r[i]])));
  return { cols, rows, raw };
}

/** Convenience helper for simple count/value queries. */
export async function scalar<T = number>(modelId: string, query: string, col?: string): Promise<T | null> {
  const { rows, cols } = await runQuery({ modelId, query });
  if (rows.length === 0) return null;
  const c = col ?? cols[0]?.name;
  if (!c) return null;
  return rows[0][c] as T;
}

// ─────────────────────────────────────────────────────────────────────────
// Chat API — agent-backed investigation endpoints (long-poll pattern).
// Matches the Alpine template's contract: /chat/{start,respond,poll,cancel,history}.
// ─────────────────────────────────────────────────────────────────────────

function buildJsonHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (detectMode() === 'stage') {
    const tok = getToken();
    if (!tok) throw new Error('No Asky token configured. Open Settings to add one.');
    h['X-App-Token'] = tok;
  }
  return h;
}

async function chatPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: buildJsonHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

export type ChatStatus = 'idle' | 'running' | 'awaiting_input' | 'completed' | 'failed' | 'cancelled';

export interface ChatStartResponse {
  ok: boolean;
  investigationId?: string;
  error?: string;
}

export interface ChatRespondResponse {
  ok: boolean;
  error?: string;
}

export type ChatItemKind = 'message' | 'processing_message' | 'page';

export interface ChatPollItem {
  kind: ChatItemKind;
  text: string;
  synthetic?: boolean;
}

export interface ChatPollResponse {
  ok: boolean;
  cursor: number;
  status: ChatStatus;
  items?: ChatPollItem[];
  terminal?: boolean;
  error?: string;
}

export interface ChatHistoryResponse {
  ok: boolean;
  investigationId?: string | null;
  cursor?: number;
  status?: ChatStatus;
  messages?: Array<{ role: 'user' | 'agent'; text: string }>;
  error?: string;
}

/** Start a new investigation with a user prompt. */
export function chatStart(prompt: string): Promise<ChatStartResponse> {
  return chatPost<ChatStartResponse>('/chat/start', {
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    prompt,
  });
}

/** Send a follow-up when the agent is in the `awaiting_input` state. */
export function chatRespond(investigationId: string, message: string): Promise<ChatRespondResponse> {
  return chatPost<ChatRespondResponse>('/chat/respond', {
    investigationId,
    workspaceId: WORKSPACE_ID,
    message,
  });
}

/** Long-poll for incremental items since `cursor`. Signal lets the caller abort. */
export function chatPoll(
  investigationId: string,
  cursor: number,
  signal: AbortSignal,
  waitMs = 10_000,
): Promise<ChatPollResponse> {
  return chatPost<ChatPollResponse>(
    '/chat/poll',
    { investigationId, workspaceId: WORKSPACE_ID, cursor, waitMs },
    signal,
  );
}

/** Cancel an in-flight investigation (ignores errors — cancellation is best-effort). */
export async function chatCancel(investigationId: string): Promise<void> {
  try {
    await chatPost('/chat/cancel', { investigationId, workspaceId: WORKSPACE_ID });
  } catch {
    /* non-fatal */
  }
}

/** Restore the most recent investigation for this project (used on app mount). */
export async function chatHistory(): Promise<ChatHistoryResponse | null> {
  try {
    const url = `${apiBase()}/chat/history?workspaceId=${encodeURIComponent(
      WORKSPACE_ID,
    )}&projectId=${encodeURIComponent(PROJECT_ID)}`;
    const headers: Record<string, string> = {};
    if (detectMode() === 'stage') {
      const tok = getToken();
      if (!tok) return null;
      headers['X-App-Token'] = tok;
    }
    const res = await fetch(url, { credentials: 'include', headers });
    if (!res.ok) return null;
    return (await res.json()) as ChatHistoryResponse;
  } catch {
    return null;
  }
}
