"use client";

import { useSession } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

const PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;
const CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const ENV = process.env.NEXT_PUBLIC_PADDLE_ENV;

declare global {
  interface Window {
    PaddleBillingV1?: {
      Environment: { set: (env: string) => void };
      Initialized?: boolean;
      Initialize: (config: { token: string }) => void;
      Checkout: {
        open: (config: {
          customer?: { email?: string };
          items: { priceId: string; quantity: number }[];
          settings?: { variant?: string };
        }) => void;
      };
    };
  }
}

export default function UpgradeButton() {
  const { session } = useSession();
  const [paddleReady, setPaddleReady] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsSubscribed(localStorage.getItem("vs_subscribed") === "true");
  }, []);

  useEffect(() => {
    if (!CLIENT_TOKEN || !ENV) return;
    const CDN_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";
    if (document.querySelector(`script[src="${CDN_URL}"]`)) {
      setPaddleReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = CDN_URL;
    script.async = true;
    script.onload = () => {
      const p = window.PaddleBillingV1;
      if (p) {
        p.Environment.set(ENV);
        p.Initialize({ token: CLIENT_TOKEN });
      }
      setPaddleReady(true);
    };
    document.head.appendChild(script);
  }, []);

  if (!mounted) return null;

  if (!session) return null;

  if (isSubscribed) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-[#FF7A00]/30 bg-[#FF7A00]/10 px-3 py-1 text-xs font-semibold text-[#FF7A00]">
        <Sparkles className="h-3 w-3" strokeWidth={2.25} />
        Pro
      </span>
    );
  }

  const handleUpgrade = () => {
    if (!paddleReady || !PRICE_ID) return;
    setLoading(true);
    window.PaddleBillingV1?.Checkout.open({
      customer: { email: session.user.emailAddresses[0]?.emailAddress },
      items: [{ priceId: PRICE_ID, quantity: 1 }],
      settings: { variant: "one-page" },
    });
  };

  return (
    <button
      type="button"
      onClick={handleUpgrade}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-[#FF7A00] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#ff8c1f] active:scale-[0.98] disabled:opacity-60"
    >
      <Sparkles className="h-3 w-3" strokeWidth={2.25} />
      {loading ? "Opening Checkout…" : "Upgrade to Pro $3/mo"}
    </button>
  );
}
