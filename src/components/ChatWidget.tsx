// Multi-turn investigation chat — ported from the Asky Alpine template.
//
// Contract:
// - POST /api/chat/start        → { investigationId }
// - POST /api/chat/respond      (only valid while status === 'awaiting_input')
// - POST /api/chat/poll         → long-poll for items (waitMs ≈ 10s), cursor-based
// - POST /api/chat/cancel
// - GET  /api/chat/history      → restore most recent investigation on mount
//
// Status machine: idle → running → (awaiting_input | completed | failed | cancelled)
// Item kinds: message (final HTML response), processing_message / page (ephemeral progress).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatCancel,
  chatHistory,
  chatPoll,
  chatRespond,
  chatStart,
  type ChatStatus,
} from '../api/asky';

type Role = 'user' | 'agent' | 'processing' | 'error';

interface Message {
  id: number;
  role: Role;
  text: string;
  /** Server-provided HTML for agent messages (rendered via dangerouslySetInnerHTML). */
  html?: string | null;
  /** True for ephemeral processing pages the server keeps overwriting. */
  synthetic?: boolean;
}

function isTerminal(s: ChatStatus): boolean {
  return s === 'completed' || s === 'cancelled' || s === 'failed';
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [investigationId, setInvestigationId] = useState<string | null>(null);

  // Mutable refs for long-polling state.
  const cursorRef = useRef<number>(0);
  const idCounterRef = useRef<number>(0);
  const pollAbortRef = useRef<AbortController | null>(null);
  const investigationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  // DOM refs.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep refs in sync with state so the long-poll loop (a stable closure)
  // can see the latest values.
  useEffect(() => {
    investigationIdRef.current = investigationId;
  }, [investigationId]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Helpers ──────────────────────────────────────────────────────────

  const pushMessage = useCallback((role: Role, text: string, html?: string | null, synthetic = false) => {
    idCounterRef.current += 1;
    const msg: Message = {
      id: idCounterRef.current,
      role,
      text: text ?? '',
      html: html ?? (role === 'agent' ? text ?? '' : null),
      synthetic,
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const dropTrailingProgress = useCallback(() => {
    setMessages((prev) => {
      let end = prev.length;
      while (end > 0 && prev[end - 1].role === 'processing' && prev[end - 1].synthetic) {
        end -= 1;
      }
      return end === prev.length ? prev : prev.slice(0, end);
    });
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Auto-grow textarea (cap at 40% of viewport height).
  const autoGrow = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cap = Math.floor((window.innerHeight || 680) * 0.4);
    el.style.height = Math.min(el.scrollHeight, cap) + 'px';
  }, []);
  useEffect(() => {
    autoGrow();
  }, [input, autoGrow]);

  // Scroll after each message push / while busy.
  useEffect(() => {
    scrollToEnd();
  }, [messages, busy, scrollToEnd]);

  // ── Long-poll loop ───────────────────────────────────────────────────

  const pollLoop = useCallback(
    async (invId: string) => {
      if (pollAbortRef.current) pollAbortRef.current.abort();
      const abort = new AbortController();
      pollAbortRef.current = abort;

      try {
        // Keep polling as long as this investigation is current and not aborted.
        // eslint-disable-next-line no-constant-condition
        while (!abort.signal.aborted && investigationIdRef.current === invId) {
          const json = await chatPoll(invId, cursorRef.current, abort.signal);
          if (abort.signal.aborted) return;
          if (!json.ok) throw new Error(json.error || 'Poll failed');

          cursorRef.current = json.cursor ?? cursorRef.current;
          setStatus(json.status);

          for (const item of json.items ?? []) {
            if (item.kind === 'message') {
              dropTrailingProgress();
              // Final messages may contain HTML (charts, tables). Backend is trusted.
              pushMessage('agent', item.text, item.text);
            } else if (item.kind === 'processing_message' || item.kind === 'page') {
              // Consecutive synthetic processing updates get their text overwritten
              // rather than stacking — matches the Alpine template's UX.
              if (item.synthetic) {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'processing' && last.synthetic) {
                    const next = prev.slice(0, -1);
                    next.push({ ...last, text: item.text });
                    return next;
                  }
                  idCounterRef.current += 1;
                  return [
                    ...prev,
                    { id: idCounterRef.current, role: 'processing', text: item.text, synthetic: true },
                  ];
                });
              } else {
                const last = messagesRef.current[messagesRef.current.length - 1];
                if (!(last && last.role === 'processing' && last.text === item.text)) {
                  pushMessage('processing', item.text, null, false);
                }
              }
            }
          }

          if (json.terminal || json.status === 'awaiting_input') {
            dropTrailingProgress();
            setBusy(false);
            return;
          }
        }
      } catch (e) {
        if (abort.signal.aborted) return;
        setBusy(false);
        setStatus('failed');
        pushMessage('error', e instanceof Error ? e.message : String(e));
      }
    },
    [dropTrailingProgress, pushMessage],
  );

  // ── Mount: restore any previous conversation ─────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hist = await chatHistory();
      if (cancelled) return;
      if (!hist || !hist.ok || !hist.investigationId) return;
      // Only hydrate when locally empty — never wipe messages the user already sent.
      if (messagesRef.current.length > 0) return;

      setInvestigationId(hist.investigationId);
      cursorRef.current = hist.cursor ?? 0;
      const st = (hist.status as ChatStatus) || 'idle';
      setStatus(st);
      idCounterRef.current = 0;
      for (const m of hist.messages ?? []) {
        idCounterRef.current += 1;
        messagesRef.current.push({
          id: idCounterRef.current,
          role: m.role === 'user' ? 'user' : 'agent',
          text: m.text,
          html: m.role === 'agent' ? m.text : null,
        });
      }
      // Flush into state once
      setMessages([...messagesRef.current]);

      if (st === 'running') {
        setBusy(true);
        pollLoop(hist.investigationId);
      }
    })();
    return () => {
      cancelled = true;
      pollAbortRef.current?.abort();
    };
  }, [pollLoop]);

  // ── Actions ──────────────────────────────────────────────────────────

  const resetChat = useCallback(() => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    setInvestigationId(null);
    cursorRef.current = 0;
    setStatus('idle');
    setBusy(false);
    setMessages([]);
    idCounterRef.current = 0;
    setInput('');
  }, []);

  const newChat = useCallback(async () => {
    if (investigationId && !isTerminal(status)) {
      await chatCancel(investigationId);
    }
    resetChat();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [investigationId, status, resetChat]);

  const canRespond = status === 'awaiting_input';

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    const isContinuation = investigationId != null && canRespond;
    if (!isContinuation && busy) return;

    pushMessage('user', text);
    setInput('');

    try {
      if (isContinuation) {
        setBusy(true);
        setStatus('running');
        const r = await chatRespond(investigationId!, text);
        if (!r.ok) throw new Error(r.error || 'Failed to respond');
        await pollLoop(investigationId!);
      } else {
        // Previous investigation is fully done — start a fresh one.
        if (investigationId) {
          setInvestigationId(null);
          cursorRef.current = 0;
        }
        setBusy(true);
        setStatus('running');
        const r = await chatStart(text);
        if (!r.ok || !r.investigationId) throw new Error(r.error || 'Failed to start chat');
        setInvestigationId(r.investigationId);
        investigationIdRef.current = r.investigationId;
        cursorRef.current = 0;
        await pollLoop(r.investigationId);
      }
    } catch (e) {
      setBusy(false);
      setStatus('failed');
      pushMessage('error', e instanceof Error ? e.message : String(e));
    }
  }, [input, investigationId, canRespond, busy, pollLoop, pushMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  const statusLabel = (() => {
    if (busy && status === 'running') return 'Thinking…';
    if (status === 'awaiting_input') return 'Awaiting your reply';
    if (status === 'completed') return 'Ready';
    if (status === 'failed') return 'Something went wrong';
    if (status === 'cancelled') return 'Cancelled';
    return 'Ready';
  })();

  return (
    <>
      {/* Floating launcher — mid-right edge pill with bot icon (kept from prior design). */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 20);
          }}
          className="fixed top-1/2 -translate-y-1/2 right-0 z-40 rounded-l-xl rounded-r-none bg-[var(--color-primary)] text-white shadow-lg hover:pr-3 transition-all flex flex-col items-center gap-1 py-3 px-2"
          aria-label="Open chat"
          title="Ask your data"
        >
          <BotIcon />
          <span className="text-[9px] uppercase tracking-wider font-semibold writing-vertical">
            Ask
          </span>
        </button>
      )}

      {/* Right-side sidebar with backdrop. */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity"
            aria-hidden
          />
          <aside
            className="fixed top-0 right-0 z-50 h-screen w-[min(520px,100vw)] bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl flex flex-col animate-[slideInRight_180ms_ease-out]"
            role="dialog"
            aria-label="Ask your data chat"
          >
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--color-border)] shrink-0 bg-[var(--color-surface-2)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
                  <ChatBubbleIcon />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">Ask your data</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] leading-tight truncate">
                    {statusLabel}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={newChat}
                  className="w-7 h-7 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] flex items-center justify-center"
                  title="New conversation"
                  aria-label="New conversation"
                >
                  <RefreshIcon />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] flex items-center justify-center"
                  title="Close"
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Messages scroll area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--color-bg)]"
            >
              {messages.length === 0 && (
                <div className="text-center py-10 px-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)] mx-auto mb-3 flex items-center justify-center text-[var(--color-primary)]">
                    <SearchIcon />
                  </div>
                  <p className="text-sm font-medium">
                    Ask a question about this project's data
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Example: "What are the top channels by revenue last week?"
                  </p>
                </div>
              )}

              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}

              {/* Typing indicator while the agent is thinking */}
              {busy && messages.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl rounded-bl-sm px-3 py-2">
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse"
                        style={{ animationDelay: '300ms' }}
                      />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="shrink-0 border-t border-[var(--color-border)] p-3 bg-[var(--color-surface)]"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={canRespond ? 'Reply to the agent…' : 'Ask about your data…'}
                  disabled={busy && !canRespond}
                  style={{ overflow: 'hidden' }}
                  className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || (busy && !canRespond)}
                  className="h-9 w-9 shrink-0 rounded-lg bg-[var(--color-primary)] hover:opacity-90 disabled:bg-[var(--color-border-strong)] disabled:cursor-not-allowed text-white flex items-center justify-center"
                  aria-label="Send"
                >
                  <SendIcon />
                </button>
              </div>
              <div className="text-[10px] text-[var(--color-text-dim)] mt-1.5 px-1">
                Enter to send · Shift + Enter for newline
              </div>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function MessageBubble({ message: m }: { message: Message }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-[var(--color-primary)] text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap break-words">
          {m.text}
        </div>
      </div>
    );
  }
  if (m.role === 'agent') {
    return (
      <div className="flex justify-start">
        <div
          className="max-w-[90%] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-2xl rounded-bl-sm px-3 py-2 text-sm break-words [&_a]:text-[var(--color-primary)] [&_a]:underline [&_table]:text-xs [&_table]:border-collapse [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:bg-[var(--color-surface-2)] [&_th]:text-left [&_tr]:border-b [&_tr]:border-[var(--color-border)]/50 [&_code]:text-[11px] [&_code]:bg-[var(--color-bg)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-[var(--color-bg)] [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-[11px] [&_pre]:overflow-auto"
          // Agent messages can return rich HTML (tables, charts). Backend is trusted.
          dangerouslySetInnerHTML={{ __html: m.html || escapeHtml(m.text) }}
        />
      </div>
    );
  }
  if (m.role === 'processing') {
    return (
      <div className="flex justify-start">
        <div className="text-[11px] text-[var(--color-text-muted)] px-3 py-1 italic">{m.text}</div>
      </div>
    );
  }
  // error
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
        {m.text}
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

function BotIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <circle cx="12" cy="2" r="0.7" fill="currentColor" />
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <line x1="4" y1="11" x2="2.5" y2="11" />
      <line x1="4" y1="13" x2="2.5" y2="13" />
      <line x1="20" y1="11" x2="21.5" y2="11" />
      <line x1="20" y1="13" x2="21.5" y2="13" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
