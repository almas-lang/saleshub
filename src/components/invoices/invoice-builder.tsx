"use client";

import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, Save, Send, Check, ChevronsUpDown, UserPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { calculateGST, reverseGST, DEFAULT_SAC_CODE } from "@/lib/invoices/gst";
import type { InvoiceLineItem, InstallmentInput } from "@/types/invoices";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn, formatCurrency } from "@/lib/utils";
import { INDIAN_STATES } from "@/lib/invoices/gst";
import { LineItemRow } from "./line-item-row";
import { InvoicePreview } from "./invoice-preview";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

interface EditInvoiceData {
  id: string;
  contact_id: string;
  items: InvoiceLineItem[];
  gst_number: string;
  customer_state: string;
  due_date: string;
  notes: string;
  gst_rate: number;
}

interface InvoiceBuilderProps {
  contacts: Contact[];
  editInvoice?: EditInvoiceData;
}

interface ContactSearchResponse {
  data: Contact[];
}

function emptyItem(): InvoiceLineItem {
  return { description: "", sac_code: DEFAULT_SAC_CODE, qty: 1, rate: 0, amount: 0 };
}

export function InvoiceBuilder({ contacts, editInvoice }: InvoiceBuilderProps) {
  const router = useRouter();
  const isEdit = !!editInvoice;

  const [saving, setSaving] = useState(false);
  const [contactId, setContactId] = useState(editInvoice?.contact_id ?? "");
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>(contacts);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedClientSearch = useDebounce(clientSearch, 250);
  const [useCustomClient, setUseCustomClient] = useState(false);
  const [customFirstName, setCustomFirstName] = useState("");
  const [customLastName, setCustomLastName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customCompany, setCustomCompany] = useState("");
  const [clientGst, setClientGst] = useState(editInvoice?.gst_number ?? "");
  const [clientState, setClientState] = useState(editInvoice?.customer_state ?? "");
  const [dueDate, setDueDate] = useState(editInvoice?.due_date ?? "");
  const [notes, setNotes] = useState(editInvoice?.notes ?? "");
  const [gstRate, setGstRate] = useState(editInvoice?.gst_rate ?? 18);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [items, setItems] = useState<InvoiceLineItem[]>(
    editInvoice?.items.length ? editInvoice.items : [emptyItem()]
  );
  const [hasInstallments, setHasInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [installments, setInstallments] = useState<InstallmentInput[]>([]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [gstInclusive, setGstInclusive] = useState(false);

  const selectedContact =
    contacts.find((c) => c.id === contactId) ??
    searchResults.find((c) => c.id === contactId);

  useEffect(() => {
    let cancelled = false;
    const q = debouncedClientSearch.trim();
    setSearchLoading(true);
    fetch(`/api/contacts/search?q=${encodeURIComponent(q)}&limit=50`)
      .then((r) => (r.ok ? (r.json() as Promise<ContactSearchResponse>) : Promise.reject(r)))
      .then((json) => {
        if (cancelled) return;
        setSearchResults(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedClientSearch]);

  // When GST-inclusive, reverse-calculate base amounts from entered rates
  const effectiveItems = useMemo(() => {
    if (!gstInclusive || gstRate <= 0) return items;
    return items.map((item) => {
      const baseRate = reverseGST(item.rate, gstRate);
      const baseAmount = (item.qty || 0) * baseRate;
      return { ...item, rate: baseRate, amount: baseAmount };
    });
  }, [items, gstInclusive, gstRate]);

  const gst = useMemo(() => calculateGST(effectiveItems, clientState, gstRate), [effectiveItems, clientState, gstRate]);

  const installmentSum = installments.reduce((s, i) => s + (i.amount || 0), 0);
  const installmentMismatch = hasInstallments && installments.length > 0 && Math.abs(installmentSum - gst.total) > 0.01;

  function autoFillInstallments(count: number, total: number, baseDate: string) {
    const perInstallment = Math.floor((total / count) * 100) / 100;
    const remainder = Math.round((total - perInstallment * count) * 100) / 100;
    const base = baseDate ? new Date(baseDate) : new Date();

    const newInstallments: InstallmentInput[] = [];
    for (let i = 0; i < count; i++) {
      const due = new Date(base);
      due.setDate(due.getDate() + 30 * i);
      newInstallments.push({
        installment_number: i + 1,
        amount: i === count - 1 ? perInstallment + remainder : perInstallment,
        due_date: due.toISOString().split("T")[0],
      });
    }
    setInstallments(newInstallments);
  }

  function handleItemChange(index: number, field: keyof InvoiceLineItem, value: string | number) {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "qty" || field === "rate") {
        item.amount = (item.qty || 0) * (item.rate || 0);
      }
      updated[index] = item;
      return updated;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(andSend = false) {
    if (!useCustomClient && !contactId) {
      toast.error("Please select a client");
      return;
    }
    if (useCustomClient && !customFirstName.trim()) {
      toast.error("Please enter a client name");
      return;
    }
    if (items.some((item) => !item.description.trim())) {
      toast.error("All items must have a description");
      return;
    }

    setSaving(true);

    let resolvedContactId = contactId;

    // If using custom client, create a new contact first
    if (useCustomClient) {
      const contactResult = await safeFetch<{ id: string }>("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: customFirstName.trim(),
          last_name: customLastName.trim() || undefined,
          email: customEmail.trim() || undefined,
          phone: customPhone.trim() || undefined,
          company_name: customCompany.trim() || undefined,
        }),
      });

      if (!contactResult.ok) {
        setSaving(false);
        toast.error(contactResult.error);
        return;
      }
      resolvedContactId = contactResult.data.id;
    }

    const payload = {
      contact_id: resolvedContactId,
      items: effectiveItems,
      subtotal: gst.subtotal,
      total: gst.total,
      gst_rate: gstRate,
      gst_amount: gst.isIntraState ? gst.cgst + gst.sgst : gst.igst,
      gst_number: clientGst,
      customer_state: clientState,
      due_date: dueDate,
      notes,
      status: alreadyPaid ? "paid" : andSend ? "sent" : "draft",
      include_payment_link: andSend && !alreadyPaid ? includePaymentLink : undefined,
      installments: hasInstallments && installments.length >= 2 ? installments : undefined,
      invoice_date: invoiceDate,
      paid_at: alreadyPaid ? new Date(invoiceDate).toISOString() : undefined,
    };

    const url = isEdit ? `/api/invoices/${editInvoice.id}` : "/api/invoices";
    const method = isEdit ? "PATCH" : "POST";

    const result = await safeFetch<{ id: string }>(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      setSaving(false);
      toast.error(result.error);
      return;
    }

    const invoiceId = isEdit ? editInvoice.id : result.data.id;

    // Actually send the email if requested
    if (andSend) {
      const sendResult = await safeFetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include_payment_link: includePaymentLink }),
      });

      setSaving(false);

      if (!sendResult.ok) {
        toast.error(sendResult.error);
        router.push(`/invoices/${invoiceId}`);
        router.refresh();
        return;
      }

      toast.success(isEdit ? "Invoice updated and sent" : "Invoice created and sent");
    } else {
      setSaving(false);
      toast.success(isEdit ? "Invoice updated" : "Invoice saved as draft");
    }

    router.push(isEdit ? `/invoices/${invoiceId}` : "/invoices");
    router.refresh();
  }

  const clientName = useCustomClient
    ? `${customFirstName} ${customLastName}`.trim()
    : selectedContact
      ? `${selectedContact.first_name} ${selectedContact.last_name ?? ""}`.trim()
      : "";

  const clientEmailDisplay = useCustomClient
    ? customEmail || undefined
    : selectedContact?.email ?? undefined;

  const clientPhoneDisplay = useCustomClient
    ? customPhone || undefined
    : selectedContact?.phone ?? undefined;

  const clientCompanyDisplay = useCustomClient
    ? customCompany || undefined
    : selectedContact?.company_name ?? undefined;

  function contactLabel(c: Contact) {
    const name = `${c.first_name} ${c.last_name ?? ""}`.trim();
    return c.company_name ? `${name} (${c.company_name})` : name;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left Panel: Form */}
      <div className="space-y-6">
        {/* Client Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Client</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setUseCustomClient(!useCustomClient);
                if (!useCustomClient) {
                  setContactId("");
                } else {
                  setCustomFirstName("");
                  setCustomLastName("");
                  setCustomEmail("");
                  setCustomPhone("");
                  setCustomCompany("");
                }
              }}
            >
              {useCustomClient ? (
                "Select existing client"
              ) : (
                <>
                  <UserPlus className="mr-1 size-3" />
                  New client
                </>
              )}
            </Button>
          </div>

          {useCustomClient ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="First name *"
                  value={customFirstName}
                  onChange={(e) => setCustomFirstName(e.target.value)}
                />
                <Input
                  placeholder="Last name"
                  value={customLastName}
                  onChange={(e) => setCustomLastName(e.target.value)}
                />
              </div>
              <Input
                placeholder="Email"
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Phone"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                />
                <Input
                  placeholder="Company"
                  value={customCompany}
                  onChange={(e) => setCustomCompany(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedContact ? contactLabel(selectedContact) : "Search clients..."}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name, email, phone, or company..."
                    value={clientSearch}
                    onValueChange={setClientSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searchLoading ? "Searching..." : "No client found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {searchResults.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.id}
                          onSelect={() => {
                            setContactId(c.id);
                            setClientOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              contactId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <p className="text-sm">{c.first_name} {c.last_name ?? ""}</p>
                            {c.company_name && (
                              <p className="text-xs text-muted-foreground">{c.company_name}</p>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* GST & State */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Client GST Number</Label>
            <Input
              placeholder="e.g. 29XXXXX"
              value={clientGst}
              onChange={(e) => setClientGst(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client State</Label>
            <Select value={clientState} onValueChange={setClientState}>
              <SelectTrigger>
                <SelectValue placeholder="Select state..." />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Invoice Date</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GST Rate (%)</Label>
            <Select value={String(gstRate)} onValueChange={(v) => setGstRate(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0% (No GST)</SelectItem>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="12">12%</SelectItem>
                <SelectItem value="18">18%</SelectItem>
                <SelectItem value="28">28%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* GST Inclusive + Already Paid */}
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="gst-inclusive"
              checked={gstInclusive}
              onCheckedChange={(checked) => setGstInclusive(checked === true)}
            />
            <Label htmlFor="gst-inclusive" className="text-sm font-normal cursor-pointer">
              Price includes GST
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="already-paid"
              checked={alreadyPaid}
              onCheckedChange={(checked) => setAlreadyPaid(checked === true)}
            />
            <Label htmlFor="already-paid" className="text-sm font-normal cursor-pointer">
              Already paid
            </Label>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3">
          <Label>Line Items</Label>
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-3 text-right">Rate (₹){gstInclusive ? " incl. GST" : ""}</div>
            <div className="col-span-1 text-right">Amt</div>
            <div className="col-span-1" />
          </div>
          {items.map((item, i) => (
            <LineItemRow
              key={i}
              item={item}
              index={i}
              onChange={handleItemChange}
              onRemove={removeItem}
              canRemove={items.length > 1}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="mt-1"
          >
            <Plus className="mr-1.5 size-3.5" />
            Add Item
          </Button>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea
            placeholder="Payment terms, thank you message, etc."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Payment Schedule (Installments) */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="split-installments"
              checked={hasInstallments}
              onCheckedChange={(checked) => {
                const on = checked === true;
                setHasInstallments(on);
                if (on && installments.length === 0) {
                  autoFillInstallments(installmentCount, gst.total, dueDate);
                }
              }}
            />
            <Label htmlFor="split-installments" className="text-sm font-normal cursor-pointer">
              Split into installments
            </Label>
          </div>

          {hasInstallments && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-xs whitespace-nowrap">Number of installments</Label>
                <Select
                  value={String(installmentCount)}
                  onValueChange={(v) => {
                    const count = Number(v);
                    setInstallmentCount(count);
                    autoFillInstallments(count, gst.total, dueDate);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={() => autoFillInstallments(installmentCount, gst.total, dueDate)}
                >
                  Auto-fill
                </Button>
              </div>

              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-2">#</div>
                <div className="col-span-5">Amount (₹)</div>
                <div className="col-span-5">Due Date</div>
              </div>
              {installments.map((inst, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2 text-sm text-muted-foreground">{inst.installment_number}</div>
                  <div className="col-span-5">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={inst.amount || ""}
                      onChange={(e) => {
                        const updated = [...installments];
                        updated[i] = { ...updated[i], amount: parseFloat(e.target.value) || 0 };
                        setInstallments(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-5">
                    <Input
                      type="date"
                      value={inst.due_date}
                      onChange={(e) => {
                        const updated = [...installments];
                        updated[i] = { ...updated[i], due_date: e.target.value };
                        setInstallments(updated);
                      }}
                    />
                  </div>
                </div>
              ))}

              {installmentMismatch && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="size-3.5" />
                  Installment total ({formatCurrency(installmentSum)}) does not match invoice total ({formatCurrency(gst.total)})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Link Option */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-payment-link"
            checked={includePaymentLink}
            onCheckedChange={(checked) => setIncludePaymentLink(checked === true)}
          />
          <Label htmlFor="include-payment-link" className="text-sm font-normal cursor-pointer">
            Include payment link when sending
          </Label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving}
            variant="outline"
          >
            <Save className="mr-1.5 size-4" />
            {alreadyPaid ? "Save as Paid" : isEdit ? "Update" : "Save Draft"}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Send className="mr-1.5 size-4" />
            {alreadyPaid ? "Save & Send Receipt" : isEdit ? "Update & Send" : "Save & Send"}
          </Button>
        </div>
      </div>

      {/* Right Panel: Live Preview */}
      <div className="hidden lg:block sticky top-20">
        <p className="text-xs font-medium text-muted-foreground mb-3">LIVE PREVIEW</p>
        <InvoicePreview
          invoiceNumber=""
          clientName={clientName}
          clientEmail={clientEmailDisplay}
          clientPhone={clientPhoneDisplay}
          clientCompany={clientCompanyDisplay}
          clientGst={clientGst}
          clientState={clientState}
          items={effectiveItems}
          gst={gst}
          dueDate={dueDate}
          notes={notes}
          createdAt={invoiceDate}
        />
      </div>
    </div>
  );
}
