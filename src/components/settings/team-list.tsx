"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { safeFetch } from "@/lib/fetch";
import type { TeamMemberValues } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamMemberForm } from "./team-member-form";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  google_calendar_connected: boolean | null;
}

interface TeamListProps {
  members: TeamMember[];
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-violet-500/10 text-violet-600",
  sales: "bg-blue-500/10 text-blue-600",
  marketing: "bg-amber-500/10 text-amber-600",
  viewer: "bg-gray-500/10 text-gray-600",
};

export function TeamList({ members: initialMembers }: TeamListProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  function openAdd() {
    setEditingMember(null);
    setDialogOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditingMember(member);
    setDialogOpen(true);
  }

  async function handleSubmit(values: TeamMemberValues) {
    if (editingMember) {
      const result = await safeFetch<TeamMember>(
        `/api/team-members/${editingMember.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === editingMember.id ? result.data : m))
      );
      toast.success("Team member updated");
    } else {
      const result = await safeFetch<TeamMember>("/api/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setMembers((prev) => [...prev, result.data]);
      toast.success("Team member added");
    }

    setDialogOpen(false);
    router.refresh();
  }

  async function toggleActive(member: TeamMember) {
    const newActive = !member.is_active;
    const result = await safeFetch<TeamMember>(
      `/api/team-members/${member.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      }
    );

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, is_active: newActive } : m))
    );
    toast.success(newActive ? "Member reactivated" : "Member deactivated");
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members.length} team member{members.length !== 1 && "s"}
        </p>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1.5 size-3.5" />
          Add Member
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Calendar</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>{member.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={ROLE_COLORS[member.role] ?? ""}
                  >
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      member.is_active
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-red-500/10 text-red-600"
                    }
                  >
                    {member.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.google_calendar_connected ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-600"
                    >
                      Connected
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(member)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => toggleActive(member)}
                    >
                      {member.is_active ? (
                        <UserX className="size-3.5 text-destructive" />
                      ) : (
                        <UserCheck className="size-3.5 text-emerald-600" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No team members yet. Add your first member above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TeamMemberForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={
          editingMember
            ? {
                name: editingMember.name,
                email: editingMember.email,
                phone: editingMember.phone ?? "",
                role: editingMember.role as TeamMemberValues["role"],
              }
            : undefined
        }
        isEdit={!!editingMember}
      />
    </>
  );
}
