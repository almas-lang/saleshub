"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  };
}

export function EditCustomerDialog({
  open,
  onOpenChange,
  customer,
}: EditCustomerDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(customer.first_name);
  const [lastName, setLastName] = useState(customer.last_name ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [company, setCompany] = useState(customer.company_name ?? "");

  async function handleSave() {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    setSaving(true);
    const result = await safeFetch(`/api/contacts/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company_name: company.trim() || null,
      }),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Customer updated");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">First name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Last name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Company</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
