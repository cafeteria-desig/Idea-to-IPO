"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RetailInvestorRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teams");
  }, [router]);

  return (
    <div className="py-20 text-center font-mono text-xs text-zinc-500">
      Redirecting to live trading pitches...
    </div>
  );
}
