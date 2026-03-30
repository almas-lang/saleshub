import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types";

let _supabaseAdmin: SupabaseClient<Database> | null = null;

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }
    return (_supabaseAdmin as unknown as Record<string | symbol, unknown>)[prop];
  },
});
