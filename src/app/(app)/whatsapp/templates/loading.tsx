import { Skeleton } from "@/components/ui/skeleton";

export default function WhatsAppTemplatesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-1.5 h-4 w-72" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 shadow-sm">
            <Skeleton className="h-5 w-36" />
            <div className="mt-2 flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-4/5" />
            <Skeleton className="mt-1.5 h-4 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
