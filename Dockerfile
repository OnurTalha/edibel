# Edibel üretim imajı (bkz. CLAUDE.md, Bölüm 13 ve Faz 9).
# Çok aşamalı yapı: bağımlılıklar ve derleme ayrı katmanlarda kalır, son
# imaja yalnızca Next.js'in bağımsız (standalone) çıktısı kopyalanır.

# 1) Bağımlılıklar
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Derleme için geliştirme bağımlılıkları da gereklidir (TypeScript, Tailwind)
RUN npm ci

# 2) Derleme
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    # Az bellekli sunucularda derlemenin diğer servisleri düşürmemesi için
    # Node yığını sınırlanır; bu proje için 1 GB fazlasıyla yeterlidir.
    NODE_OPTIONS=--max-old-space-size=1024
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3) Çalıştırma
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3200 \
    # Kapsayıcı İÇİNDE tüm arayüzler dinlenir; ana bilgisayara açılma
    # kararı port eşlemesiyle verilir ve compose dosyasında yalnızca
    # 127.0.0.1 üzerine eşlenir (bkz. CLAUDE.md, Bölüm 13).
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs edibel

COPY --from=builder --chown=edibel:nodejs /app/.next/standalone ./
COPY --from=builder --chown=edibel:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=edibel:nodejs /app/public ./public

USER edibel
EXPOSE 3200

# Sağlık denetimi veritabanı bağlantısını ve eklentileri de doğrular
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3200/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
