import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, and SVG files are allowed" },
      { status: 400 }
    );
  }

  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 2 MB" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() ?? "png";
  const fileName = `logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(fileName);

  return NextResponse.json({ url: publicUrl });
}
