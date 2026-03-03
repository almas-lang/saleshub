import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/types";

// Row types (what you get back from a SELECT)
export type Contact = Tables<"contacts">;
export type ContactFormResponse = Tables<"contact_form_responses">;
export type Activity = Tables<"activities">;
export type Task = Tables<"tasks">;

// Insert types (what you pass to an INSERT)
export type ContactInsert = TablesInsert<"contacts">;
export type ActivityInsert = TablesInsert<"activities">;
export type TaskInsert = TablesInsert<"tasks">;

// Update types (what you pass to an UPDATE)
export type ContactUpdate = TablesUpdate<"contacts">;
export type TaskUpdate = TablesUpdate<"tasks">;

// Notification types
export type Notification = Tables<"notifications">;
export type NotificationInsert = TablesInsert<"notifications">;
export type NotificationUpdate = TablesUpdate<"notifications">;

// Enum aliases
export type ContactType = Enums<"contact_type">;
export type AccountType = Enums<"account_type">;
export type ActivityType = Enums<"activity_type">;
export type TaskPriority = Enums<"task_priority">;
export type TaskStatus = Enums<"task_status">;
export type TaskType = Enums<"task_type">;

// Contact with joined relations (for detail views)
export type ContactWithStage = Contact & {
  funnel_stages: { id: string; name: string; color: string } | null;
  funnels: { id: string; name: string } | null;
  team_members: { id: string; name: string } | null;
};

// Activity with user attribution
export type ActivityWithUser = Activity & {
  team_members: { name: string } | null;
};
