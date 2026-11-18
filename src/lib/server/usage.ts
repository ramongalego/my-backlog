import 'server-only';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { ownerUserIds } from '@/lib/server/owner';
import { usageSchema, type Usage } from '@/lib/usage';

/**
 * How many people use the app, leaving out the owners' own accounts. Counts
 * only (the usage_stats database function). Only the owner's page calls this,
 * after checking who is asking.
 */
export async function loadUsage(): Promise<Usage> {
  const client = tryCreateServiceClient();
  if (!client) throw new Error('Usage needs the Supabase secret key');
  const { data, error } = await client.rpc('usage_stats', { p_exclude: ownerUserIds() });
  if (error) throw new Error(`usage_stats failed: ${error.message}`);
  return usageSchema.parse(data);
}
