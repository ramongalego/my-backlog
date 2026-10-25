import { RoastHeader, RoastShell } from '@/components/roast/RoastLayout';
import { RoastResultSkeleton } from '@/components/roast/RoastSkeletons';

export default function SharedRoastLoading() {
  return (
    <RoastShell busy>
      <RoastHeader />
      <RoastResultSkeleton />
    </RoastShell>
  );
}
