import { PublicHeader } from '@/components/PublicHeader';

// Marketing pages are signed-out only (the proxy redirects signed-in users),
// so they skip the app shell: no React Query, auth queries or library sync.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
