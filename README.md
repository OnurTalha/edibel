# Edibel

Paketli gıdaların içindekiler etiketini telefon kamerasıyla okuyup malzemeleri
helal açısından değerlendiren, sonucu dört mezhebe (Hanefi, Şafii, Maliki,
Hanbeli) göre ayrı ayrı gösteren mobil web uygulaması.

Japonca, Korece ve Çince etiketler için tasarlandı; arayüz Türkçedir.

**Canlı:** https://edibel.talhaonur.com

---

## ⚠️ Uyarı

Bu uygulamanın verdiği sonuçlar **bilgilendirme amaçlıdır ve dini bir fetva
niteliği taşımaz.** Kesin bilgi için resmi helal belgelendirme kuruluşlarına
başvurun.

İçerik veritabanındaki fıkhi hükümler klasik fıkıh kaynaklarına ve helal
standartlarına dayanılarak derlenmiştir ve her kayıtta kaynak referansı
bulunur; ancak **henüz bir din âlimi tarafından denetlenmemiştir.** Kullanırken
bunu göz önünde bulundurun.

---

## Ne yapar

1. Kullanıcı etiketin içindekiler bölümünü fotoğraflar ve yalnızca ilgili kısmı
   kırpar.
2. Fotoğraf tarayıcıda küçültülüp sunucuya gönderilir; görme yeteneği olan bir
   dil modeli etiketteki metni okur ve Türkçeye çevirir.
3. Okunan metin ayrıştırılır: başlık bulunur, alerjen satırı ayrılır, parantez
   içi kaynak ifadeleri (`大豆由来`, `豚由来` gibi) çıkarılır, karakterler
   normalleştirilir.
4. Her malzeme içerik veritabanıyla eşleştirilir: sırayla tam eşleşme, çok dilli
   takma ad tablosu, `pg_trgm` bulanık eşleşme ve gömme vektörü benzerliği.
5. Eşleşen malzemelerin dört mezhebe göre hükmü okunur ve nihai sonuç üretilir.

Sonuç ekranı önce tek bir karar kartı gösterir; aşağı kaydırınca içindekilerin
satır satır Türkçe çevirisi, alerjen bildirimi, sorunlu malzemeler, mezhep
karşılaştırma tablosu, fıkhi gerekçeler ve okunan ham metin yer alır.

## Tasarımın değişmez ilkeleri

- **Dini hükmü yapay zeka vermez.** Modelin görevi yalnızca okumak, çevirmek ve
  malzeme adlarını yapılandırmaktır. Hüküm üretme yetkisi yalnızca denetlenmiş
  içerik veritabanındadır.
- **Çeviri karar mantığına girmez.** Eşleştirme her zaman etiketteki özgün metin
  üzerinden yapılır; çeviri sadece kullanıcıya gösterilir.
- **Emin olunmayan hiçbir şey helal sayılmaz.** Hiçbir yöntemle eşleşmeyen bir
  malzeme varsa sonuç ŞÜPHELİ olur.
- **Kullanıcı kendi kararını verebilmelidir.** Bu yüzden etiketin tam çevirisi
  hiçbir ekranda gizlenmez.
- **Fotoğraflar saklanmaz.** Sunucuya yalnızca analiz için gelir; veritabanına
  okunan metin ve sonuç yazılır, görüntü yazılmaz.

## İçerik veritabanı

`data/ingredients` altındaki JSON dosyalarında tutulur ve `npm run db:seed` ile
yüklenir. Şu an: **251 malzeme, 2576 takma ad, 1368 mezhep hükmü, 74 kaynak
ifadesi, 11 fıkhi ilke.**

| Dosya | İçerik |
|---|---|
| `core.*.json` | Malzemeler (standart ad, kategori, kaynak türü, açıklama, hüküm seti) |
| `aliases.{ja,ko,zh_hans,zh_hant,en}.json` | Etikette geçebilecek yazımlar ve Türkçe karşılıkları |
| `ruling-sets.json` | Dört mezhebin hükümleri, dayandığı fıkhi ilke ve kaynak referansı |
| `fiqh-principles.json` | İstihale, istihlak, şüphelilerden kaçınma gibi ilkelerin açıklamaları |
| `source-hints.json` | `豚由来`, `대두 유래` gibi parantez içi kaynak ifadeleri |

