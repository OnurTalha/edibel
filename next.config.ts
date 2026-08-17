import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kapsayıcı boyutunu küçültmek için bağımsız çıktı (bkz. CLAUDE.md, Bölüm 13)
  output: "standalone",
};

export default nextConfig;
