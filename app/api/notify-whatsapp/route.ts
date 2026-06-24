import { NextRequest, NextResponse } from "next/server";
import { sendPortalOrderWhatsApp, type PortalOrderNotifyPayload } from "@/lib/utils/whatsapp-notify";

export async function POST(request: NextRequest) {
  let payload: PortalOrderNotifyPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  await sendPortalOrderWhatsApp(payload);

  return NextResponse.json({ ok: true });
}
