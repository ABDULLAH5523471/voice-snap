"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileAudio,
  Mic,
  Copy,
  Check,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Loader2,
  Globe,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = ["mp3", "wav", "ogg", "m4a"] as const;
const MAX_FILE_SIZE_MB = 25;

const LANGUAGES = [
  { code: "hi", label: "हिन्दी", name: "Hindi" },
  { code: "ur", label: "اردو", name: "Urdu" },
  { code: "rur", label: "Roman Urdu", name: "Roman Urdu" },
  { code: "rhi", label: "Roman Hindi", name: "Roman Hindi" },
  { code: "pa", label: "ਪੰਜਾਬੀ", name: "Punjabi" },
  { code: "rpa", label: "Roman Punjabi", name: "Roman Punjabi" },
  { code: "en", label: "EN", name: "English" },
] as const;

type SummaryLang = (typeof LANGUAGES)[number]["code"];
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

type Status = "idle" | "transcribing" | "summarizing" | "done" | "error";

interface TranscribeResponse {
  transcript_target: string;
  transcript_english: string;
  summary_target: string;
  summary_english: string;
}

// ---------------------------------------------------------------------------
// Owner-bypass cookie helpers (invisible to normal visitors)
// ---------------------------------------------------------------------------

function getOwnerToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)owner_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setOwnerToken(token: string) {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `owner_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// Waveform — idle in the hero, agitated while dragging or processing
// ---------------------------------------------------------------------------

function Waveform({
  bars = 48,
  active = false,
  className = "",
}: {
  bars?: number;
  active?: boolean;
  className?: string;
}) {
  // Deterministic pseudo-random heights so the shape looks organic but stays stable across renders.
  const heights = Array.from({ length: bars }, (_, i) => {
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const frac = seed - Math.floor(seed);
    return 20 + frac * 80; // 20% - 100%
  });

  return (
    <div className={`flex items-center justify-center gap-[3px] ${className}`} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-[#FF7A00]"
          style={{
            height: `${h}%`,
            opacity: active ? 0.9 : 0.35,
            animation: `wave ${active ? "0.7s" : "2.4s"} ease-in-out infinite`,
            animationDelay: `${(i % 12) * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clipboard hook — tracks which button just copied, so each can show its own tick
// ---------------------------------------------------------------------------

function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    } catch {
      // Clipboard API can fail in insecure contexts (non-HTTPS) or if permission is denied.
      // Fail silently here rather than surfacing a disruptive error for a low-stakes action.
    }
  }, []);

  return { copiedKey, copy };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TranscribeResponse | null>(null);
  const [summaryLang, setSummaryLang] = useState<SummaryLang>("hi");
  const [viewLang, setViewLang] = useState<"target" | "en">("target");

  const inputRef = useRef<HTMLInputElement>(null);
  const { copiedKey, copy } = useCopyToClipboard();

  const isProcessing = status === "transcribing" || status === "summarizing";

  // Capture ?owner=<token> from URL, persist to cookie, then remove from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("owner");
    if (token) {
      setOwnerToken(token);
      params.delete("owner");
      const clean = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  // -- Validation ----------------------------------------------------------

  const validateFile = (candidate: File): string | null => {
    const ext = candidate.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension)) {
      return `Unsupported format ".${ext}". Use ${SUPPORTED_EXTENSIONS.join(", ")}.`;
    }
    if (candidate.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `That file is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = useCallback((candidate: File) => {
    const validationError = validateFile(candidate);
    if (validationError) {
      setErrorMsg(validationError);
      setStatus("error");
      setFile(null);
      return;
    }
    setErrorMsg(null);
    setStatus("idle");
    setResult(null);
    setFile(candidate);
  }, []);

  // -- Drag & drop handlers -------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
    },
    [handleFile]
  );

  // -- Transcription ---------------------------------------------------------
  // A single request does both steps server-side. We advance the displayed
  // phase from "Transcribing…" to "Summarizing…" after a short delay so the
  // loading state reflects what's actually happening, without needing a
  // streaming response.

  const handleTranscribe = async () => {
    if (!file) return;
    setStatus("transcribing");
    setErrorMsg(null);
    setResult(null);

    const phaseTimer = setTimeout(() => {
      setStatus((current) => (current === "transcribing" ? "summarizing" : current));
    }, 2500);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lang", summaryLang);

      const headers: Record<string, string> = {};
      const ownerToken = getOwnerToken();
      if (ownerToken) headers["x-owner-token"] = ownerToken;

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Something went wrong while transcribing that file.");
      }

      setResult(data as TranscribeResponse);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error. Please try again.");
      setStatus("error");
    } finally {
      clearTimeout(phaseTimer);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setStatus("idle");
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0B0E14] px-4 py-16 sm:px-6">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl border border-[#232838] bg-[#0B0E14] p-6 sm:p-10">
          {/* ----------------------------------------------------------- */}
          {/* Upload / hero view                                           */}
          {/* ----------------------------------------------------------- */}
          {status !== "done" && (
            <>
              {/* Logo */}
              <div className="mb-8 flex justify-center">
                <img src="/logo.svg" alt="VoiceSnap Logo" className="w-[230px] h-[60px] object-contain" />
              </div>

              {/* Badge */}
              <div className="mb-6 flex justify-center">
                <div className="flex items-center gap-1.5 rounded-full border border-[#232838] bg-[#131720] px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-[#9CA3AF]">
                  <Mic className="h-3 w-3 text-[#FF7A00]" strokeWidth={2} />
                  VOICE &rarr; TEXT, INSTANTLY
                </div>
              </div>

              {/* Hero */}
              <h1
                className="text-center text-4xl font-bold tracking-tight text-white sm:text-5xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                VoiceSnap
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-center text-sm text-[#9CA3AF] sm:text-base">
                Transcribe &amp; Summarize Voice Messages in Seconds.
              </p>

              {/* Dropzone */}
              <label
                htmlFor="file-input"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-10 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 ${isDragging
                  ? "scale-[1.01] border-[#FF7A00] bg-[#FF7A00]/5"
                  : "border-[#232838] bg-[#131720] hover:border-[#FF7A00]/50 hover:bg-[#161b26]"
                  }`}
              >
                <input
                  id="file-input"
                  ref={inputRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a,audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />

                <Waveform bars={28} active={isDragging} className="mb-5 h-9" />

                {file ? (
                  <>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#FF7A00]/40 bg-[#FF7A00]/10">
                      <FileAudio className="h-5 w-5 text-[#FF7A00]" strokeWidth={1.75} />
                    </div>
                    <p className="truncate px-2 font-mono text-sm text-white">{file.name}</p>
                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB &middot; ready to transcribe
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#232838] bg-[#0B0E14]">
                      <Upload className="h-5 w-5 text-[#9CA3AF]" strokeWidth={1.75} />
                    </div>
                    <p className="text-sm text-white">Drag &amp; drop a voice message</p>
                    <p className="mt-1 text-xs text-[#9CA3AF]">or click to browse your files</p>
                  </>
                )}
              </label>

              {/* Summary language selector */}
              <div className="mt-5 flex items-center justify-center gap-2">
                <Globe className="h-3.5 w-3.5 text-[#9CA3AF]" strokeWidth={1.75} />
                <span className="text-xs text-[#9CA3AF]">Summary in</span>
                <div className="flex items-center gap-1 rounded-lg border border-[#232838] bg-[#131720] p-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setSummaryLang(lang.code)}
                      disabled={isProcessing}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${summaryLang === lang.code
                        ? "bg-[#FF7A00] text-white shadow-sm"
                        : "text-[#9CA3AF] hover:text-white"
                        } disabled:pointer-events-none`}
                      title={lang.name}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary action button */}
              <button
                type="button"
                onClick={() => (file ? handleTranscribe() : inputRef.current?.click())}
                disabled={isProcessing}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF7A00] px-6 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#ff8c1f] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70 sm:mx-auto sm:w-auto sm:min-w-[260px]"
              >
                {status === "transcribing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin-slow" strokeWidth={2.25} />
                    Transcribing&hellip;
                  </>
                ) : status === "summarizing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin-slow" strokeWidth={2.25} />
                    Summarizing&hellip;
                  </>
                ) : file ? (
                  <>
                    <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                    Transcribe &amp; Summarize
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" strokeWidth={2.25} />
                    Upload Voice Message
                  </>
                )}
              </button>

              {file && !isProcessing && (
                <button
                  type="button"
                  onClick={reset}
                  className="mx-auto mt-3 flex items-center gap-1.5 text-xs text-[#9CA3AF] transition-colors hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={2} />
                  Choose a different file
                </button>
              )}

              {/* Error banner */}
              {status === "error" && errorMsg && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#4A2A2A] bg-[#2A1616] px-4 py-3 text-sm text-[#F5B0A8]">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Supported formats */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-[#9CA3AF]">Supports</span>
                {SUPPORTED_EXTENSIONS.map((format) => (
                  <span
                    key={format}
                    className="rounded-md border border-[#232838] bg-[#131720] px-2 py-0.5 font-mono text-xs uppercase text-[#FF7A00]"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* ----------------------------------------------------------- */}
          {/* Result view                                                  */}
          {/* ----------------------------------------------------------- */}
          {status === "done" && result && (
            <div className="w-full text-left">
              {/* File chip + reset */}
              <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#232838] bg-[#131720] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileAudio className="h-4 w-4 flex-shrink-0 text-[#FF7A00]" strokeWidth={1.75} />
                  <span className="truncate font-mono text-xs text-[#9CA3AF]">{file?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#232838] px-3 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#FF7A00]/50 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" strokeWidth={2} />
                    Try Another File
                  </button>
                </div>
              </div>

              {/* Language View Toggle */}
              <div className="mb-6 flex justify-center">
                <div className="flex items-center rounded-lg border border-[#232838] bg-[#131720] p-1">
                  <button
                    type="button"
                    onClick={() => setViewLang("target")}
                    className={`rounded-md px-6 py-2 text-sm font-medium transition-all duration-150 ${viewLang === "target"
                      ? "bg-[#FF7A00] text-white shadow-sm"
                      : "text-[#9CA3AF] hover:text-white"
                      }`}
                  >
                    {LANGUAGES.find(l => l.code === summaryLang)?.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewLang("en")}
                    className={`rounded-md px-6 py-2 text-sm font-medium transition-all duration-150 ${viewLang === "en"
                      ? "bg-[#FF7A00] text-white shadow-sm"
                      : "text-[#9CA3AF] hover:text-white"
                      }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Summary card */}
              <section className="mb-5 rounded-2xl border border-[#232838] bg-[#131720] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2
                    className="flex items-center gap-2 text-lg font-semibold text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    <Sparkles className="h-4.5 w-4.5 text-[#FF7A00]" strokeWidth={2} />
                    Summary
                  </h2>
                  <button
                    type="button"
                    onClick={() => copy(viewLang === "target" ? result.summary_target : result.summary_english, "summary")}
                    className="flex items-center gap-1.5 rounded-lg border border-[#232838] px-3 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#FF7A00]/50 hover:text-white"
                  >
                    {copiedKey === "summary" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#FF7A00]" strokeWidth={2} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-[#9CA3AF]">
                  {viewLang === "target" ? result.summary_target : result.summary_english}
                </p>
              </section>

              {/* Transcript card */}
              <section className="rounded-2xl border border-[#232838] bg-[#131720] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2
                    className="text-lg font-semibold text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Transcript
                  </h2>
                  <button
                    type="button"
                    onClick={() => copy(viewLang === "target" ? result.transcript_target : result.transcript_english, "transcript")}
                    className="flex items-center gap-1.5 rounded-lg border border-[#232838] px-3 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#FF7A00]/50 hover:text-white"
                  >
                    {copiedKey === "transcript" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#FF7A00]" strokeWidth={2} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="custom-scrollbar max-h-72 overflow-y-auto pr-2 text-sm leading-relaxed text-white/90">
                  {viewLang === "target" ? result.transcript_target : result.transcript_english}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
