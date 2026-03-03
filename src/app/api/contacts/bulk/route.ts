import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bulkSchema = z.object({
  action: z.enum(["assign", "move_stage", "add_tag", "delete", "restore"]),
  contact_ids: z.array(z.string().uuid()).min(1).max(100),
  assigned_to: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  funnel_id: z.string().uuid().optional(),
  tag: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = bulkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { action, contact_ids } = parsed.data;

  switch (action) {
    case "assign": {
      if (!parsed.data.assigned_to) {
        return NextResponse.json(
          { error: "assigned_to is required for assign action" },
          { status: 400 }
        );
      }
      const { error } = await supabase
        .from("contacts")
        .update({ assigned_to: parsed.data.assigned_to })
        .in("id", contact_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      break;
    }

    case "move_stage": {
      if (!parsed.data.stage_id) {
        return NextResponse.json(
          { error: "stage_id is required for move_stage action" },
          { status: 400 }
        );
      }

      const { data: newStage } = await supabase
        .from("funnel_stages")
        .select("id, name, funnel_id")
        .eq("id", parsed.data.stage_id)
        .single();

      if (!newStage) {
        return NextResponse.json({ error: "Stage not found" }, { status: 404 });
      }

      const updateFields: Record<string, unknown> = {
        current_stage_id: parsed.data.stage_id,
      };
      if (parsed.data.funnel_id) {
        updateFields.funnel_id = parsed.data.funnel_id;
      }

      const { error } = await supabase
        .from("contacts")
        .update(updateFields)
        .in("id", contact_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Bulk-insert stage_change activities
      const activities = contact_ids.map((cid) => ({
        contact_id: cid,
        type: "stage_change" as const,
        title: `Stage changed to ${newStage.name}`,
        metadata: {
          new_stage_name: newStage.name,
          new_stage_id: newStage.id,
        },
      }));

      await supabase.from("activities").insert(activities);
      break;
    }

    case "add_tag": {
      if (!parsed.data.tag) {
        return NextResponse.json(
          { error: "tag is required for add_tag action" },
          { status: 400 }
        );
      }

      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, tags")
        .in("id", contact_ids);

      if (!contacts) {
        return NextResponse.json({ error: "No contacts found" }, { status: 404 });
      }

      const tag = parsed.data.tag;
      await Promise.all(
        contacts.map((c) => {
          const existingTags: string[] = c.tags ?? [];
          if (existingTags.includes(tag)) return Promise.resolve();
          return supabase
            .from("contacts")
            .update({ tags: [...existingTags, tag] })
            .eq("id", c.id);
        })
      );
      break;
    }

    case "delete": {
      const { error } = await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", contact_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      break;
    }

    case "restore": {
      const { error } = await supabase
        .from("contacts")
        .update({ deleted_at: null })
        .in("id", contact_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      break;
    }
  }

  return NextResponse.json({ success: true, count: contact_ids.length });
}
