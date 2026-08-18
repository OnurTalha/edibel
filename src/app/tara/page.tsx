"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AnalysisProgress } from "@/components/camera/AnalysisProgress";
import { CropEditor } from "@/components/camera/CropEditor";
import { LiveCamera } from "@/components/camera/LiveCamera";
import { PhotoInputButton } from "@/components/camera/PhotoInputButton";
import { ArrowLeftIcon, CameraIcon } from "@/components/icons";
import { errorMessage, isAbortError, requestAnalysis } from "@/lib/ui/api";
import { getDeviceId } from "@/lib/ui/device";
import { STR } from "@/lib/ui/strings";
import { useSettings, type CameraMode } from "@/lib/ui/store";

/*
 * Tarama akışı: fotoğraf alma → kırpma → analiz (bkz. CLAUDE.md, Bölüm 9).
 * Kamera ekranı her zaman koyudur (Bölüm 8), bu sebeple bu sayfa tema
 * belirteçlerini değil sabit koyu renkleri kullanır.
 */

type Stage = "capture" | "crop" | "analyzing";

export default function ScanPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("capture");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cameraMode = useSettings((state) => state.cameraMode);
  const setCameraMode = useSettings((state) => state.setCameraMode);

  /* Kalıcı tercih yalnızca istemcide okunur; sunucu çıktısıyla uyum için */
  useEffect(() => setMounted(true), []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const analysis = useMutation({
    mutationFn: async (imageBase64: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      return requestAnalysis(
        {
          mode: "image",
          imageBase64,
          mediaType: "image/jpeg",
          deviceId: getDeviceId(),
        },
        controller.signal,
      );
    },
    onSuccess: (result) => {
      router.replace(`/sonuc/${result.scanId}`);
    },
    onError: (err) => {
      setStage("capture");
      setFile(null);
      setError(isAbortError(err) ? STR.analysisCancelled : errorMessage(err));
    },
  });

  const onFile = useCallback((selected: File) => {
    setError(null);
    setFile(selected);
    setStage("crop");
  }, []);

  const onCropConfirm = useCallback(
    (imageBase64: string) => {
      setStage("analyzing");
      analysis.mutate(imageBase64);
    },
    [analysis],
  );

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const modeButton = (mode: CameraMode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setError(null);
        setCameraMode(mode);
      }}
      aria-pressed={cameraMode === mode}
      className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-medium ${
        cameraMode === mode
          ? "bg-white text-black"
          : "bg-white/10 text-white/80"
      }`}
    >
      {label}
    </button>
  );

  const deviceCameraButton = (
    <PhotoInputButton
      label={STR.takePhoto}
      useCamera
      onFile={onFile}
      className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 text-[17px] font-semibold text-black"
    >
      <CameraIcon className="h-6 w-6" />
    </PhotoInputButton>
  );

  return (
    <div className="screen-h flex flex-col bg-[#0b0f0d] text-white">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link
          href="/"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span className="sr-only">{STR.back}</span>
        </Link>
        <span className="text-sm text-white/70">{STR.scanDescription}</span>
      </header>

      {!mounted ? (
        <div className="flex-1" />
      ) : stage === "analyzing" ? (
        <AnalysisProgress onCancel={cancelAnalysis} />
      ) : stage === "crop" && file ? (
        <CropEditor
          file={file}
          onCancel={() => {
            setFile(null);
            setStage("capture");
          }}
          onConfirm={onCropConfirm}
        />
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex gap-2 px-4 pt-4">
            {modeButton("primary", STR.cameraModePrimary)}
            {modeButton("live", STR.cameraModeLive)}
          </div>

          {error ? (
            <p className="mx-4 mt-4 rounded-2xl bg-red-500/15 p-4 text-[15px] leading-relaxed text-red-100">
              {error}
            </p>
          ) : null}

          {cameraMode === "live" ? (
            <LiveCamera onCapture={onFile} fallback={deviceCameraButton} />
          ) : (
            <div className="flex flex-1 flex-col px-4 pb-6">
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                  <CameraIcon className="h-9 w-9 text-white/80" />
                </span>
                <p className="text-balance text-[15px] leading-relaxed text-white/70">
                  {STR.primaryModeHint}
                </p>
              </div>
              <p className="mb-4 text-center text-sm text-white/60">
                {STR.cameraModeHelp}
              </p>
              <div className="flex flex-col gap-3">
                {deviceCameraButton}
                <PhotoInputButton
                  label={STR.pickPhoto}
                  useCamera={false}
                  onFile={onFile}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-white/30 px-5 text-[15px] font-medium text-white"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
