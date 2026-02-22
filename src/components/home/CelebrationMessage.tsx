export function CelebrationMessage({ gameName }: { gameName: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="h-12 w-36 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="h-12 w-12 bg-zinc-800 rounded-lg animate-pulse" />
      </div>
      <p className="text-lg text-zinc-100 animate-celebration">
        You finished{' '}
        <span className="font-semibold text-transparent bg-clip-text bg-linear-to-r from-violet-400 to-fuchsia-400">
          {gameName}
        </span>
        !
      </p>
    </div>
  );
}
