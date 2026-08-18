import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kapsayıcı boyutunu küçültmek için bağımsız çıktı (bkz. CLAUDE.md, Bölüm 13)
  output: "standalone",

  async headers() {
    return [
      {
        // Hizmet çalışanı güncellemesi tarayıcı önbelleğine takılmamalıdır
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Yönetim sayfası arama motorlarına açılmaz
        source: "/admin",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
