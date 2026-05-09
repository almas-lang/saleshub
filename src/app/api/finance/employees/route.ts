export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, employee_number, role } = body as {
    name: string;
    employee_number: string;
    role?: string;
  };

  if (!name || !employee_number) {
    return NextResponse.json({ error: "name and employee_number required" }, { status: 400 });
  }

  // Upsert — if employee_number exists, update name/role
  const { data, error } = await supabaseAdmin
    .from("employees")
    .upsert(
      { name, employee_number, role: role ?? null, active: true },
      { onConflict: "employee_number" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
