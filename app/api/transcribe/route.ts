import { NextRequest, NextResponse } from "next/server";
import { processTranscription, TranscriptionError } from "@/lib/transcribe";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const ownerToken = req.headers.get("x-owner-token") ?? req.cookies.get("owner_token")?.value ?? undefined;

    let isPro = false;
    try {
      const session = await auth();
      if (session.userId) {
        const client = await clerkClient();
        const user = await client.users.getUser(session.userId);
        isPro = user.publicMetadata?.subscription_status === "active";
      }
    } catch {
      // Clerk unavailable — default to non-Pro, don't block transcription
    }

    const formData = await req.formData();
    const result = await processTranscription(formData, ip, ownerToken, isPro);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TranscriptionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Unexpected error in /api/transcribe:", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 },
    );
  }
}
