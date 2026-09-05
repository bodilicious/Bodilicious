import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import App from './App.tsx';
import './index.css';

// Initialize PostHog after the browser is idle — removes it from the critical startup path.
// Falls back to setTimeout for Safari (no requestIdleCallback support).
if (import.meta.env.VITE_POSTHOG_KEY) {
  const initPostHog = () => {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
      autocapture: true, // Auto captures clicks and pageviews
      capture_pageview: true, // Captures page views on load
      disable_surveys: true // Feature unused in this app — skips loading the surveys.js bundle
    });
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initPostHog);
  } else {
    setTimeout(initPostHog, 1000);
  }
}

const rootEl = document.getElementById('root')!;

const app = (
  <StrictMode>
    <PostHogProvider client={posthog}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PostHogProvider>
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
