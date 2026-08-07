import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PostHogProvider>
  </StrictMode>
);
