// sentry.client.config.js — runs in the browser
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,   // GDPR: maschera tutto il testo nei replay
      blockAllMedia: true,
    }),
  ],
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
});
