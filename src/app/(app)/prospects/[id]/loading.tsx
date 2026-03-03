import { Skeleton } from "@/components/ui/skeleton";

export default function ProspectDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-4 w-28" />

      {/* Identity zone */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 items-start gap-4">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>

        {/* Quick actions sidebar (lg only) */}
        <div className="hidden shrink-0 gap-2 lg:flex">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* Tabs placeholder */}
      <div className="flex gap-4 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>

      {/* 2-column overview grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Qualifying data card */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>

        {/* Pipeline + tasks cards */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 flex-1 rounded-full" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-6 space-y-3">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
