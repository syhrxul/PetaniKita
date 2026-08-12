export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-1/4" />
      </div>
      <div className="h-8 bg-slate-100 rounded-xl w-full" />
      <div className="h-10 bg-slate-200 rounded-xl w-full" />
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 gap-6" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-3 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-1/2" />
      <div className="h-8 bg-slate-200 rounded w-3/4" />
    </div>
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-200 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}
