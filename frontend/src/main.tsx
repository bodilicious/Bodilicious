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

// If the server (prerender script) already baked HTML into #root, hydrate it so
// React reuses the existing DOM nodes instead of wiping and rebuilding them.
// This eliminates the flash-of-blank-content that createRoot().render() would
// cause on prerendered pages. Falls back to createRoot for any page not in the
// prerender set (admin routes, auth pages, etc.) where #root is empty.
if (rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
