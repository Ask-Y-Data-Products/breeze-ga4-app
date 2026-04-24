// Capability comparison between the Breeze GA4 Claude Code plugin and this app.
// Drives the Management page.

export type Status = 'parity' | 'improved' | 'gap' | 'new';

export interface CapabilityRow {
  capability: string;
  pluginHow: string;
  appHow: string;
  status: Status;
  rationale?: string;
}

export interface CapabilityGroup {
  group: string;
  summary: string;
  rows: CapabilityRow[];
}

export const COMPARISON: CapabilityGroup[] = [
  {
    group: 'From the call recording',
    summary: 'Every product request Merritt raised in the April call — status of what we delivered and what\'s still open.',
    rows: [
      {
        capability: 'Checkboxes for common time periods',
        pluginHow: '"There were easy checkboxes for, like, time periods, or, you know, dates, or whatever" — users currently define ranges manually or accept defaults.',
        appHow: 'FilterBar has a row of preset chips: Today / Yesterday / 7d / 30d / 90d / MTD / YTD / All time. Plus custom From/To pickers.',
        status: 'improved',
      },
      {
        capability: 'Deterministic over probabilistic outputs',
        pluginHow: '"Make it more deterministic as opposed to probabilistic" — LLM composes every query from scratch.',
        appHow: 'Explore + Funnel + Filter chips generate SQL deterministically from GUI controls. The exact SQL is visible under "View generated SQL" on every page.',
        status: 'improved',
      },
      {
        capability: 'Quick-filter tick boxes for common constraints',
        pluginHow: 'User has to write or prompt each filter.',
        appHow: 'FilterBar has tick-box chips: Logged-in only / Logged-out only / Mobile only / Desktop only / US only / Direct / Paid Search. One click applies/removes.',
        status: 'new',
      },
      {
        capability: 'GUI-behind-the-queries',
        pluginHow: '"Operating out of Claude Code itself" — CLI/chat surface only.',
        appHow: 'Full web app. Browser-native, no terminal, no install.',
        status: 'improved',
      },
      {
        capability: 'Setup without GitLab / gcloud CLI',
        pluginHow: 'Users need GitLab repo access + GitLab CLI auth + Google Cloud CLI install + gcloud auth — "setup is a pain".',
        appHow: 'Open a URL. In deployed mode the Asky cookie handles auth — zero local install.',
        status: 'improved',
      },
      {
        capability: 'Scale adoption to non-technical stakeholders',
        pluginHow: '"Not sure Claude Code is going to scale well across organizations unless we do a lot of training." ~5–10 active users.',
        appHow: 'Any web browser. No command-line literacy required.',
        status: 'improved',
      },
      {
        capability: 'Data-quality anomaly catalog visible at query time',
        pluginHow: 'YAML registry of anomalies the model consults before writing SQL. Not surfaced to the report reader.',
        appHow: 'Anomaly banner sits at the top of every analytical page and filters to the selected date range.',
        status: 'improved',
      },
      {
        capability: 'Industry-event context (plane crash, weather)',
        pluginHow: '"Industry events, you know, like a plane crash that affected demand, or big weather events" — wished for but not ported.',
        appHow: 'Anomaly catalog now supports an `industry-event` kind (with distinct badge in the UI). Two sample entries for the 2025 holiday peak and winter storm are wired in as a starting point.',
        status: 'new',
      },
      {
        capability: 'User-facing validation / "can trust the data"',
        pluginHow: 'Twyman\'s Law prompt embedded in ga4-query SKILL.md. Only applies to the query author.',
        appHow: 'Data Quality page shows NULL %, row-finality, bot share. Sanity panels on Executive. Anomaly banner on every page.',
        status: 'improved',
      },
      {
        capability: 'Column / row-level permission masking',
        pluginHow: 'Coarse: BigQuery Data Viewer on the whole dataset.',
        appHow: 'Same coarseness today — depends on what the Asky project exposes. Cannot mask PII fields per-user yet.',
        status: 'gap',
        rationale: 'Needs platform work on Asky (row/column security policies) or an upstream view with masking applied.',
      },
      {
        capability: 'Snowflake integration',
        pluginHow: 'Not supported — plugin is BigQuery-only.',
        appHow: 'Not yet. The Asky backend would need a Snowflake connector; the app code is warehouse-agnostic already (it just sends SQL to Asky).',
        status: 'gap',
      },
      {
        capability: 'Cross-warehouse permission alignment',
        pluginHow: '"You wouldn\'t necessarily have the same permission set in BigQuery and Snowflake."',
        appHow: 'Still an open problem — same dependency on Asky handling multi-warehouse auth.',
        status: 'gap',
      },
      {
        capability: 'License / seat provisioning bottleneck',
        pluginHow: '"We hit our account limit for licenses."',
        appHow: 'Per-user seats are Asky\'s concern, not the app\'s. The web app itself has no seat cap — any browser works.',
        status: 'improved',
      },
      {
        capability: 'Model continuity / self-hosting fallback',
        pluginHow: '"Do we need to run on a different model? Do we need to host our own?"',
        appHow: 'The app doesn\'t depend on Claude at runtime — the chat uses a rule-based NL→SQL layer. If Asky\'s backend stays up, the app stays up.',
        status: 'improved',
      },
      {
        capability: 'Dashboard automation / cron refresh',
        pluginHow: '"My PM scheduled a cron job so these get refreshed every day."',
        appHow: 'Pages re-fetch on load; queries are fast. No cron needed.',
        status: 'improved',
      },
      {
        capability: 'Feedback mechanism stakeholders actually use',
        pluginHow: '"I do have a feedback mechanism built in, but no one\'s using it."',
        appHow: 'Not yet — no in-app feedback surface beyond the Settings/About copy. Open item.',
        status: 'gap',
      },
      {
        capability: 'SQL validation + cost preview before execution',
        pluginHow: 'validate_query.py: partition check + bq dry-run cost + anomaly overlap.',
        appHow: 'Generated SQL is visible before submission. No dry-run cost (DuckDB over parquet has no per-scan pricing). Anomaly overlap is the always-visible banner.',
        status: 'parity',
      },
      {
        capability: 'Fuzzy-identifier safety (user_id vs logged_in)',
        pluginHow: '"The skill queried sessions and said, if there\'s a user_id, I\'m going to assume this person is logged in. Not a bad proxy, but not exactly accurate."',
        appHow: 'Schema docs flag the issue explicitly. Anomaly catalog has a "user_id NULL on ~60% of rows" note. Explore and Chat use the Boolean `logged_in` column on sessions instead of presence of user_id.',
        status: 'improved',
      },
    ],
  },

  {
    group: 'Access & setup',
    summary: 'Who can use it and what it takes to get started.',
    rows: [
      {
        capability: 'Install / onboarding',
        pluginHow:
          'Users install Claude Code, add the GitLab private marketplace, authenticate GitLab in the terminal, install gcloud CLI, run `gcloud auth login`, then enable the plugin. Takes 10–30 minutes; multiple terminal steps.',
        appHow:
          'Open a URL in a browser. In Stage mode, paste an X-App-Token once in Settings; in Deployed mode the browser cookie handles auth — no token required.',
        status: 'improved',
        rationale: 'Merritt called setup the biggest blocker — this removes GitLab, gcloud, and terminal auth entirely.',
      },
      {
        capability: 'Audience',
        pluginHow: 'Technical users comfortable in Claude Code / terminal. ~5–10 active users at Breeze.',
        appHow: 'Any stakeholder with a browser. No terminal.',
        status: 'improved',
      },
      {
        capability: 'Auto-update',
        pluginHow: 'GitLab repo + plugin marketplace with GITLAB_TOKEN; users must keep auto-update enabled or go stale.',
        appHow: 'Rebuild → upload new zip. All users get the new version on next load.',
        status: 'parity',
      },
    ],
  },
  {
    group: 'Querying data',
    summary: 'How a question becomes a number.',
    rows: [
      {
        capability: 'SQL generation',
        pluginHow: 'ga4-query skill: LLM composes SQL from natural language using bundled YAML schema docs.',
        appHow:
          'Explore page: deterministic GUI (filters + group-by + metric) generates the exact SQL client-side; visible under "View generated SQL".',
        status: 'improved',
        rationale: 'Deterministic instead of probabilistic — the "checkbox filter" feedback from the call.',
      },
      {
        capability: 'Validation / dry-run',
        pluginHow: 'validate_query.py: partition check + bq dry-run cost estimate + anomaly overlap check.',
        appHow:
          'Asky runs DuckDB over uploaded parquet — pricing is not pay-per-scan, so dry-run cost is not applicable. Anomaly overlap surfaces via the AnomalyBanner on every page.',
        status: 'parity',
      },
      {
        capability: 'Cost guardrails',
        pluginHow: 'Warn >$0.50 (100GB), error >$2.50 (500GB) at query time.',
        appHow: 'N/A — no per-query cost.',
        status: 'parity',
      },
      {
        capability: 'Ad-hoc exploration',
        pluginHow: 'Ask question → model writes SQL → run. Free-form, flexible.',
        appHow: 'Explore page covers the common shape (group-by × metric × filters × limit) with zero prompt-crafting.',
        status: 'parity',
        rationale: 'Covers ~80% of plugin use cases. Raw SQL window is a candidate addition.',
      },
    ],
  },
  {
    group: 'Learn / schema',
    summary: 'Figuring out what a column means.',
    rows: [
      {
        capability: 'Schema browser',
        pluginHow:
          'ga4-learn skill surfaces YAML files (schema, events, business, site, attribution, data-quality) on demand.',
        appHow:
          'Learn page: table selector + grouped column cards (Identity, Time, Device, Attribution, Trip, Behavior, Quality, Metric) with search & group filter.',
        status: 'parity',
      },
      {
        capability: 'Business / site / attribution context',
        pluginHow: 'Extensive markdown files under context/ (booking-funnel, site-map, channel-grouping, etc.).',
        appHow: 'Not ported yet — only column-level docs are in the app.',
        status: 'gap',
        rationale: 'A manager looking for "how does check-in work" or "how is channel_session derived" won\'t find it here yet.',
      },
    ],
  },
  {
    group: 'Experiments',
    summary: 'A/B tests on the experiments table.',
    rows: [
      {
        capability: 'Variation breakdown',
        pluginHow: 'ga4-stats skill; SQL written per question. Uses scipy for chi-square / power analysis.',
        appHow: 'Experiments page shows per-variation sessions, users, logged-in %, share; channel and device mix per arm.',
        status: 'improved',
        rationale: 'One click vs. per-question prompt crafting.',
      },
      {
        capability: 'Sample-size / power / BH correction',
        pluginHow: 'scripts/power_analysis.py and scripts/bh_correction.py (scipy).',
        appHow: 'Not ported. "Balance" KPI (coefficient of variation across arms) is the only statistical callout.',
        status: 'gap',
        rationale: 'Expect a few dozen lines of TS to re-implement chi-square two-proportion and BH. Open item.',
      },
    ],
  },
  {
    group: 'Paid media',
    summary: 'Spend, clicks, impressions, ratios.',
    rows: [
      {
        capability: 'Spend / CTR / CPC / CPM',
        pluginHow: 'User prompts → ga4-query writes SQL joining ad_spend to ga4_sessions, with LOWER() + caveats.',
        appHow:
          'Paid Media page: pre-built KPIs, spend by source, source economics (CTR/CPC/CPM per source), top-N campaigns with sort, coverage caveat pinned.',
        status: 'improved',
      },
      {
        capability: 'ROAS / cost per booking',
        pluginHow: 'LOWER() join to ga4_sessions.booking_revenue. Fully supported.',
        appHow: 'ROAS-by-campaign table on Paid Media page with the exact LOWER() join pattern baked in.',
        status: 'parity',
      },
    ],
  },
  {
    group: 'Data quality & trust',
    summary: 'How consumers know the numbers are right.',
    rows: [
      {
        capability: 'Anomaly catalog',
        pluginHow: 'YAML files under context/data-quality/, consulted by the model when it writes SQL.',
        appHow: 'TS catalog rendered as a banner on Executive/Explore and as a full page in Data Quality.',
        status: 'improved',
        rationale: 'Visible to every consumer instead of only to the query-author.',
      },
      {
        capability: 'Sanity / NULL coverage',
        pluginHow: 'Not surfaced — each analyst checks ad-hoc.',
        appHow: 'Data Quality page: NULL rates for user_id, cardholder, session_id, user_pseudo_id; date range; is_final share.',
        status: 'new',
      },
      {
        capability: 'Twyman\'s Law prompt',
        pluginHow: 'Embedded in ga4-query SKILL.md — tells the model to disprove surprising results.',
        appHow: 'Not enforced; users infer from the sanity panel.',
        status: 'gap',
      },
    ],
  },
  {
    group: 'Reporting output',
    summary: 'How results leave the tool.',
    rows: [
      {
        capability: 'Branded HTML report',
        pluginHow: 'scripts/create_report.py → self-contained HTML with Chart.js, Breeze CSS, opens in browser.',
        appHow: 'Page screenshots + data tables work for now; no export button yet.',
        status: 'gap',
      },
      {
        capability: 'Scheduled refresh',
        pluginHow: "Not in the plugin — a PM set up cron externally to regenerate a report each day.",
        appHow: 'Pages re-fetch on load; queries are fast. Same effect without a cron.',
        status: 'improved',
      },
    ],
  },
  {
    group: 'Funnel analysis',
    summary: 'Step-by-step drop-off views.',
    rows: [
      {
        capability: 'Custom-step funnel',
        pluginHow: 'User prompts ga4-query to compose a funnel CTE over ga4_events with event_name OR path filters. Cost: scanning ga4_events each time.',
        appHow: 'Funnel page with a visual step builder: mix event steps and page-path steps (exact or starts-with), pick sessions / users / events as the metric, one SQL scan returns all step counts.',
        status: 'improved',
        rationale: 'Single-scan SQL with FILTER (WHERE …) is both faster and easier to verify than per-step subqueries.',
      },
      {
        capability: 'Funnel visualization',
        pluginHow: 'HTML report generated on demand with Chart.js — user has to ask for it.',
        appHow: 'Native ECharts funnel + step table showing count, % of top, and % of previous step — always on screen.',
        status: 'improved',
      },
    ],
  },
  {
    group: 'Conversational Q&A',
    summary: 'Ask-a-question chat surface.',
    rows: [
      {
        capability: 'Natural-language question → answer',
        pluginHow: 'The whole plugin IS this — the user talks to Claude, the skill writes SQL and runs it.',
        appHow: 'Floating chat button (bottom-right) opens a lightweight chat. Rule-based NL→SQL covers common shapes (top/by/metric/filter). Answers render as chart + table with copy-to-clipboard and a "+" to start fresh.',
        status: 'parity',
        rationale: 'Not as flexible as an LLM — but deterministic, fast, no server-side LLM cost. Easy to extend with more intents.',
      },
    ],
  },
  {
    group: 'Governance',
    summary: 'Access control and PII.',
    rows: [
      {
        capability: 'Per-user BigQuery auth',
        pluginHow: 'Each user authenticates with their own @flybreeze.com Google account — audit trail via gcloud.',
        appHow:
          'Asky cookie for the deployed user. Row/column-level masking depends on what the Asky project exposes.',
        status: 'parity',
        rationale: 'For GA4 data (minimal PII) this is fine; other domains (e.g. Snowflake enterprise) would need more work.',
      },
      {
        capability: 'Row / column masking',
        pluginHow: 'Coarse: BigQuery Data Viewer + Job User on the whole dataset.',
        appHow: 'Same coarseness today. Asky provides a place to harden this upstream.',
        status: 'parity',
      },
    ],
  },
  {
    group: 'Coverage of data',
    summary: 'Which source tables are live.',
    rows: [
      {
        capability: 'ga4_experiments',
        pluginHow: 'Used by ga4-stats via BigQuery.',
        appHow: 'Loaded in Asky and live on Experiments / Explore / Data Quality / Learn.',
        status: 'parity',
      },
      {
        capability: 'ad_spend (WindsorAI)',
        pluginHow: 'Used for paid spend queries with LOWER() joins.',
        appHow: 'Loaded; dedicated Paid Media page uses it directly.',
        status: 'parity',
      },
      {
        capability: 'ga4_sessions',
        pluginHow: 'Workhorse table for conversion/channel/revenue queries.',
        appHow: 'Loaded. Drives the Executive page (real sessions, bookings, revenue by product) and the Paid Media ROAS join.',
        status: 'parity',
      },
      {
        capability: 'ga4_events',
        pluginHow: 'Funnel steps, page paths, product-level revenue.',
        appHow: 'Loaded. Drives the Funnel page (event-mode & page-path mode) and is queryable via Explore / Chat.',
        status: 'parity',
      },
    ],
  },
];

export const STATUS_META: Record<Status, { label: string; tone: 'green' | 'blue' | 'amber' | 'slate' }> = {
  parity: { label: 'Parity', tone: 'slate' },
  improved: { label: 'Improved', tone: 'green' },
  new: { label: 'New in app', tone: 'blue' },
  gap: { label: 'Gap', tone: 'amber' },
};
