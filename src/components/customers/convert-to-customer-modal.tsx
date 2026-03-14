"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConvertToCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  teamMembers: { id: string; name: string }[];
}

const PROGRAMS = [
  "Current",
  "Ripple",
  "Tide",
  "Custom",
] as const;

export function ConvertToCustomerModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  teamMembers,
}: ConvertToCustomerModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [programName, setProgramName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [sessionsTotal, setSessionsTotal] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [notes, setNotes] = useState("");
  const [createInvoice, setCreateInvoice] = useState(true);

  async function handleSubmit() {
    if (!programName) {
      toast.error("Please select a program");
      return;
    }

    setSaving(true);
    const result = await safeFetch("/api/customers/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contactId,
        program_name: programName,
        amount: amount ? parseFloat(amount) : null,
        start_date: startDate || null,
        sessions_total: sessionsTotal ? parseInt(sessionsTotal) : null,
        mentor_id: mentorId || null,
        notes: notes || null,
        create_invoice: createInvoice,
      }),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${contactName} converted to customer!`);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Customer</DialogTitle>
          <DialogDescription>
            Convert {contactName} from prospect to customer and enroll them in a
            program.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Program */}
          <div className="space-y-1.5">
            <Label>Program *</Label>
            <Select value={programName} onValueChange={setProgramName}>
              <SelectTrigger>
                <SelectValue placeholder="Select program..." />
              </SelectTrigger>
              <SelectContent>
                {PROGRAMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount & Sessions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 60000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Total Sessions</Label>
              <Input
                type="number"
                placeholder="e.g. 12"
                value={sessionsTotal}
                onChange={(e) => setSessionsTotal(e.target.value)}
              />
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label className="text-xs">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Mentor */}
          <div className="space-y-1.5">
            <Label className="text-xs">Mentor / Assigned To</Label>
            <Select value={mentorId} onValueChange={setMentorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select mentor..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              placeholder="Any additional notes..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Create Invoice */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="create-invoice"
              checked={createInvoice}
              onCheckedChange={(checked) => setCreateInvoice(checked === true)}
            />
            <label htmlFor="create-invoice" className="text-sm">
              Create draft invoice for program amount
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Converting..." : "Convert to Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
