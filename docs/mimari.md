# Edibel — Mimari Notları

Bu not, kodun neden böyle bölündüğünü ve hangi kararın nerede alındığını
özetler. Kuralların kaynağı `CLAUDE.md`'dir; burada yalnızca uygulamadaki
karşılıkları anlatılır.

## Değişmez ilke

**Dini hükümler yapay zeka tarafından üretilmez.** Model yalnızca okur,
yapılandırır ve çevirir. Hüküm üretme yetkisi yalnızca içerik
veritabanındadır (`madhhab_rulings`). Bu ayrım şu üç yerde korunur:

1. `src/lib/ai/vision.ts` — sistem talimatı modele hüküm vermeyi ve özgün
   yazımı değiştirmeyi açıkça yasaklar; çıktı zod ile doğrulanır.
2. `src/lib/analysis/pipeline.ts` — modelden gelen tek girdi **özgün
   metindir**. Çeviriler yalnızca gösterim içindir.
3. `src/lib/verdict/` — saf fonksiyonlar; girdisi veritabanı hükümleridir.

**Çeviri hiçbir zaman karar mantığına girmez.** Eşleştirme her zaman
etiketteki özgün yazım üzerinden yapılır.

## Akış

```
Fotoğraf (tarayıcı)
  └─ Katman 1  src/lib/ui/image.ts        kırpma, 2000 px, JPEG
     └─ POST /api/analyze
        └─ Katman 2  src/lib/ai/vision.ts     okuma + çeviri (model)
           └─ Katman 3  src/lib/parsing/       NFKC, ayırıcı, başlık, alerjen,
              │                                parantez, yazı sistemi tespiti
              └─ Katman 4  src/lib/matching/   tam → takma ad → pg_trgm → vektör
                 └─ Katman 5  src/lib/verdict/ mezhep hükümleri, toplama kuralları
                    └─ Bölüm 10 sonuç nesnesi → scans tablosu → arayüz
```

Fotoğraf sunucuya yalnızca analiz için gelir ve **saklanmaz**; `scans`
tablosuna okunan metin, çeviri ve sonuç nesnesi yazılır.

## Katman notları

**Ayrıştırma (`src/lib/parsing`)** Doğu Asya etiketleri için kurulmuştur:
başlık ifadeleriyle içindekiler bölümünü ayırır, besin değerleri tablosunda
durur, alerjen satırını ayrı alan olarak çıkarır, parantez içi kaynak
ifadelerini `sourceHint` olarak taşır, tam genişlikli karakterleri ve
ayırıcıları tekilleştirir. Yazı sistemi tespiti hangi takma ad kümesinin
öncelikli aranacağını belirler.

**Eşleştirme (`src/lib/matching`)** dört yöntemi sırayla dener ve ilk
başarılı sonucu döndürür. Hiçbiri tutmazsa terim `unmatched_terms`
tablosuna yazılır ve **asla helal sayılmaz**. Alerjen satırındaki domuz
bildirimi, kaynağı belirsiz hayvansal maddeler için kaynak ipucu olarak
kullanılır.

**Kapsayıcı adlar.** `スープ(ポークエキス、豚脂)` gibi girdilerde kapsayıcı
adın kendisi eşleşmese bile içeriği ayrı ayrı analiz edilir; kapsayıcı
`isCompoundParent` ile işaretlenir ve sonucu tek başına şüpheliye çevirmez.
Tek öğeli parantezler (`ショートニング(ラード)`) kaynak ipucu olarak
çözülemezse malzeme olarak da denenir; böylece parantez içindeki haram madde
gözden kaçmaz.

**Karar (`src/lib/verdict`)** yan etkisizdir. Toplama sırası Bölüm 7'deki
kuralların aynısıdır ve kod içinde numaralarıyla belirtilmiştir: dört mezhebe
göre haram → HARAM; eşleşmeyen malzeme → ŞÜPHELİ; mezhepler ayrışıyorsa →
MEZHEBE GÖRE DEĞİŞİR; hepsi helal ise → HELAL.

## Arayüz

Yalnızca mobil (390 px esas, 320 px alt sınır). Ana etkileşim öğeleri alt
üçte birdedir, dokunma alanları en az 44 px, form alanları 16 px yazı
boyutundadır. Kamera ekranı her zaman koyudur; diğer ekranlar açık ve koyu
temayı destekler. Türkçe metinlerin tamamı `src/lib/ui/strings.ts`
içindedir.

Sonuç ekranının ilk görünümü tek bir karar kartıdır; detay alanında
tercüme, alerjen, sorunlu malzemeler, mezhep tablosu, gerekçeler, ham metin
ve uyarı metni yer alır. **Tercüme bölümü** kullanıcının uygulamanın
kararına bağımlı kalmadan kendi değerlendirmesini yapabilmesi içindir ve
gizlenmez.

## Dağıtım

Tek Next.js kapsayıcısı (`output: "standalone"`) + PostgreSQL. Model
sunucuda çalışmaz, harici arayüzle çağrılır. Gömme vektörleri geliştirme
makinesinde üretilip veritabanına yazılır. Bütün port eşlemeleri
`127.0.0.1` üzerinedir; dışarıya yalnızca nginx bakar. Ayrıntılar:
`deploy/README.md`.
