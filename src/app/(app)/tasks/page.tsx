import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithRelations } from "@/components/tasks/task-list";
import { TasksPageClient } from "@/components/tasks/tasks-page-client";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const status = params.status ?? "";
  const priority = params.priority ?? "";
  const type = params.type ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const perPage = 25;
  const sort = params.sort ?? "due_at";
  const order = params.order ?? "asc";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("tasks")
    .select(
      "*, contacts(id, first_name, last_name), team_members:team_members!tasks_assigned_to_fkey(id, name)",
      { count: "exact" }
    );

  if (status === "overdue") {
    query = query
      .in("status", ["pending", "overdue"])
      .lt("due_at", new Date().toISOString())
      .not("due_at", "is", null);
  } else if (status) {
    query = query.eq("status", status);
  }

  if (priority) query = query.eq("priority", priority);
  if (type) query = query.eq("type", type);

  const ascending = order === "asc";
  query = query
    .order(sort, { ascending, nullsFirst: false })
    .range(from, to);

  const [tasksResult, membersResult] = await Promise.all([
    query,
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  const tasks = (tasksResult.data ?? []) as TaskWithRelations[];
  const total = tasksResult.count ?? 0;
  const totalPages = Math.ceil(total / perPage);
  const teamMembers = (membersResult.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <Suspense>
      <TasksPageClient
        tasks={tasks}
        total={total}
        page={page}
        perPage={perPage}
        totalPages={totalPages}
        teamMembers={teamMembers}
      />
    </Suspense>
  );
}
