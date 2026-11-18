import { Button } from '@/components/ui/Button';

export function GetStartedButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="lg" aria-haspopup="dialog" onClick={onClick}>
      Get Started
    </Button>
  );
}
