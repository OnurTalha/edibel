import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Edibel",
  description:
    "Paketli gıdaların içindekiler etiketini fotoğraflayın, helal analizini görün. Japonca, Korece ve Çince etiketleri okur ve Türkçeye çevirir.",
  applicationName: "Edibel",
  manifest: "/manifest.webmanifest",
  // iOS'ta ana ekrana eklendiğinde bağımsız uygulama gibi açılması için
  appleWebApp: {
    capable: true,
    title: "Edibel",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Çentikli ekranlarda güvenli alan paylarını kullanabilmek için zorunlu
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf8" },
    { media: "(prefers-color-scheme: dark)", color: "#101513" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <Providers>
          <div className="mobile-shell">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
