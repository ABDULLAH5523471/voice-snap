import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Node runtime — we need full FormData/Buffer support for audio uploads,
// and requests to Groq can take a few seconds.
export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_API_URL = "https://api.groq.com/openai/v1";

// Groq's fastest Whisper model, available on the free tier.
const WHISPER_MODEL = "whisper-large-v3-turbo";

// Groq-hosted Llama 3 model used for the summarization step.
const SUMMARY_MODEL = "llama-3.3-70b-versatile";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTENSIONS = ["mp3", "wav", "ogg", "m4a"];
const ALLOWED_LANGS: Record<string, string> = {
  hi: "Hindi",
  ur: "Urdu",
  rur: "Roman Urdu (Urdu written in English/Latin script)",
  rhi: "Roman Hindi (Hindi written in English/Latin script)",
  pa: "Punjabi",
  rpa: "Roman Punjabi (Punjabi written in English/Latin script)",
  en: "English",
};

// -- Rate Limiting Setup ----------------------------------------------------

let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    analytics: true,
  });
} else {
  console.warn("Upstash Redis environment variables are missing. Rate limiting is disabled.");
}

export async function POST(req: NextRequest) {
  try {
    // -- Rate Limiting Check ------------------------------------------------
    if (ratelimit) {
      const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success } = await ratelimit.limit(ip);
      
      if (!success) {
        return NextResponse.json(
          { error: "You've reached your daily limit of 5 transcriptions. Try again tomorrow." },
          { status: 429 }
        );
      }
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing GROQ_API_KEY. Add it to .env.local and restart the dev server." },
        { status: 500 }
      );
    }

    // -- Parse & validate the incoming file ---------------------------------

    const formData = await req.formData();
    const file = formData.get("file");
    const langCode = (formData.get("lang") as string) || "hi";
    const summaryLang = ALLOWED_LANGS[langCode] || "Hindi";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No audio file was provided." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type ".${ext}". Supported: ${ALLOWED_EXTENSIONS.join(", ")}.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File is too large. Max size is 25MB." }, { status: 400 });
    }

    // -- Step 1: Transcribe with Groq Whisper Large V3 Turbo -----------------

    const whisperForm = new FormData();
    whisperForm.append("file", file, file.name);
    whisperForm.append("model", WHISPER_MODEL);
    whisperForm.append("response_format", "json");

    const transcriptionRes = await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!transcriptionRes.ok) {
      const errText = await transcriptionRes.text();
      console.error("Groq transcription error:", transcriptionRes.status, errText);

      if (transcriptionRes.status === 401) {
        return NextResponse.json(
          { error: "Groq rejected the API key. Double-check GROQ_API_KEY in .env.local." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Transcription failed. Please try a different audio file." },
        { status: 502 }
      );
    }

    const transcriptionData = await transcriptionRes.json();
    const transcript: string = (transcriptionData.text ?? "").trim();

    if (!transcript) {
      return NextResponse.json(
        { error: "Couldn't detect any speech in that file. Try a clearer recording." },
        { status: 422 }
      );
    }

    // -- Step 2: Summarize with Llama 3 --------------------------------------

    const summaryRes = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        temperature: 0.2, // Lower temp for more accurate transcript correction
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert audio transcription cleaner and translator. You will receive a raw, potentially messy voice transcription. Your job is to:
1. Fix any misheard words, correct the grammar, and structure it into clear, readable text that perfectly captures the speaker's intent. Do not summarize the transcript here, just clean it up.
2. Provide the cleaned transcript in ${summaryLang}.
3. Provide the cleaned transcript translated to English.
4. Write a 1-3 sentence concise summary of the transcript in ${summaryLang}.
5. Write a 1-3 sentence concise summary of the transcript in English.

You must respond ONLY with a valid JSON object matching exactly this schema:
{
  "transcript_target": "Cleaned transcript in ${summaryLang}",
  "transcript_english": "Cleaned transcript in English",
  "summary_target": "Summary in ${summaryLang}",
  "summary_english": "Summary in English"
}`
          },
          { role: "user", content: transcript },
        ],
      }),
    });

    if (!summaryRes.ok) {
      const errText = await summaryRes.text();
      console.error("Groq summary error:", summaryRes.status, errText);
      return NextResponse.json(
        { error: "Transcription succeeded, but the processing failed. Please try again." },
        { status: 502 }
      );
    }

    const summaryData = await summaryRes.json();
    const content = summaryData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content returned from LLM");
    }

    const parsedContent = JSON.parse(content);

    // Return the structured object
    return NextResponse.json({
      transcript_target: parsedContent.transcript_target || "",
      transcript_english: parsedContent.transcript_english || "",
      summary_target: parsedContent.summary_target || "",
      summary_english: parsedContent.summary_english || "",
    });
  } catch (err) {
    console.error("Unexpected error in /api/transcribe:", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
}
