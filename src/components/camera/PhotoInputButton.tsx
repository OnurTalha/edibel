"use client";

import { useRef } from "react";

/*
 * Birincil kamera yolu (bkz. CLAUDE.md, Bölüm 8).
 * capture="environment" ile telefonun kendi kamera uygulaması açılır;
 * kullanıcı tanıdık odaklama, yakınlaştırma ve flaş denetimlerini kullanır
 * ve fotoğraf tam çözünürlükte gelir. capture verilmezse galeri açılır.
 */
export function PhotoInputButton({
  label,
  useCamera,
  onFile,
  className,
  children,
}: {
  label: string;
  useCamera: boolean;
  onFile: (file: File) => void;
  className: string;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(useCamera ? { capture: "environment" as const } : {})}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          /* Aynı fotoğrafın yeniden seçilebilmesi için alan sıfırlanır */
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        {children}
        <span>{label}</span>
      </button>
    </>
  );
}
