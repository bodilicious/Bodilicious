import { PostHog } from 'posthog-node';
import dotenv from 'dotenv';
dotenv.config();

export const posthogClient = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      // Flush batched events every 5 minutes instead of the default 30 seconds.
      // At idle this reduces outbound calls from 120/hour → 12/hour.
      flushInterval: 300_000,
      // Feature-flag polling is not used server-side; disabling it removes
      // another 120 outbound HTTP calls/hour that were burning Service-Initiated bandwidth.
      featureFlagsPollingInterval: 0,
      // Skip GeoIP lookups — saves one network round-trip per captured event.
      disableGeoip: true,
    })
  : null;

export const trackServerEvent = (distinctId, eventName, properties = {}) => {
  if (posthogClient) {
    posthogClient.capture({
      distinctId: distinctId.toString(),
      event: eventName,
      properties,
    });
  }
};

export const shutdownPosthog = async () => {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
};
