import { NextRequest } from "next/server";
import { processTranscription, TranscriptionError } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resultPage(transcriptTarget: string, transcriptEnglish: string, summaryTarget: string, summaryEnglish: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VoiceSnap — Result</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Inter", sans-serif;
    background: #0B0E14;
    color: #fff;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    padding: 4rem 1rem;
  }
  .container { width: 100%; max-width: 640px; }
  h1 {
    font-family: "Space Grotesk", sans-serif;
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    text-align: center;
  }
  .accent { color: #FF7A00; }
  .card {
    background: #131720;
    border: 1px solid #232838;
    border-radius: 1rem;
    padding: 1.5rem;
    margin-bottom: 1.25rem;
  }
  .card-label {
    font-family: "Space Grotesk", sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .card-label svg { color: #FF7A00; flex-shrink: 0; }
  .text-block {
    font-size: 0.875rem;
    line-height: 1.65;
    color: #9CA3AF;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .text-block.transcript { color: rgba(255,255,255,0.9); }
  .section-title {
    font-family: "Space Grotesk", sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9CA3AF;
    margin-bottom: 0.5rem;
    margin-top: 1.25rem;
  }
  .section-title:first-child { margin-top: 0; }
  a.back {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 1.5rem;
    padding: 0.625rem 1.25rem;
    background: #FF7A00;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.75rem;
    text-decoration: none;
    transition: background 0.15s;
  }
  a.back:hover { background: #ff8c1f; }
  .center { text-align: center; }
</style>
</head>
<body>
<div class="container">
  <h1>Voice<span class="accent">Snap</span> — Result</h1>

  <div class="card">
    <div class="section-title">Summary</div>
    <div class="card-label">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v.01"/><path d="M18.5 8.5c.6-.6 1.5-.6 2.1 0 .6.6.6 1.5 0 2.1l-6.8 6.8a2.1 2.1 0 0 1-3 0l-6.8-6.8a2.1 2.1 0 0 1 0-3c.6-.6 1.5-.6 2.1 0L8.5 10"/><circle cx="12" cy="12" r="2"/></svg>
      Target language
    </div>
    <div class="text-block">${escapeHtml(summaryTarget)}</div>

    <div class="section-title">English</div>
    <div class="card-label">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      English
    </div>
    <div class="text-block">${escapeHtml(summaryEnglish)}</div>
  </div>

  <div class="card">
    <div class="section-title">Full Transcript</div>
    <div class="card-label">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/></svg>
      Target language
    </div>
    <div class="text-block transcript">${escapeHtml(transcriptTarget)}</div>

    <div class="section-title">English</div>
    <div class="card-label">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      English
    </div>
    <div class="text-block transcript">${escapeHtml(transcriptEnglish)}</div>
  </div>

  <div class="center">
    <a class="back" href="/">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
      Back to VoiceSnap
    </a>
  </div>
</div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VoiceSnap — Error</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Inter", sans-serif;
    background: #0B0E14;
    color: #fff;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
  }
  .container { width: 100%; max-width: 480px; text-align: center; }
  h1 {
    font-family: "Space Grotesk", sans-serif;
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 1.25rem;
  }
  .accent { color: #FF7A00; }
  .error-card {
    background: #131720;
    border: 1px solid #2A1616;
    border-radius: 1rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .error-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: rgba(239,68,68,0.12);
    margin-bottom: 1rem;
  }
  .error-icon svg { color: #EF4444; }
  .error-msg {
    font-size: 0.9rem;
    line-height: 1.6;
    color: #F5B0A8;
  }
  a.back {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1.25rem;
    background: #FF7A00;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.75rem;
    text-decoration: none;
    transition: background 0.15s;
  }
  a.back:hover { background: #ff8c1f; }
</style>
</head>
<body>
<div class="container">
  <h1>Voice<span class="accent">Snap</span></h1>
  <div class="error-card">
    <div class="error-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <p class="error-msg">${escapeHtml(message)}</p>
  </div>
  <a class="back" href="/">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
    Back to VoiceSnap
  </a>
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const formData = await req.formData();
    const result = await processTranscription(formData, ip);

    return new Response(
      resultPage(
        result.transcript_target,
        result.transcript_english,
        result.summary_target,
        result.summary_english,
      ),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  } catch (err) {
    const message =
      err instanceof TranscriptionError
        ? err.message
        : "Something went wrong on our end. Please try again.";
    const status = err instanceof TranscriptionError ? err.status : 500;

    return new Response(errorPage(message), {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
