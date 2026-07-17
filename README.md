# VoiceSnap

**Transcribe & Summarize Voice Messages in Seconds.**

Drop in a voice message and get back a clean transcript plus a short AI-generated summary, powered by Groq's Whisper Large V3 Turbo and Llama 3.

## Overview

VoiceSnap is a single-page Next.js app. You upload (or drag and drop) an audio file, it's sent to a server route that transcribes it with Groq's Whisper model and then summarizes the transcript with Llama 3, and the result is displayed with one-click copy buttons for both the transcript and the summary.

- **Frontend:** `app/page.tsx` — upload UI, drag & drop, validation, loading states, results view
- **Backend:** `app/api/transcribe/route.ts` — accepts the uploaded file, calls Groq, returns `{ transcript, summary }`

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript
- Tailwind CSS v4
- lucide-react
- Groq API (Whisper Large V3 Turbo + Llama 3)

## Installation

```bash
npm install
```

## Environment Variable Setup

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and set your Groq API key (get one at [console.groq.com/keys](https://console.groq.com/keys)):

```
GROQ_API_KEY=YOUR_API_KEY
```

`.env.local` is git-ignored — never commit your real key. Only `.env.local.example` should be committed.

## Running the Project

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build Instructions

```bash
npm run build
npm run start
```

## Groq API Setup

1. Create a free account at [console.groq.com](https://console.groq.com).
2. Go to **API Keys** and generate a new key.
3. Paste it into `.env.local` as `GROQ_API_KEY`.
4. Restart the dev server (`npm run dev`) after adding or changing the key.

The app calls two Groq endpoints server-side (never from the browser, so the key is never exposed):

- `POST /openai/v1/audio/transcriptions` with `model=whisper-large-v3-turbo` for transcription
- `POST /openai/v1/chat/completions` with `model=llama3-70b-8192` for summarization

## Supported Audio Formats

`.mp3` &middot; `.wav` &middot; `.ogg` &middot; `.m4a` — max file size 25MB.

## Project Structure

```
voicesnap/
├── app/
│   ├── api/
│   │   └── transcribe/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
├── .env.local.example
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```
