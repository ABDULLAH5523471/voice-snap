import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const WHISPER_MODEL = "whisper-large-v3-turbo";
const SUMMARY_MODEL = "llama-3.3-70b-versatile";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "opus"];
const ALLOWED_LANGS: Record<string, string> = {
  hi: "Hindi",
  ur: "Urdu",
  rur: "Roman Urdu (Urdu written in English/Latin script)",
  rhi: "Roman Hindi (Hindi written in English/Latin script)",
  pa: "Punjabi",
  rpa: "Roman Punjabi (Punjabi written in English/Latin script)",
  en: "English",
};

// -- Rate Limiting -----------------------------------------------------------

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

// -- Types -------------------------------------------------------------------

export interface TranscribeResult {
  transcript_target: string;
  transcript_english: string;
  summary_target: string;
  summary_english: string;
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

// -- Shared logic ------------------------------------------------------------

export async function processTranscription(
  formData: FormData,
  ip: string,
): Promise<TranscribeResult> {
  // Rate limit
  if (ratelimit) {
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      throw new TranscriptionError(
        "You've reached your daily limit of 5 transcriptions. Try again tomorrow.",
        429,
      );
    }
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new TranscriptionError(
      "Server is missing GROQ_API_KEY. Add it to .env.local and restart the dev server.",
      500,
    );
  }

  // Parse & validate
  const file = formData.get("file");
  const langCode = (formData.get("lang") as string) || "hi";
  const summaryLang = ALLOWED_LANGS[langCode] || "Hindi";

  if (!file || !(file instanceof File)) {
    throw new TranscriptionError("No audio file was provided.", 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new TranscriptionError(
      `Unsupported file type ".${ext}". Supported: ${ALLOWED_EXTENSIONS.join(", ")}.`,
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new TranscriptionError("File is too large. Max size is 25MB.", 400);
  }

  // Step 1: Transcribe
  const whisperForm = new FormData();
  const groqFilename = ext === "opus" ? file.name.replace(/\.opus$/i, ".ogg") : file.name;
  whisperForm.append("file", file, groqFilename);
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
      throw new TranscriptionError(
        "Groq rejected the API key. Double-check GROQ_API_KEY in .env.local.",
        500,
      );
    }
    throw new TranscriptionError(
      "Transcription failed. Please try a different audio file.",
      502,
    );
  }

  const transcriptionData = await transcriptionRes.json();
  const transcript: string = (transcriptionData.text ?? "").trim();

  if (!transcript) {
    throw new TranscriptionError(
      "Couldn't detect any speech in that file. Try a clearer recording.",
      422,
    );
  }

  // Step 2: Summarize
  const summaryRes = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      temperature: 0.2,
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
}`,
        },
        { role: "user", content: transcript },
      ],
    }),
  });

  if (!summaryRes.ok) {
    const errText = await summaryRes.text();
    console.error("Groq summary error:", summaryRes.status, errText);
    throw new TranscriptionError(
      "Transcription succeeded, but the processing failed. Please try again.",
      502,
    );
  }

  const summaryData = await summaryRes.json();
  const content = summaryData.choices?.[0]?.message?.content;

  if (!content) {
    throw new TranscriptionError(
      "Transcription succeeded, but the processing failed. Please try again.",
      502,
    );
  }

  const parsedContent = JSON.parse(content);

  return {
    transcript_target: parsedContent.transcript_target || "",
    transcript_english: parsedContent.transcript_english || "",
    summary_target: parsedContent.summary_target || "",
    summary_english: parsedContent.summary_english || "",
  };
}
