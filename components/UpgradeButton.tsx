"use client";

import { useSession } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

export default function UpgradeButton() {
  const { session } = useSession();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsSubscribed(localStorage.getItem("vs_subscribed") === "true");
  }, []);

  if (!mounted) return null;

  // Signed out — show nothing (SignIn button handles this)
  if (!session) return null;

  // Signed in + active subscription
  if (isSubscribed) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-[#FF7A00]/30 bg-[#FF7A00]/10 px-3 py-1 text-xs font-semibold text-[#FF7A00]">
        <Sparkles className="h-3 w-3" strokeWidth={2.25} />
        Pro
      </span>
    );
  }

  // Signed in + no subscription
  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.user.emailAddresses[0]?.emailAddress }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Checkout failed — check server logs.");
      }
    } catch {
      alert("Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleUpgrade}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-[#FF7A00] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#ff8c1f] active:scale-[0.98] disabled:opacity-60"
    >
      <Sparkles className="h-3 w-3" strokeWidth={2.25} />
      {loading ? "Redirecting…" : "Upgrade to Pro $3/mo"}
    </button>
  );
}
