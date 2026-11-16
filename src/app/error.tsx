'use client';

import { CrashScreen } from '@/components/layout/CrashScreen';

export default function ErrorPage(props: { error: unknown; retry: () => void }) {
  return <CrashScreen {...props} />;
}
