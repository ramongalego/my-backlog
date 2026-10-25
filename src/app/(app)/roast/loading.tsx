import { RoastHeader, RoastShell } from '@/components/roast/RoastLayout';
import { RoastFormSkeleton } from '@/components/roast/RoastSkeletons';

export default function RoastLoading() {
  return (
    <RoastShell busy>
      <RoastHeader tagline="Enter a Steam Profile and get a savage roast of their gaming habits" />
      <RoastFormSkeleton />
    </RoastShell>
  );
}
