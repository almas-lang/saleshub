"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { InvoiceLineItem } from "@/types/invoices";

interface LineItemRowProps {
  item: InvoiceLineItem;
  index: number;
  onChange: (index: number, field: keyof InvoiceLineItem, value: string | number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function LineItemRow({ item, index, onChange, onRemove, canRemove }: LineItemRowProps) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-6">
        <Input
          placeholder="Description"
          value={item.description}
          onChange={(e) => onChange(index, "description", e.target.value)}
        />
      </div>
      <div className="col-span-1">
        <Input
          type="number"
          min={1}
          value={item.qty}
          onChange={(e) => onChange(index, "qty", parseInt(e.target.value) || 0)}
          className="text-right"
        />
      </div>
      <div className="col-span-3">
        <Input
          type="number"
          min={0}
          value={item.rate}
          onChange={(e) => onChange(index, "rate", parseFloat(e.target.value) || 0)}
          className="text-right"
        />
      </div>
      <div className="col-span-1 text-right text-sm font-medium tabular-nums pr-1">
        {item.amount.toLocaleString("en-IN")}
      </div>
      <div className="col-span-1 flex justify-end">
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
