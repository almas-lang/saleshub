import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FunnelBuilder } from "@/components/funnels/funnel-builder";
import { SetBreadcrumb } from "@/components/layout/breadcrumb-context";
import type { FunnelWithStages } from "@/types/funnels";

export default async function FunnelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("funnels")
    .select("*, funnel_stages(*, contacts(count))")
    .eq("id", id)
    .order("order", { referencedTable: "funnel_stages" })
    .single();

  if (error || !data) {
    notFound();
  }

  // Extract contact counts per stage
  const stageContactCounts: Record<string, number> = {};
  for (const stage of (data.funnel_stages ?? []) as unknown as {
    id: string;
    contacts: { count: number }[];
  }[]) {
    stageContactCounts[stage.id] = stage.contacts?.[0]?.count ?? 0;
  }

  return (
    <>
      <SetBreadcrumb
        items={[
          { label: "Funnels", href: "/funnels" },
          { label: data.name },
        ]}
      />
      <FunnelBuilder
        funnel={data as FunnelWithStages}
        stageContactCounts={stageContactCounts}
      />
    </>
  );
}
