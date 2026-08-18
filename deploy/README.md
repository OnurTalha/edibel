# Edibel — Dağıtım Rehberi

Bu dosya uygulamanın kendi sunucunuza kurulmasını anlatır. **İçinde gerçek
anahtar, parola veya sunucu adresi bulunmaz**; bu değerler yalnızca sunucudaki
`deploy/.env` dosyasında ve kendi kayıtlarınızda durur. Aşağıda
`<kullanici>@<sunucu>` gibi yer tutucular kullanılmıştır.

## 0. Yapı

```
İnternet ──► nginx (80/443, TLS)
                 │  ters vekil
                 ▼
        127.0.0.1:3200  edibel-app  (Next.js, tek kapsayıcı)
                 │
                 ▼
        127.0.0.1:5433  edibel-db   (PostgreSQL 16 + pg_trgm + pgvector)
```

Kritik kural: **hiçbir kapsayıcı `0.0.0.0` üzerine bağlanmaz.** Docker, ana
bilgisayarın güvenlik duvarı kurallarını atladığı için `0.0.0.0` eşlemesi
servisi farkında olmadan internete açar. `compose.prod.yml` içindeki bütün
eşlemeler `127.0.0.1:PORT:PORT` biçimindedir. Dışarıya yalnızca nginx bakar.

Yapay zeka modeli sunucuda çalışmaz; harici sağlayıcının arayüzü üzerinden
çağrılır. Gömme vektörleri geliştirme makinesinde üretilip veritabanına
yazılır (bkz. `CLAUDE.md`, Bölüm 3).

## 1. Ön koşullar

Sunucuda:

- Docker Engine ve Docker Compose eklentisi (`docker compose version`)
- nginx
- certbot ve `python3-certbot-nginx` (ya da webroot eklentisi)
- `edibel.talhaonur.com` A/AAAA kaydının bu sunucuya bakıyor olması
- Açık portlar: yalnızca 80 ve 443

Geliştirme makinesinde (içerik yükleme için):

- Bu depo, `npm ci` ile kurulmuş bağımlılıklar
- Sunucuya SSH erişimi
- `EMBEDDING_API_KEY` (gömme vektörleri için)

## 2. Dosyaların sunucuya alınması

```bash
ssh <kullanici>@<sunucu>
sudo mkdir -p /opt/edibel && sudo chown "$USER" /opt/edibel
git clone <depo-adresi> /opt/edibel
cd /opt/edibel
```

Depo kullanmıyorsanız `rsync -av --exclude node_modules --exclude .next ./
<kullanici>@<sunucu>:/opt/edibel/` de olur.

## 3. Ortam değişkenleri

```bash
cd /opt/edibel/deploy
cp .env.example .env
chmod 600 .env
nano .env
```

Doldurulacaklar:

| Değişken | Açıklama |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Veritabanı kapsayıcısının kimlikleri |
| `DATABASE_URL` | `postgres://<kullanici>:<parola>@db:5432/<veritabani>` — kullanıcı/parola yukarıdakiyle aynı olmalı, sunucu adı `db` |
| `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER` | Görme modeli sağlayıcısı |
| `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` | Çalışma anında eşleşmeyen terimlerin vektöre çevrilmesi için |
| `NEXT_PUBLIC_APP_URL` | `https://edibel.talhaonur.com` |
| `ADMIN_TOKEN` | `/admin` sayfasının anahtarı, örn. `openssl rand -hex 32` |

Parolayı hem `POSTGRES_PASSWORD` hem `DATABASE_URL` içinde aynı yazın.

## 4. Kapsayıcıları başlatma

```bash
cd /opt/edibel/deploy
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml ps
```

İlk açılışta `db` kapsayıcısı `deploy/db/init/01-extensions.sql` dosyasını
çalıştırarak `pg_trgm` ve `pgvector` eklentilerini kurar.

