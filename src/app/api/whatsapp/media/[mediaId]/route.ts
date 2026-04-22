import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const BASE_URL = "https://graph.facebook.com/v21.0";

/**
 * Proxy to fetch WhatsApp media files.
 * Meta requires the access token to retrieve media URLs and download them,
 * so we proxy through our server to avoid exposing the token to the client.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;

  try {
    // Step 1: Get the media URL from Meta
    const metaRes = await fetch(`${BASE_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    if (!metaRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch media metadata" },
        { status: metaRes.status }
      );
    }

    const metaData = await metaRes.json();
    const mediaUrl = metaData.url;

    if (!mediaUrl) {
      return NextResponse.json(
        { error: "No media URL returned" },
        { status: 404 }
      );
    }

    // Step 2: Download the actual file from Meta's CDN
    const fileRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    if (!fileRes.ok) {
      return NextResponse.json(
        { error: "Failed to download media" },
        { status: fileRes.status }
      );
    }

    const contentType =
      fileRes.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await fileRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[WA Media Proxy] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
