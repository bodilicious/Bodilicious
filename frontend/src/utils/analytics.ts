/**
 * PostHog, loaded off the critical path.
 *
 * posthog-js was statically imported in main.tsx, so its ~56 KB (brotli) chunk was
 * preloaded and parsed before first render on every page — more than React itself —
 * even though init was already deferred to idle time. It's now a dynamic import made
 * when the browser is idle; events captured before it loads are queued (bounded)
 * and flushed once it's ready. With no VITE_POSTHOG_KEY nothing is ever loaded.
 */
import type { PostHog } from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const MAX_QUEUED = 50;

let client: PostHog | null = null;
let started = false;
const queue: Array<[string, Record<string, unknown> | undefined]> = [];

export function initAnalytics(): void {
  if (!KEY || started || typeof window === 'undefined') return;
  started = true;
  const load = () => {
    import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
          api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
          autocapture: true,      // Auto captures clicks and pageviews
          capture_pageview: true, // Captures page views on load
          disable_surveys: true,  // Feature unused — skips loading the surveys bundle
        });
        client = posthog;
        for (const [event, props] of queue.splice(0)) posthog.capture(event, props);
      })
      .catch((err) => console.warn('[analytics] PostHog failed to load', err));
  };
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback(load, { timeout: 5000 });
  } else {
    setTimeout(load, 1500);
  }
}

/** Capture an event now, or queue it until PostHog has loaded. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!KEY) return;
  if (client) {
    client.capture(event, props);
  } else if (queue.length < MAX_QUEUED) {
    queue.push([event, props]);
  }
}
