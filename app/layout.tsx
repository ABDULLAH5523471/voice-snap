import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SWRegistration } from "./sw-registration";

export const metadata: Metadata = {
  title: "VoiceSnap — Transcribe & Summarize Voice Messages in Seconds",
  description: "Transcribe & summarize voice messages in seconds.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VoiceSnap",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SWRegistration />
        {children}
      </body>
    </html>
  );
}
