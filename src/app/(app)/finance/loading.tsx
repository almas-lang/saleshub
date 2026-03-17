import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-1 h-4 w-56" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-28" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    </div>
  );
}
