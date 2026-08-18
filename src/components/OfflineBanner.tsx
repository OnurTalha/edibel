"use client";

import { useEffect, useState } from "react";
import { WarningIcon } from "@/components/icons";
import { STR } from "@/lib/ui/strings";

/*
 * Bağlantı koptuğunda gösterilen uyarı şeridi (bkz. CLAUDE.md, Bölüm 12).
 * Sabitlenmiş değildir; içeriği aşağı iter, böylece hiçbir butonun üzerini
 * kapatmaz.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <p
      role="status"
      className="flex items-center gap-2 bg-amber-500 px-4 py-2.5 text-[13px] font-medium text-[#1b1405]"
    >
      <WarningIcon className="h-4 w-4 shrink-0" />
      {STR.offlineBanner}
    </p>
  );
}
