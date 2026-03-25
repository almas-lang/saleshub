import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

// Row types
export type BookingPage = Tables<"booking_pages">;
export type Booking = Tables<"bookings">;

// Insert types
export type BookingPageInsert = TablesInsert<"booking_pages">;
export type BookingInsert = TablesInsert<"bookings">;

// Update types
export type BookingPageUpdate = TablesUpdate<"booking_pages">;
export type BookingUpdate = TablesUpdate<"bookings">;

// Extended types
export type BookingPageWithCount = BookingPage & {
  booking_count: number;
};

export type BookingWithRelations = Booking & {
  contacts: { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
  team_members: { id: string; name: string } | null;
  booking_pages: { id: string; title: string; slug: string } | null;
};

// JSONB field types
export interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "radio" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

export interface DaySchedule {
  day: number; // 0-6 (Sun-Sat)
  enabled: boolean;
  start_time: string; // "10:00"
  end_time: string;   // "18:00"
}

export interface AvailabilityRules {
  timezone: string;
  schedule: DaySchedule[];
  buffer_minutes: number;
  max_per_day: number;
  blocked_dates: string[];
  assignment_mode: "round_robin" | "specific";
  /** Rolling window: only allow bookings within the next N days. 0 or undefined = 60 days. */
  booking_window_days?: number;
}

// Team member for assignment
export interface TeamMember {
  id: string;
  name: string;
}
