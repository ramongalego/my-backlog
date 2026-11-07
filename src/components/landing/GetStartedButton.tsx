import { Button } from '@/components/ui/Button';

/** The page's main call to action: opens sign-up. */
export function GetStartedButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="lg" aria-haspopup="dialog" onClick={onClick}>
      Get Started
    </Button>
  );
}
