import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/layout/Page';
import { UsageReport } from '@/components/usage/UsageReport';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/server/owner';
import { loadUsage } from '@/lib/server/usage';

// Each request checks who is asking: never prerendered or cached.
export const dynamic = 'force-dynamic';

// The owner's page. For anyone else it answers exactly as an address that
// doesn't exist does, so it sits outside the (app) group (whose header would
// show), with no title, no loading state (which would answer before the check)
// and no place in PROTECTED_ROUTES (whose sign-in redirect and robots.txt
// entry would give it away). Nothing links to it.
export default async function UsagePage() {
  const supabase = await createClient();
  // getUser asks Supabase Auth itself, so a revoked or forged session fails.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isOwner(user?.id)) notFound();

  const usage = await loadUsage();
  return (
    <Page>
      <PageHeader title="Usage" description="Not counting your own account" />
      <UsageReport usage={usage} />
    </Page>
  );
}
