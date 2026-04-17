// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry/scrub';

Sentry.init({
  dsn: 'https://9a24a3c8bf2c8dac5df8099d4a35a95e@o4511196944531456.ingest.de.sentry.io/4511196948529232',
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
