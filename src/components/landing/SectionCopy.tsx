export function SectionCopy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-lg">
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink-50 leading-tight mb-5">
        {title}
      </h2>
      <div className="space-y-4 text-ink-400 leading-relaxed">{children}</div>
    </div>
  );
}
