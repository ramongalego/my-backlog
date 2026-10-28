import { Sparkles } from 'lucide-react';

/**
 * Pick My Game's sparkles, which give a little twist as you point at the
 * button. Put `group` on the button.
 */
export function PickIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <Sparkles
      className={`${className} transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[18deg] group-hover:scale-115 motion-reduce:transition-none`}
      aria-hidden="true"
    />
  );
}
