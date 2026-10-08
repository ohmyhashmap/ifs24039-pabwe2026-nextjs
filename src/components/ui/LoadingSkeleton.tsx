export default function LoadingSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  const skeletonKeys = Array.from({ length: count }, (_, index) => `skeleton-${index}`);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <output aria-live="polite" className="sr-only">Memuat konten...</output>
      {skeletonKeys.map((key) => (
        <div key={key} aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-slate-800/60" />
      ))}
    </div>
  );
}
