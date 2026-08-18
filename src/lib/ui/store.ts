"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/*
 * Kullanıcı tercihleri (bkz. CLAUDE.md, Bölüm 8 ve Bölüm 9).
 *
 * cameraMode: varsayılan, telefonun kendi kamera uygulamasını açan birincil
 * yoldur.
 *
 * madhhab: kullanıcı kendi mezhebini seçebilir. Seçim yapılırsa sonuç
 * ekranında öncelikli olarak o mezhebin hükmü gösterilir; seçim yapılmazsa
 * dört mezhep birlikte gösterilir. Bu tercih yalnızca GÖSTERİMİ etkiler;
 * hüküm hesabı her zaman dört mezhep için yapılır ve veritabanından gelir.
 */
export type CameraMode = "primary" | "live";
export type Madhhab = "hanefi" | "safii" | "maliki" | "hanbeli";

type SettingsState = {
  cameraMode: CameraMode;
  madhhab: Madhhab | null;
  setCameraMode: (mode: CameraMode) => void;
  setMadhhab: (madhhab: Madhhab | null) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      cameraMode: "primary",
      madhhab: null,
      setCameraMode: (mode) => set({ cameraMode: mode }),
      setMadhhab: (madhhab) => set({ madhhab }),
    }),
    { name: "edibel-settings", version: 1 },
  ),
);
