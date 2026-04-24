import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/index.css';

// retry: 0 — on failure, surface the error immediately instead of
// hanging in a "pending" state through backoff-then-retry.
const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 0 },
  },
});

// Router basename picks up Vite's configured base path so routes work under
// /blusterplugin/ in prod and / in dev. Trailing slash stripped.
const basename = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
