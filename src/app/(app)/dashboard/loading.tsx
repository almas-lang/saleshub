import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
            <Skeleton className="mt-1 h-3 w-14" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Today's Focus */}
      <div className="rounded-xl border bg-card py-6">
        <div className="px-6 pb-4">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-3 px-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="mt-1.5 size-2 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-[55fr_45fr]">
        {/* Pipeline Overview */}
        <div className="rounded-xl border bg-card py-6">
          <div className="px-6 pb-4">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2 px-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border bg-card py-6">
          <div className="px-6 pb-4">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-4 px-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
