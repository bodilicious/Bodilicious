import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './utils/analytics';

// PostHog is fetched with a dynamic import once the browser is idle (see
// utils/analytics.ts) — it was a static import, so its whole bundle was on the
// critical path of every page even though init was already deferred.
initAnalytics();

const rootEl = document.getElementById('root')!;

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// Hydrate only when a prerender script has baked real HTML into #root
// (production only). In dev / non-prerendered pages the root is empty,
// so always fall through to createRoot to avoid hydration mismatches.
if (import.meta.env.PROD && rootEl.childElementCount > 0) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
