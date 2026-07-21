import { NextRequest } from "next/server";
import { ALLOWED_LANGS } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LANGUAGE_LABELS: Record<string, string> = {
  hi: "हिन्दी",
  ur: "اردو",
  rur: "Roman Urdu",
  rhi: "Roman Hindi",
  pa: "ਪੰਜਾਬੀ",
  rpa: "Roman Punjabi",
  en: "English",
};

function languagePickerPage(
  fileName: string,
  base64Data: string,
): string {
  const buttons = Object.entries(ALLOWED_LANGS)
    .map(([code]) => {
      const label = LANGUAGE_LABELS[code] || code;
      return `
      <form method="POST" action="/share-target/process" style="width:100%">
        <input type="hidden" name="fileData" value="${escapeHtml(base64Data)}">
        <input type="hidden" name="fileName" value="${escapeHtml(fileName)}">
        <input type="hidden" name="lang" value="${escapeHtml(code)}">
        <button type="submit" class="lang-btn">
          <span class="lang-label">${escapeHtml(label)}</span>
          <span class="lang-name">${escapeHtml(ALLOWED_LANGS[code])}</span>
        </button>
      </form>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VoiceSnap — Choose Language</title>
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
    padding: 4rem 1rem;
  }
  .container { width: 100%; max-width: 420px; }
  h1 {
    font-family: "Space Grotesk", sans-serif;
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    text-align: center;
  }
  .accent { color: #FF7A00; }
  .subtitle {
    text-align: center;
    font-size: 0.875rem;
    color: #9CA3AF;
    margin-bottom: 1.5rem;
  }
  .file-card {
    background: #131720;
    border: 1px solid #232838;
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .file-icon {
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    background: rgba(255, 122, 0, 0.1);
    border: 1px solid rgba(255, 122, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FF7A00;
  }
  .file-name {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.8rem;
    color: #fff;
    word-break: break-all;
  }
  .file-hint {
    font-size: 0.7rem;
    color: #9CA3AF;
    margin-top: 0.25rem;
  }
  .section-title {
    font-family: "Space Grotesk", sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9CA3AF;
    margin-bottom: 0.75rem;
    text-align: center;
  }
  .lang-grid {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .lang-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #131720;
    border: 1px solid #232838;
    border-radius: 0.875rem;
    padding: 0.875rem 1.25rem;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }
  .lang-btn:hover {
    border-color: #FF7A00;
    background: #161b26;
  }
  .lang-btn:active {
    transform: scale(0.98);
  }
  .lang-label {
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
  }
  .lang-name {
    font-size: 0.75rem;
    color: #9CA3AF;
  }
</style>
</head>
<body>
<div class="container">
  <h1>Voice<span class="accent">Snap</span></h1>
  <p class="subtitle">Choose a language for transcription &amp; summary.</p>

  <div class="file-card">
    <div class="file-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v.01"/><path d="M18.5 8.5c.6-.6 1.5-.6 2.1 0 .6.6.6 1.5 0 2.1l-6.8 6.8a2.1 2.1 0 0 1-3 0l-6.8-6.8a2.1 2.1 0 0 1 0-3c.6-.6 1.5-.6 2.1 0L8.5 10"/><circle cx="12" cy="12" r="2"/></svg>
    </div>
    <div>
      <div class="file-name">${escapeHtml(fileName)}</div>
      <div class="file-hint">Voice message ready to transcribe</div>
    </div>
  </div>

  <div class="section-title">Summary language</div>

  <div class="lang-grid">
    ${buttons}
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
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(errorPage("No audio file was provided."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return new Response(
      languagePickerPage(file.name, base64),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  } catch {
    return new Response(
      errorPage("Something went wrong on our end. Please try again."),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}