Kurallar: her hüküm kaydında **kaynak referansı zorunludur**; aynı yazım birden
çok malzemeye bağlanamaz (yükleme betiği bunu denetler ve hata verir); yükleme
betiği tekrar çalıştırıldığında veriyi bozmaz.

Mezhep farkı üreten tipik başlıklar: jelatin ve istihale, sanayi etil alkolü
(`酒精` / `주정`), karmin, peynir mayası, kabuklu deniz ürünleri, ehl-i kitap
olmayan kesim.

## Teknoloji

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Zustand · TanStack Query ·
zod · PostgreSQL 16 + `pg_trgm` + `pgvector` · Drizzle ORM · Docker Compose ·
nginx · elle yazılmış hizmet çalışanı (PWA)

Ayrı bir arka uç sunucusu yoktur; sunucu tarafı iş mantığı Next.js rota
işleyicilerinde çalışır. Yapay zeka modeli sunucuda çalışmaz, harici sağlayıcı
arayüzünden çağrılır.

## Geliştirme ortamı

Gerekenler: Node.js 22+, Docker, bir görme modeli anahtarı (varsayılan sağlayıcı
Anthropic) ve bir gömme (embedding) anahtarı.

```bash
git clone https://github.com/OnurTalha/edibel.git
cd edibel
npm ci

cp .env.example .env      # AI_API_KEY ve EMBEDDING_API_KEY doldurulur
docker compose up -d      # PostgreSQL + pg_trgm + pgvector

npm run db:migrate        # şema
npm run db:seed           # içerik veritabanı
npm run db:embeddings     # gömme vektörleri (harici arayüz kullanır)

npm run dev               # http://localhost:3200
```

Kullanışlı betikler: `npm run lint`, `npx tsc --noEmit`, `npm run icons`.

> Canlı kamera yalnızca güvenli bağlamda (https veya localhost) çalışır. Yerel
> ağdan telefonla bağlanırken "Telefon kamerası" yolu çalışır, "Canlı görüntü"
> çalışmaz.

## Dağıtım

Tek Next.js kapsayıcısı ve bir PostgreSQL kapsayıcısı; önünde nginx ters vekil
ve Let's Encrypt sertifikası. Bütün port eşlemeleri `127.0.0.1` üzerinedir,
dışarıya yalnızca nginx bakar.

Adım adım kurulum, sertifika, yedekleme ve güncelleme: **[deploy/README.md](deploy/README.md)**

## Gizlilik

- Kullanıcı fotoğrafları sunucuda saklanmaz.
- Taramalar tarayıcıda üretilen anonim bir cihaz kimliğiyle ilişkilendirilir;
  hesap, e-posta veya kişisel bilgi istenmez.
- Günlükler yapılandırılmış JSON'dur ve kişisel veri içermez: etiket metni,
  çeviriler, malzeme adları, cihaz kimliği ve IP adresi günlüğe yazılmaz.

## Katkı

En değerli katkı içerik veritabanını büyütmektir. Uygulama, eşleşmeyen
malzemeleri sayaçlarıyla birlikte kaydeder; bunlar `/admin` sayfasında görülür
ve `data/ingredients` altına eklenir.

Yeni bir malzeme eklerken: ilgili dillerdeki yaygın yazımları takma ad olarak
girin, dört mezhebin hükmünü belirtin ve **her hüküm için kaynak referansı
yazın.** Kaynağı olmayan kayıt kabul edilmez.

## Belgeler

- [docs/mimari.md](docs/mimari.md) — katmanların ne yaptığı ve hangi kararın
  nerede alındığı
- [CLAUDE.md](CLAUDE.md) — projenin ayrıntılı şartnamesi
- [deploy/README.md](deploy/README.md) — dağıtım rehberi

## Lisans

Henüz bir lisans belirlenmedi. Lisans belirtilmediği sürece tüm hakları
saklıdır; kodu kullanmak isteyenlerin depo sahibiyle iletişime geçmesi gerekir.
