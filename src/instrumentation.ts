import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry/options';

export function register() {
  Sentry.init({
    ...sentryOptions,
    // The server catches its failures and logs them with console.error rather
    // than throwing, so those logs are what reach Sentry.
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
  });
}

export const onRequestError = Sentry.captureRequestError;
