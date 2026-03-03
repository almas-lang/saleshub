import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/types";

// Row types
export type Funnel = Tables<"funnels">;
export type FunnelStage = Tables<"funnel_stages">;

// Insert types
export type FunnelInsert = TablesInsert<"funnels">;
export type FunnelStageInsert = TablesInsert<"funnel_stages">;

// Update types
export type FunnelUpdate = TablesUpdate<"funnels">;
export type FunnelStageUpdate = TablesUpdate<"funnel_stages">;

// Enum aliases
export type SalesType = Enums<"sales_type">;

// Funnel with stages (for detail views)
export type FunnelWithStages = Funnel & {
  funnel_stages: FunnelStage[];
};
