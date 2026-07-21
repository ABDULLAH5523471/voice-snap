import { NextRequest, NextResponse } from "next/server";
import { processTranscription, TranscriptionError } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const formData = await req.formData();
    const result = await processTranscription(formData, ip);
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
