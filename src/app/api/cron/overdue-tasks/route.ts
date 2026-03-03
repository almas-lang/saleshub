import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    // Find pending tasks past their due date and mark them overdue
    const { data: overdueTasks, error: fetchError } = await supabaseAdmin
      .from("tasks")
      .select("id, title, assigned_to, contact_id")
      .eq("status", "pending")
      .lt("due_at", now)
      .not("due_at", "is", null);

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!overdueTasks?.length) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const overdueIds = overdueTasks.map((t) => t.id);

    // Batch update status to overdue
    const { error: updateError } = await supabaseAdmin
      .from("tasks")
      .update({ status: "overdue", updated_at: now })
      .in("id", overdueIds);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Create notifications for assigned team members
    const notificationMap = new Map<string, string[]>();
    for (const task of overdueTasks) {
      if (task.assigned_to) {
        const existing = notificationMap.get(task.assigned_to) ?? [];
        existing.push(task.title);
        notificationMap.set(task.assigned_to, existing);
      }
    }

    if (notificationMap.size > 0) {
      const notifications = Array.from(notificationMap.entries()).map(
        ([userId, taskTitles]) => ({
          user_id: userId,
          title: `${taskTitles.length} task${taskTitles.length !== 1 ? "s" : ""} overdue`,
          body:
            taskTitles.length <= 3
              ? taskTitles.join(", ")
              : `${taskTitles.slice(0, 3).join(", ")} and ${taskTitles.length - 3} more`,
          link: "/tasks?status=overdue",
          read: false,
        })
      );

      await supabaseAdmin.from("notifications").insert(notifications);
    }

    return NextResponse.json({
      success: true,
      updated: overdueIds.length,
    });
  } catch (error) {
    console.error("Overdue tasks cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
