export const metadata = {
  title: "VoiceSnap – Instant Voice Transcription & Summarization",
  description: "Upload a voice message and get an instant, accurate transcription and concise summary in multiple languages.",
  openGraph: {
    title: "VoiceSnap – Instant Voice Transcription",
    description: "Transcribe and summarize voice messages instantly. Supports Hindi, Urdu, Punjabi, English and more.",
    url: "https://voicesnap.example.com",
    siteName: "VoiceSnap",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  robots: "index,follow",
};

import PageClient from "./PageClient";

export default function Page() {
  return <PageClient />;
}