Uygulama, veritabanı şeması yüklenene kadar sağlık denetiminde `degraded`
görünebilir; bir sonraki adım bunu tamamlar.

## 5. Veritabanı şeması ve içeriği

Şema göçleri ve içerik yüklemesi **geliştirme makinesinden**, SSH tüneli
üzerinden yapılır. Böylece üretim imajı küçük kalır ve gömme vektörü üretimi
sunucuyu yormaz.

Birinci terminalde tüneli açın (yerel 5434 → sunucudaki 5433):

```bash
ssh -N -L 5434:127.0.0.1:5433 <kullanici>@<sunucu>
```

İkinci terminalde, depo kökünde:

```bash
# 1) Şema
DATABASE_URL="postgres://<kullanici>:<parola>@127.0.0.1:5434/<veritabani>" \
  npm run db:migrate

# 2) İçerik veritabanı (malzemeler, takma adlar, hükümler, ilkeler)
DATABASE_URL="postgres://<kullanici>:<parola>@127.0.0.1:5434/<veritabani>" \
  npm run db:seed

# 3) Gömme vektörleri (EMBEDDING_API_KEY gerekir; yalnızca eksikleri üretir)
DATABASE_URL="postgres://<kullanici>:<parola>@127.0.0.1:5434/<veritabani>" \
  npm run db:embeddings
```

Kabukta verilen `DATABASE_URL`, yerel `.env` dosyasındaki değerin önüne
geçer; betikler yerel geliştirme veritabanına dokunmaz.

Alternatif olarak geliştirme makinesinde hazırlanmış bir yedeği geri
yükleyebilirsiniz (bkz. 8. bölüm).

Yükleme sonrası sağlık denetimi:

```bash
ssh <kullanici>@<sunucu> 'curl -s http://127.0.0.1:3200/api/health'
# {"status":"ok","database":"ok","extensions":{"pg_trgm":true,"pgvector":true}}
```

## 6. nginx ve TLS

Tarayıcı kamerası yalnızca güvenli bağlamda çalışır; TLS zorunludur.

**6.1 Geçici HTTP bloğu ile sertifika alma**

```bash
sudo mkdir -p /var/www/certbot
sudo tee /etc/nginx/sites-available/edibel-gecici.conf >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name edibel.talhaonur.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'kurulum'; add_header Content-Type text/plain; }
}
EOF
sudo ln -s /etc/nginx/sites-available/edibel-gecici.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot \
  -d edibel.talhaonur.com \
  --agree-tos -m <eposta-adresiniz> --no-eff-email
```

**6.2 Asıl yapılandırmaya geçiş**

```bash
sudo rm /etc/nginx/sites-enabled/edibel-gecici.conf
sudo cp /opt/edibel/deploy/nginx/edibel.talhaonur.com.conf \
        /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/edibel.talhaonur.com.conf \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`options-ssl-nginx.conf` veya `ssl-dhparams.pem` yoksa:

```bash
sudo curl -o /etc/letsencrypt/options-ssl-nginx.conf \
  https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf
sudo openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
```

**6.3 Yenileme**

Certbot paketi bir systemd zamanlayıcısı kurar. Doğrulamak için:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Yenileme sonrası nginx'in yeniden yüklenmesi için:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

## 7. Doğrulama

- `https://edibel.talhaonur.com` açılıyor, HTTP isteği HTTPS'e yönleniyor
- Telefonda "Etiketi Tara" → kamera açılıyor (TLS olmadan açılmaz)
- Ana ekrana ekleme çalışıyor (uygulama adı **Edibel**)
- `/admin` sayfası `ADMIN_TOKEN` ile açılıyor, yanlış anahtarı reddediyor
- Sonuç ekranında uyarı metni görünüyor

## 8. Yedekleme

```bash
cd /opt/edibel/deploy
./backup.sh                       # deploy/backups altına sıkıştırılmış yedek
BACKUP_DIR=/yedek/yol ./backup.sh # başka dizine
```

