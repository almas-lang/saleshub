import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
import type { ContactWithStage } from "./contacts";

// Row types
export type CustomerProgram = Tables<"customer_programs">;
export type CustomerProgramInsert = TablesInsert<"customer_programs">;
export type CustomerProgramUpdate = TablesUpdate<"customer_programs">;

// Customer is a contact with type = "customer"
export type Customer = ContactWithStage;

// Program with mentor info
export type CustomerProgramWithMentor = CustomerProgram & {
  team_members: { id: string; name: string } | null;
};

// For the convert-to-customer form
export interface ConvertToCustomerPayload {
  contact_id: string;
  program_name: string;
  amount: number | null;
  start_date: string | null;
  sessions_total: number | null;
  mentor_id: string | null;
  notes: string | null;
  create_invoice: boolean;
}
