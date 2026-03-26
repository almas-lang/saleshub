"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, UserX, UserCheck, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { safeFetch } from "@/lib/fetch";
import type { TeamMemberValues } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
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

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full access to all settings, data, and team management",
  sales: "Access to prospects, funnels, invoices, and assigned leads",
  marketing: "Access to campaigns, templates, and analytics",
  viewer: "Read-only access to dashboards and reports",
};

export function TeamList({ members: initialMembers }: TeamListProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {members.length} member{members.length !== 1 && "s"}
          </p>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 size-3.5" />
            Add Member
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Add your first team member to start collaborating."
          action={{ label: "Add Member", onClick: openAdd }}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden rounded-xl border bg-card lg:block">
            <TooltipProvider>
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
                  {filtered.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone ?? "—"}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge
                              variant="secondary"
                              className={ROLE_COLORS[member.role] ?? ""}
                            >
                              {member.role}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            {ROLE_DESCRIPTIONS[member.role] ?? member.role}
                          </TooltipContent>
                        </Tooltip>
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
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No members matching &ldquo;{search}&rdquo;
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((member, index) => (
              <div
                key={member.id}
                className="rounded-xl border bg-card p-4 shadow-sm"
                style={{
                  animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
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
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={ROLE_COLORS[member.role] ?? ""}
                  >
                    {member.role}
                  </Badge>
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
                  {member.google_calendar_connected && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-600"
                    >
                      Calendar
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No members matching &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </>
      )}

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
