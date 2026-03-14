"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserCheck } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ContactWithStage } from "@/types/contacts";
import type { CustomerProgram } from "@/types/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";

interface CustomerWithPrograms extends ContactWithStage {
  programs: CustomerProgram[];
  totalPaid: number;
}

interface CustomerListProps {
  customers: CustomerWithPrograms[];
  total: number;
  page: number;
  totalPages: number;
}

export function CustomerList({ customers, total, page, totalPages }: CustomerListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  function navigateWithParams(overrides: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, val] of Object.entries(overrides)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    router.push(`/customers?${params.toString()}`);
  }

  function handleSearch() {
    navigateWithParams({ search, page: "1" });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="pl-8"
        />
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No customers yet"
          description="Convert prospects to customers when they sign up for a program."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const activeProgram = customer.programs?.[0];
                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {customer.first_name} {customer.last_name ?? ""}
                        </p>
                        {customer.email && (
                          <p className="text-xs text-muted-foreground">{customer.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {activeProgram ? (
                        <Badge variant="outline" className="text-xs">
                          {activeProgram.program_name}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {activeProgram?.status ? (
                        <Badge
                          variant="outline"
                          className={
                            activeProgram.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {activeProgram.status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {activeProgram?.start_date
                        ? formatDate(activeProgram.start_date)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {activeProgram?.sessions_total ? (
                        <span className="text-sm tabular-nums">
                          {activeProgram.sessions_completed ?? 0}/{activeProgram.sessions_total}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {customer.totalPaid > 0
                        ? formatCurrency(customer.totalPaid)
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => navigateWithParams({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => navigateWithParams({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
