"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/*
 * Kullanıcı tercihleri. Kamera yöntemi seçimi kalıcıdır; varsayılan,
 * telefonun kendi kamera uygulamasını açan birincil yoldur
 * (bkz. CLAUDE.md, Bölüm 8: Kamera erişimi).
 */
export type CameraMode = "primary" | "live";

type SettingsState = {
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      cameraMode: "primary",
      setCameraMode: (mode) => set({ cameraMode: mode }),
    }),
    { name: "edibel-settings", version: 1 },
  ),
);
