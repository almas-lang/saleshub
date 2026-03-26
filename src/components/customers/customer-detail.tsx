"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Receipt,
  Plus,
  Pencil,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatCurrency, formatPhone } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import type { ContactWithStage } from "@/types/contacts";
import type { CustomerProgram } from "@/types/customers";
import type { InvoiceWithContact } from "@/types/invoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgramTracker } from "./program-tracker";
import { EditCustomerDialog } from "./edit-customer-dialog";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";

interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
}

interface CustomerDetailProps {
  customer: ContactWithStage;
  programs: CustomerProgram[];
  invoices: InvoiceWithContact[];
  totalPaid: number;
  activities?: Activity[];
}

export function CustomerDetail({
  customer,
  programs,
  invoices,
  totalPaid,
  activities = [],
}: CustomerDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const initials = `${customer.first_name?.[0] ?? ""}${customer.last_name?.[0] ?? ""}`.toUpperCase();
  const fullName = `${customer.first_name} ${customer.last_name ?? ""}`.trim();

  const notes = activities.filter((a) => a.type === "note");

  async function handleAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    const result = await safeFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: customer.id,
        type: "note",
        title: "Note",
        body: note.trim(),
      }),
    });
    setSavingNote(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Note added");
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">{fullName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                Customer
              </Badge>
              {customer.converted_at && (
                <span>since {formatDate(customer.converted_at)}</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 size-3.5" />
          Edit
        </Button>
      </div>

      {/* Identity Zone */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {customer.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="size-4 text-muted-foreground" />
            <span>{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="size-4 text-muted-foreground" />
            <span>{formatPhone(customer.phone)}</span>
          </div>
        )}
        {customer.company_name && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="size-4 text-muted-foreground" />
            <span>{customer.company_name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Receipt className="size-4 text-muted-foreground" />
          <span>Total Paid: {formatCurrency(totalPaid)}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="programs">
        <TabsList variant="line">
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="mt-6">
          <ProgramTracker programs={programs} />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Invoices</h3>
              <Link href={`/invoices/new`}>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 size-3.5" />
                  New Invoice
                </Button>
              </Link>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No invoices yet.
              </p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(inv.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <InvoiceStatusBadge status={inv.status} />
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(inv.total)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="space-y-4">
            {/* Add note */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a note about this customer..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px] text-sm"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!note.trim() || savingNote}
                >
                  {savingNote && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  Add Note
                </Button>
              </div>
            </div>

            {/* Notes list */}
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No notes yet. Add one above.
              </p>
            ) : (
              <div className="space-y-3">
                {notes.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="rounded-lg border bg-card p-3"
                    style={{
                      animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
                    }}
                  >
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <FileText className="size-3" />
                      {formatDate(activity.created_at)}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {activity.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <EditCustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
      />
    </div>
  );
}