Her gece 03:15'te çalıştırmak için (`crontab -e`):

```
15 3 * * * cd /opt/edibel/deploy && ./backup.sh >> /var/log/edibel-backup.log 2>&1
```

Betik varsayılan olarak son 14 günü saklar (`KEEP_DAYS` ile değiştirilir).

Geri yükleme:

```bash
gunzip -c deploy/backups/edibel-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f deploy/compose.prod.yml exec -T db \
  psql -U <kullanici> -d <veritabani>
```

Yedekler parola içermez ama **içerik veritabanının tamamını** içerir; sunucu
dışına da bir kopya almanız önerilir.

## 9. Güncelleme

```bash
cd /opt/edibel
git pull
cd deploy
docker compose -f compose.prod.yml up -d --build
docker image prune -f
```

Şema veya içerik değiştiyse 5. bölümdeki adımları (tünel + `db:migrate`,
`db:seed`, gerekiyorsa `db:embeddings --all`) tekrarlayın. Yükleme betiği
idempotenttir; mevcut veriyi bozmaz.

Arayüz veya hizmet çalışanı değiştiyse `public/sw.js` içindeki `VERSION`
değerini yükseltin; aksi halde eski önbellek kullanılmaya devam eder.

## 10. Günlükler

```bash
docker compose -f compose.prod.yml logs -f app
docker compose -f compose.prod.yml logs --since 1h app | grep '"level":"error"'
```

Uygulama günlükleri tek satırlık JSON'dur:

```json
{"ts":"...","level":"info","app":"edibel","event":"analyze.done","deviceHash":"a1b2c3d4e5f6","durationMs":8421,"language":"ja","verdict":"supheli","unmatchedCount":1}
```

**Kişisel veri günlüğe yazılmaz**: etiket metni, çeviriler, malzeme adları,
fotoğraf verisi, cihaz kimliği ve IP adresi kaydedilmez. Cihaz kimliği yerine
geri döndürülemez kısa bir özet (`deviceHash`) yazılır.

Günlük dosyaları kapsayıcı başına 10 MB × 5 dosya ile sınırlıdır.

## 11. Güvenlik notları

- Uygulama herkese açıktır; yalnızca `/admin` yolu `ADMIN_TOKEN` ile korunur.
- Model anahtarı yalnızca sunucuda kullanılır, tarayıcıya gönderilmez.
- Kullanıcı fotoğrafları sunucuda saklanmaz; yalnızca okunan metin ve sonuç
  `scans` tablosuna yazılır.
- Hız sınırı: cihaz başına dakikada en fazla on tarama (uygulama içinde,
  kapsayıcı belleğinde tutulur; kapsayıcı yeniden başlarsa sıfırlanır).
- `deploy/.env` dosyasının izinleri `600` olmalıdır ve depoya girmez.
- Güvenlik duvarında yalnızca 22 (SSH), 80 ve 443 açık olmalıdır.

## 12. Sorun giderme

| Belirti | Bakılacak yer |
|---|---|
| 502 Bad Gateway | `docker compose -f compose.prod.yml ps`, uygulama kapsayıcısı ayakta mı |
| `/api/health` → `degraded` | Eklentiler kurulu mu, göçler çalıştırıldı mı (5. bölüm) |
| Analiz "hizmet yapılandırılmamış" diyor | `deploy/.env` içinde `AI_API_KEY` boş |
| Kamera açılmıyor | TLS sertifikası geçerli mi, adres `https://` mi |
| Fotoğraf yüklenmiyor (413) | nginx `client_max_body_size 10m` satırı duruyor mu |
| Analiz zaman aşımına uğruyor | nginx `proxy_read_timeout 120s` satırı duruyor mu |
| Bilinmeyen malzeme çok fazla | `/admin` sayfasındaki eşleşmeyen terimleri içerik veritabanına ekleyin |
| Eski arayüz görünüyor | `public/sw.js` içindeki `VERSION` yükseltilmemiş olabilir |
