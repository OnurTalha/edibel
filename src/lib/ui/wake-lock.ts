"use client";

import { useEffect } from "react";

/*
 * Analiz sırasında ekranın kilitlenmesini önler (bkz. CLAUDE.md, Bölüm 8).
 * Kullanıcı sayfayı arka plana alıp geri döndüğünde kilit yeniden istenir;
 * desteklemeyen tarayıcılarda sessizce devre dışı kalır.
 */

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        /* İzin verilmedi veya desteklenmiyor; analiz normal şekilde sürer */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [active]);
}
