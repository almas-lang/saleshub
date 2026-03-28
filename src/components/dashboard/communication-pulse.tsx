"use client";

import Link from "next/link";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { format } from "date-fns";
import { MessageCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CommunicationPulse } from "@/types/dashboard";

interface CommunicationPulseProps {
  data: CommunicationPulse[];
}

export function CommunicationPulseCard({ data }: CommunicationPulseProps) {
  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.wa + d.email, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Communication Pulse</CardTitle>
          <span className="text-xs text-muted-foreground">
            {total} messages (7d)
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
          <Link href="/whatsapp">
            View all
            <ArrowRight className="ml-1 size-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9 }}
              tickFormatter={(d) => format(new Date(d), "EEE")}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => [value, name === "wa" ? "WhatsApp" : "Email"]}
              labelFormatter={(d) => format(new Date(d), "dd MMM")}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--card))",
                fontSize: "11px",
              }}
            />
            <Bar dataKey="wa" stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="email" stackId="a" fill="#3B82F6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
