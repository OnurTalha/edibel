"use client";

import { useEffect } from "react";
import { STR } from "@/lib/ui/strings";

/*
 * Kök düzendeki hatalar için son çare ekranı. Kendi <html> ve <body>
 * etiketlerini kendisi üretir; bu sebeple global stiller yüklü olmayabilir
 * ve renkler burada doğrudan verilir.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("kök hata:", error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          background: "#f8faf8",
          color: "#17211b",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 600 }}>{STR.errorTitle}</h1>
        <p style={{ maxWidth: "300px", lineHeight: 1.6, color: "#5b6660" }}>
          {STR.errorBody}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: "52px",
            width: "100%",
            maxWidth: "280px",
            borderRadius: "16px",
            border: "none",
            background: "#0e7a4b",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          {STR.retry}
        </button>
      </body>
    </html>
  );
}
