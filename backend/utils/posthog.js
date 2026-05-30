import { PostHog } from 'posthog-node';
import dotenv from 'dotenv';
dotenv.config();

export const posthogClient = new PostHog(
  process.env.POSTHOG_API_KEY,
  { host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com' }
);

export const trackServerEvent = (distinctId, eventName, properties = {}) => {
  posthogClient.capture({
    distinctId: distinctId.toString(),
    event: eventName,
    properties,
  });
};

export const shutdownPosthog = async () => {
  await posthogClient.shutdown();
};
