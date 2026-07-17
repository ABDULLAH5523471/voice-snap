import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceSnap — Transcribe & Summarize Voice Messages in Seconds",
  description: "Transcribe & summarize voice messages in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
