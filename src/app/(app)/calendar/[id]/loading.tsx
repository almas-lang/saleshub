import { Skeleton } from "@/components/ui/skeleton";

export default function BookingPageBuilderLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-7 w-60" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <Skeleton className="h-px w-full" />

      <div className="mx-auto max-w-3xl space-y-8">
        {/* Basic details */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </div>

        <Skeleton className="h-px w-full" />

        {/* Availability */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-28" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>

        <Skeleton className="h-px w-full" />

        {/* Form fields */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
