import { NextResponse } from "next/server";
import { getTemplates, sendTemplate } from "@/lib/whatsapp/client";

export async function GET(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "templates";

  if (action === "templates") {
    const result = await getTemplates();
    return NextResponse.json(result);
  }

  if (action === "phones") {
    const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!;
    const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${WABA_ID}/phone_numbers`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );
    const data = await res.json();
    return NextResponse.json(data);
  }

  if (action === "send") {
    const to = searchParams.get("to");
    const template = searchParams.get("template");
    if (!to || !template) {
      return NextResponse.json({ error: "Missing ?to=&template=" }, { status: 400 });
    }
    const params = searchParams.get("params")?.split(",") ?? [];
    const result = await sendTemplate(to, template, params);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
