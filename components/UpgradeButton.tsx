"use client";

import { useSession } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

export default function UpgradeButton() {
  const { session } = useSession();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsSubscribed(localStorage.getItem("vs_subscribed") === "true");
  }, []);

  if (!session) {
    return (
      <span className="text-xs text-[#9CA3AF]">Sign in to upgrade</span>
    );
  }

  if (isSubscribed) {
    return (
      <span className="rounded-lg border border-[#232838] bg-[#131720] px-3 py-1.5 text-xs font-medium text-[#FF7A00]">
        Pro
      </span>
    );
  }

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // silent fail
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
      {loading ? "Redirecting…" : "Upgrade"}
    </button>
  );
}
