# Edibel: Helal Gıda İçindekiler Analiz Uygulaması

Bu dosya, Claude Code ile geliştirme yürütmek için hazırlanmış proje talimatıdır. Proje kökünde `CLAUDE.md` adıyla bulunur.

**Uygulama adı:** Edibel
**Alan adı:** `https://edibel.talhaonur.com`
**Çalışacağı yer:** Kendi sunucum. DNS kaydı hazırdır.

---

## 1. Proje Özeti

Kullanıcının paketli bir gıdanın içindekiler etiketini telefon kamerası ile fotoğraflamasını sağlayan, etiketteki malzemeleri okuyup analiz eden ve sonucun helal, haram veya şüpheli olduğunu gösteren bir uygulama geliştirilecektir. Helal sonuçlarda, malzemenin hangi mezheplere (Hanefi, Şafii, Maliki, Hanbeli) göre uygun olduğu ayrıca belirtilecektir.

**Hedef pazar ve dil durumu.** Taranacak etiketlerin büyük çoğunluğu Japonca, Korece ve Çince olacaktır. Uygulamanın arayüzü Türkçedir. Bu durum mimarinin merkezindeki karardır ve aşağıdaki her bölümü etkiler. Latin alfabesi ikincil bir durum olarak ele alınır, birincil durum olarak değil.

**Kullanım biçimi.** Uygulama yalnızca mobil telefonlarda kullanılacaktır ve alan adı üzerinden tarayıcıdan erişilecektir. Bu sebeple uygulama, telefona kurulabilen bir ilerici web uygulaması (PWA) olarak geliştirilir. Masaüstü için ayrı bir tasarım yapılmaz. Masaüstünde açıldığında sayfa, mobil genişlikte ortalanmış tek sütun olarak gösterilir.

**En kritik tasarım ilkesi.** Dini hükümler yapay zeka tarafından üretilmez. Hükümler, uygulama içindeki denetlenmiş bir malzeme veritabanından gelir. Yapay zekanın görevi yalnızca fotoğraftaki metni okumak, çevirmek, malzeme isimlerini normalleştirmek ve bu isimleri veritabanı kayıtlarıyla eşleştirmektir.

**Kullanıcının doğrulama hakkı.** Kullanıcı, uygulamanın kararına körü körüne güvenmek zorunda kalmamalıdır. Bu sebeple detay ekranında etiketin tam Türkçe çevirisi gösterilir. Kullanıcı malzemeleri kendi dilinde okuyup kendi kararını verebilmelidir. Bu özellik isteğe bağlı bir ek değildir, hatalı sonuçlara karşı ana güvenlik mekanizmasıdır.

**Teslim biçimi.** Bu proje demo veya prototip değildir. Her faz üretim kalitesinde tamamlanır ve son fazda gerçek sunucuya dağıtılır. Sahte veri, yer tutucu içerik veya geçici çözüm bırakılmaz.

---

## 2. Teknoloji Yığını

Aşağıdaki yığını kullan. Farklı bir tercih yapman gerekirse önce gerekçesini bana sun ve onay bekle.

* Next.js 15, App Router, TypeScript, strict mod açık
* Arayüz için Tailwind CSS
* Durum yönetimi için Zustand
* Veri çekme için TanStack Query
* Şema doğrulama için zod
* Veritabanı olarak PostgreSQL 16
* ORM olarak Drizzle
* Bulanık eşleştirme için `pg_trgm`, anlamsal eşleştirme için `pgvector` eklentileri
* PWA için `next-pwa` veya elle yazılmış hizmet çalışanı
* Docker ve Docker Compose ile paketleme
* Sunucu önünde nginx ters vekil, TLS için Certbot

Ayrı bir arka uç sunucusu kurulmaz. Sunucu tarafı iş mantığı Next.js rota işleyicilerinde çalışır. Bu, tek kapsayıcı ile dağıtım yapılmasını sağlar.

**Dizin yapısı**

```
/src/app              Next.js App Router sayfaları ve rota işleyicileri
/src/components       Arayüz bileşenleri
/src/lib/parsing      Metin ayrıştırma ve normalleştirme
/src/lib/matching     Eşleştirme motoru
/src/lib/verdict      Karar motoru
/src/lib/ai           Görme modeli istemcisi
/src/db               Drizzle şeması ve göç dosyaları
/data/ingredients     Malzeme veritabanı içerik dosyaları (JSON)
/scripts              İçerik yükleme ve gömme vektörü üretme betikleri
/deploy               Docker Compose, nginx yapılandırması, dağıtım betikleri
/docs                 Mimari notları
```

---

## 3. Çalışma Ortamı ve Dağıtım Kararı

Bu ayrımı baştan doğru kur.

**Geliştirme makinesinde çalışacak işler.** Geliştirme, içerik veritabanının hazırlanması ve gömme vektörlerinin üretilmesi burada yapılır. Gömme vektörü üretimi tek seferlik bir iştir ve bellek gerektirir. Bu işi geliştirme makinesinde çalıştır, sonucu veritabanına yaz. Geliştirme makinesi üretim ortamı değildir ve alan adı buraya yönlendirilmez.

**Sunucuda çalışacak işler.** Uygulamanın kendisi ve PostgreSQL sunucuda çalışır. Uygulamanın kaynak ihtiyacı düşüktür çünkü yapay zeka modeli sunucuda çalışmaz, harici bir sağlayıcının arayüzü üzerinden çağrılır. Beklenen tüketim şudur: Next.js süreci için yaklaşık 300 megabayt bellek, PostgreSQL için yaklaşık 300 megabayt bellek, içerik veritabanı ve gömme vektörleri için birkaç yüz megabayt disk.

**Çalışma anında gömme vektörü ihtiyacı.** Eşleşmeyen bir terim geldiğinde o terimin de vektöre çevrilmesi gerekir. Bunun için sunucuda model çalıştırma. Harici bir gömme arayüzü kullan. Bu çağrı yalnızca diğer üç eşleştirme yöntemi başarısız olduğunda yapılır, yani seyrek çalışır.

---

## 4. Mimari

Doğu Asya dillerindeki etiketler sebebiyle okuma katmanı, Latin alfabesi için kurulan alışılmış düzenden farklıdır.

**Katman 1: Tarayıcıda görüntü ön işleme.** Fotoğraf alındıktan sonra tarayıcıda kırpılır, döndürülür ve yeniden boyutlandırılır. Uzun kenar 2000 piksele indirilir ve JPEG olarak sıkıştırılır. Bu adım hem okuma doğruluğunu artırır hem de mobil bağlantıda yükleme süresini belirgin biçimde kısaltır.

**Katman 2: Görme yeteneği olan dil modeli ile okuma ve çeviri.** Fotoğraf çok dilli bir görme modeline gönderilir. Model etiketteki metni okur, malzeme listesini yapılandırır ve her malzemenin Türkçe çevirisini üretir. Doğu Asya etiketlerinde bu katman birincil yoldur, yedek yol değildir. Bunun sebebi şudur: Japonca ve Çince etiketlerde dikey yazım yaygındır, karakter yoğunluğu yüksektir, ambalaj kavislidir ve klasik metin tanıma motorları bu koşullarda belirgin biçimde başarısız olur. Görme modelleri bağlamdan yararlanarak bozuk karakterleri doğru tamamlar.

**Katman 3: Metin normalleştirme.** Okunan metin Unicode NFKC ile normalleştirilir. Tam genişlikli karakterler yarım genişlikliye çevrilir. Ayırıcı işaretler tekilleştirilir. Detaylar beşinci bölümdedir.

**Katman 4: Veritabanı eşleştirme.** Çıkarılan her malzeme adı sırayla şu yöntemlerle eşleştirilir. Önce tam eşleşme, sonra çok dilli takma ad tablosu, sonra `pg_trgm` ile bulanık eşleşme, en son gömme vektörü benzerliği. Hiçbir yöntemle eşleşmeyen malzeme asla helal sayılmaz ve sonuca bilinmeyen malzeme olarak yansıtılır.

**Katman 5: Karar.** Eşleşen malzemelerin dört mezhebe göre hükmü veritabanından okunur ve nihai sonuç üretilir.

Çevirinin karar zincirinde hiçbir rolü yoktur. Çeviri yalnızca kullanıcıya gösterilir. Eşleştirme her zaman etiketteki özgün metin üzerinden yapılır. Bu ayrımı koda yorum satırıyla yaz.

---

## 5. Doğu Asya Etiketlerine Özel Kurallar

Bu bölüm projenin teknik olarak en zorlu kısmıdır. Dikkatle uygula.

### 5.1 Etiket bölümünün bulunması

Fotoğraf çoğu zaman etiketin tamamını içerir. İçindekiler bölümünü ayırmak için şu başlık ifadeleri aranır.

| Dil | Başlıklar |
|---|---|
| Japonca | 原材料名, 原材料, 名称, 添加物 |
| Korece | 원재료명, 원재료, 성분명, 식품유형 |
| Çince (Basitleştirilmiş) | 配料, 配料表, 成分, 原料 |
| Çince (Geleneksel) | 成分, 配料, 原料 |

Bu başlıklardan sonra gelen ve besin değerleri tablosuna kadar süren metin, içindekiler listesidir. Besin değerleri tablosunun başlangıcı şu ifadelerle tespit edilir: 栄養成分表示 (Japonca), 영양정보 veya 영양성분 (Korece), 营养成分表 (Çince).

### 5.2 Alerjen satırı

Bu, projenin en değerli tespit kaynağıdır ve mutlaka kullanılmalıdır.

Japonya'da mevzuat gereği ambalajda alerjen bildirimi zorunludur ve bu bildirime 豚肉 (domuz eti) dahildir. Bildirim genellikle şu biçimdedir: `(一部に豚肉・大豆・小麦を含む)`. Kore'de benzer şekilde `돼지고기 함유` ifadesi kullanılır. Çin'de 致敏物质 başlığı altında benzer bildirim bulunur.

Bu satırda domuz eti geçiyorsa, malzeme listesindeki belirsiz maddelerin hayvansal kaynağı büyük olasılıkla domuzdur. Bu bilgi eşleştirme motoruna kaynak ipucu olarak beslenmelidir. Alerjen satırını ayrı bir alan olarak ayrıştır ve sonuç ekranında ayrıca göster.

### 5.3 Parantez içi kaynak bilgisi

Doğu Asya etiketlerinde malzemenin kaynağı sıklıkla parantez içinde belirtilir. Bu bilgi helal kararı için belirleyicidir ve atılmamalıdır.

Örnekler şunlardır. `乳化剤(大豆由来)` ifadesinde 大豆由来 soya kaynaklı anlamına gelir ve malzeme bitkiseldir. `ゼラチン(豚由来)` ifadesinde 豚由来 domuz kaynaklı anlamına gelir. `ゼラチン(牛由来)` ifadesinde kaynak sığırdır ve kesim usulü sorgulanmalıdır. Korece'de `(대두 유래)` ve `(돼지 유래)`, Çince'de `(大豆来源)` ve `(猪来源)` aynı işlevi görür.

Ayrıştırma sırasında her malzeme için `rawText` ve `sourceHint` alanlarını ayrı ayrı üret.

### 5.4 Karakter normalleştirme

Şu işlemleri sırayla uygula.

1. Unicode NFKC normalleştirmesi. Bu işlem tam genişlikli karakterleri (Ａ, １, （) yarım genişlikliye çevirir.
2. Ayırıcı birleştirme. Japonca ve Çince listelerde ayırıcı olarak 、 kullanılır. Çince'de ayrıca ，bulunur. Korece'de , kullanılır. Hepsini tek bir ayırıcıya indir.
3. Basitleştirilmiş ve geleneksel Çince eşlemesi. Aynı malzeme iki yazımda da aranabilmelidir.
4. Katakana ve hiragana farkını tolere et. Japonca malzeme adları genellikle katakana ile yazılır ancak istisnalar vardır.
5. Boşluk temizliği. Doğu Asya metinlerinde kelime arası boşluk bulunmaz, okuma katmanından gelen yapay boşlukları kaldır.

### 5.5 Yazı sistemi tespiti

Metindeki karakter aralıklarına bakarak dili tespit et. Hangul aralığı Korece, kana aralığı Japonca, yalnızca Han karakterleri Çince anlamına gelir. Tespit edilen dil, hangi takma ad kümesinin öncelikli aranacağını belirler.

### 5.6 Dikkat edilecek malzemeler

Aşağıdaki maddeler Doğu Asya paketli gıdalarında çok sık geçer ve helal kararı açısından belirleyicidir. Bunların tamamı içerik veritabanında bulunmalıdır.

**Japonca**

| İfade | Anlamı | Not |
|---|---|---|
| 酒精 | Etil alkol | Japon gıdalarında koruyucu olarak son derece yaygındır. Mezhepler arası farkın en sık karşılaşılan örneğidir. |
| 醸造アルコール | Mayalanmış alkol | Alkol kaynağı sorgulanmalıdır. |
| みりん | Mirin | Alkol içerir. みりん風調味料 ise düşük alkollüdür ve ayrı değerlendirilir. |
| 料理酒 | Pişirme sakesi | Alkol içerir. |
| ゼラチン | Jelatin | Kaynak belirtilmemişse şüphelidir. |
| ラード, 豚脂 | Domuz yağı | Haram. |
| ショートニング | Shortening | Kaynağı bitkisel veya hayvansal olabilir. |
| 動物性油脂 | Hayvansal yağ | Kaynak belirsizdir. |
| 乳化剤 | Emülgatör | Kaynak parantezde aranmalıdır. |
| 豚コラーゲン | Domuz kolajeni | Haram. |
| かつおエキス, チキンエキス | Balık veya tavuk özü | Tavuk özünde kesim usulü sorgulanır. |
| コチニール色素 | Karmin | Haşere kaynaklıdır, mezhepler arası fark vardır. |

**Korece**

| İfade | Anlamı |
|---|---|
| 주정 | Etil alkol |
| 돼지고기, 돈지 | Domuz eti, domuz yağı |
| 젤라틴 | Jelatin |
| 라드 | Domuz yağı |
| 유화제 | Emülgatör |
| 향미증진제 | Aroma güçlendirici |
| 코치닐추출색소 | Karmin |
| 쇠고기 | Sığır eti, kesim usulü sorgulanır |

**Çince**

| İfade | Anlamı |
|---|---|
| 食用酒精 | Etil alkol |
| 猪肉, 猪油 | Domuz eti, domuz yağı |
| 明胶 | Jelatin |
| 动物油脂 | Hayvansal yağ |
| 乳化剂 | Emülgatör |
| 胭脂红, 胭脂虫红 | Karmin |
| 猪肠衣 | Domuz bağırsağı |

### 5.7 Katkı maddesi numaralandırma sistemleri

Avrupa'daki E numarası sistemi Doğu Asya'da aynı biçimde kullanılmaz. Bu sebeple veritabanı yalnızca E koduna dayanamaz.

* Japonya katkı maddelerini numarayla değil, Japonca adla belirtir.
* Kore benzer şekilde Korece ad kullanır.
* Çin, GB 2760 standardını ve CNS kodlarını kullanır.
* Uluslararası ortak zemin INS numarasıdır.

Veritabanında INS numarasını ana köprü alan olarak tut. E kodunu ve CNS kodunu ayrı alanlar olarak sakla. Japonca ve Korece adlar takma ad tablosunda yer alır.

---

## 6. Veritabanı Şeması

Drizzle ile şu tabloları oluştur.

### `ingredients`

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | uuid | Birincil anahtar |
| `canonicalNameTr` | text | Türkçe standart ad |
| `canonicalNameEn` | text | İngilizce standart ad |
| `insCode` | text, boş olabilir | Uluslararası INS numarası, ana köprü alan |
| `eCode` | text, boş olabilir | Avrupa E kodu |
| `cnsCode` | text, boş olabilir | Çin GB 2760 CNS kodu |
| `category` | enum | emulgator, renklendirici, jelatin, enzim, alkol_turevi, aroma, tatlandirici, koruyucu, yag, protein, diger |
| `sourceType` | enum | bitkisel, hayvansal, mikrobiyal, sentetik, belirsiz |
| `defaultStatus` | enum | helal, haram, supheli |
| `descriptionTr` | text | Malzemenin ne olduğuna dair Türkçe açıklama |
| `embedding` | vector(768) | Anlamsal eşleştirme için |

### `ingredient_aliases`

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | uuid | Birincil anahtar |
| `ingredientId` | uuid | `ingredients` tablosuna referans |
| `alias` | text | Etikette geçebilecek yazım |
| `language` | enum | ja, ko, zh_hans, zh_hant, en, tr |
| `script` | enum, boş olabilir | katakana, hiragana, kanji, hangul, han, latin |
| `translationTr` | text, boş olabilir | Bu yazımın doğrudan Türkçe karşılığı |

Bu tablo uygulamanın kalitesini doğrudan belirler. Her malzeme için ilgili dillerdeki bütün yaygın yazımlar girilmelidir. Örnek olarak jelatin için en az şunlar bulunmalıdır: ゼラチン, 動物性ゼラチン, 젤라틴, 明胶, 吉利丁, gelatin, jelatin.

`translationTr` alanı sayesinde bilinen malzemelerin çevirisi modelden değil veritabanından gelir. Bu, çeviri tutarlılığını sağlar ve çeviri hatasını azaltır.

### `source_hints`

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | uuid | Birincil anahtar |
| `pattern` | text | Parantez içi kaynak ifadesi, örnek olarak 豚由来 |
| `language` | enum | ja, ko, zh_hans, zh_hant |
| `resolvedSource` | enum | domuz, sigir, tavuk, balik, soya, misir, palm, mikrobiyal, sentetik, bilinmiyor |
| `translationTr` | text | İfadenin Türkçe karşılığı, örnek olarak domuz kaynaklı |

### `madhhab_rulings`

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | uuid | Birincil anahtar |
| `ingredientId` | uuid | `ingredients` tablosuna referans |
| `resolvedSource` | enum, boş olabilir | Kaynağa göre değişen hükümler için |
| `madhhab` | enum | hanefi, safii, maliki, hanbeli |
| `status` | enum | helal, haram, mekruh, supheli |
| `principleKey` | text | Hükmün dayandığı fıkhi ilke anahtarı |
| `reasoningTr` | text | Sade Türkçe gerekçe |
| `sourceRef` | text | Kaynak referansı, boş bırakılamaz |

`resolvedSource` alanı sayesinde aynı malzeme için kaynağa göre farklı hüküm tanımlanabilir. Jelatin bunun tipik örneğidir.

### `fiqh_principles`

| Alan | Tip | Açıklama |
|---|---|---|
| `key` | text | Birincil anahtar, örnek olarak `istihale` |
| `titleTr` | text | İlkenin adı |
| `explanationTr` | text | İlkenin sade açıklaması |

### `scans`

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | uuid | Birincil anahtar |
| `deviceId` | text | Anonim cihaz kimliği |
| `detectedLanguage` | text | Tespit edilen etiket dili |
| `rawText` | text | Okunan ham metin |
| `translatedText` | text | Ham metnin Türkçe çevirisi |
| `parsedIngredients` | jsonb | Ayrıştırılmış malzeme listesi |
| `verdict` | jsonb | Üretilen sonuç nesnesi |
| `createdAt` | timestamp | Oluşturulma zamanı |

Fotoğrafların kendisi sunucuda saklanmaz. Yalnızca çıkarılan metin saklanır.

### `unmatched_terms`

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | uuid | Birincil anahtar |
| `term` | text | Eşleşmeyen malzeme adı |
| `language` | text | Tespit edilen dil |
| `modelTranslationTr` | text | Modelin ürettiği çeviri, içerik ekleme işini kolaylaştırır |
| `occurrenceCount` | integer | Kaç kez karşılaşıldığı |
| `lastSeenAt` | timestamp | Son karşılaşma zamanı |

Bu tablo, canlı sistemde veritabanını büyütmenin yoludur. En sık karşılaşılan eşleşmeyen terimleri görüp içerik veritabanına eklersin. Bu tabloyu okuyan basit ve korumalı bir yönetim sayfası da yaz.

---

## 7. Mezhep Karar Mantığı

İçerik veritabanı hazırlanırken şu farklılıklar mutlaka işlenmelidir. Bu farklılıklar uygulamanın varlık sebebidir.

**İstihale (mahiyet değişimi).** Haram bir maddenin kimyasal süreçle bambaşka bir maddeye dönüşmesi durumudur. Hanefi ve Maliki mezhepleri bu dönüşümü genel olarak kabul eder. Şafii mezhebi en dar yorumu yapar. Jelatin ve bazı yağ türevleri bu ilkeye tabidir.

**İstihlak (eser miktarda karışım).** Çok küçük miktardaki maddenin büyük kütle içinde kaybolmasıdır. Aroma taşıyıcı çözücülerdeki etil alkol bu ilkeyle değerlendirilir.

**Alkol kaynağı.** Üzüm ve hurma dışındaki kaynaklardan elde edilen sanayi etil alkolü konusunda Hanefi mezhebinde daha geniş bir görüş bulunur. Diğer mezhepler genel olarak daha dar yorum yapar. Japonca 酒精 ve Korece 주정 maddeleri tam olarak bu kapsama girer ve hedef pazarda son derece sık karşılaşılacaktır.

**Deniz ürünleri kapsamı.** Hanefi mezhebi yalnızca balığı helal sayar. Şafii, Maliki ve Hanbeli mezhepleri deniz canlılarının tamamına daha geniş yaklaşır. Doğu Asya gıdalarında yaygın olan kabuklu deniz ürünü özleri, midye özü, karides tozu ve kitosan bu farkın örneğidir.

**Haşere kaynaklı maddeler.** Koşnil böceğinden elde edilen karmin bu başlığa girer. Mezhepler arasında farklı değerlendirmeler bulunur.

**Peynir mayası ve enzimler.** Kesim usulüne uygun olmayan hayvandan elde edilen maya konusunda Hanefi mezhebinde daha geniş bir görüş vardır. Şafii mezhebi daha dar yorumlar. Mikrobiyal maya tüm mezheplere göre sorunsuzdur.

**Ehl-i kitap kesimi.** Japonya, Kore ve Çin'de üretilen et ürünlerinde kesim usulü genellikle İslami şartlara uygun değildir. Sığır ve tavuk kaynaklı maddelerde bu durum ayrıca değerlendirilmelidir.

Her hüküm kaydına mutlaka `sourceRef` alanında bir kaynak referansı yaz. Kaynağı olmayan hüküm veritabanına eklenmez.

### Sonuç toplama kuralları

Malzeme listesinden nihai karara ulaşırken şu sıralamayı uygula.

1. Listede en az bir malzeme dört mezhebin tamamına göre haram ise, sonuç HARAM olur.
2. Listede eşleştirilemeyen en az bir malzeme varsa, sonuç ŞÜPHELİ olur. Bu kural birinci kural dışındaki her durumu geçersiz kılar.
3. Tüm malzemeler eşleşmiş ve hüküm mezhepler arasında farklılaşıyorsa, sonuç MEZHEBE GÖRE DEĞİŞİR olur.
4. Tüm malzemeler dört mezhebe göre helal ise, sonuç HELAL olur.

Bu sıralama bilinçli olarak temkinlidir. Sistem, emin olmadığı hiçbir durumda helal demez.

---

## 8. Mobil Arayüz Tasarım Kuralları

Uygulama yalnızca telefonda kullanılacaktır. Aşağıdaki kurallar zorunludur.

* Tasarım 390 piksel genişlik esas alınarak yapılır. Alt sınır 320 pikseldir ve bu genişlikte de bozulma olmamalıdır.
* Bütün ana etkileşim öğeleri ekranın alt üçte birinde bulunur. Kullanıcı tek elle ve baş parmakla kullanabilmelidir.
* Dokunulabilir alanlar en az 44 piksel yüksekliğinde olur.
* `viewport-fit=cover` kullanılır ve çentikli ekranlar için `env(safe-area-inset-bottom)` değeri hesaba katılır.
* Fare üzerine gelme durumuna bağlı hiçbir işlev bulunmaz.
* Yazı tipi boyutu form alanlarında en az 16 piksel olur. Daha küçük değerlerde iOS Safari sayfayı otomatik yakınlaştırır.
* Ana gövdede yatay kaydırma bulunmaz. Mezhep karşılaştırma tablosu gibi geniş içerikler kendi içinde yatay kaydırılabilir kutulara alınır.
* Doğu Asya karakterlerini eksiksiz gösteren bir yazı tipi yığını tanımla. Sistem yazı tiplerine geri dönüş zinciri Japonca, Korece ve Çince için ayrı ayrı çalışmalıdır.
* Uygulama telefona kurulabilir olmalıdır. Web uygulaması bildirim dosyası, uygulama simgeleri ve iOS için gerekli meta etiketleri hazırlanır. Uygulama adı Edibel olarak görünür.
* Kamera ekranı hariç koyu ve açık tema desteklenir. Kamera ekranı her zaman koyudur.
* Analiz sırasında ekran kilitlenmesini önlemek için ekran uyanık tutma arayüzü kullanılır.

### Kamera erişimi

Tarayıcıda kamera kullanımı, yerel uygulamadan farklıdır. Şu iki yolu birlikte uygula.

**Birincil yol.** `<input type="file" accept="image/*" capture="environment">` öğesi kullanılır. Bu öğe telefonun kendi kamera uygulamasını açar. Avantajı şudur: kullanıcı odaklama, yakınlaştırma ve flaş gibi tanıdık denetimleri kullanır, ve elde edilen fotoğraf tam çözünürlüktedir. Doğu Asya etiketlerindeki küçük karakterler için çözünürlük belirleyicidir.

**İkincil yol.** `getUserMedia` ile sayfa içinde canlı kamera görüntüsü gösterilir ve kare yakalanır. Bu yol hizalama çerçevesi göstermeyi mümkün kılar. Şu ayrıntılara dikkat et. Güvenli bağlam zorunludur, yani yalnızca HTTPS üzerinde çalışır. Video öğesine `playsInline` ve `muted` özellikleri verilmelidir, aksi halde iOS Safari görüntüyü tam ekrana alır. Arka kamera için `facingMode` değeri `environment` olarak istenir. Flaş denetimi iOS Safari'de desteklenmez, bu sebeple flaş butonu yalnızca desteklendiği tespit edildiğinde gösterilir.

Kullanıcı hangi yolu tercih edeceğini seçebilmelidir. Varsayılan birincil yoldur.

Fotoğraf seçildikten sonra tarayıcıda tuval üzerinde yeniden boyutlandırma ve sıkıştırma yapılır. Sunucuya ham fotoğraf gönderilmez.

---

## 9. Kullanıcı Akışı ve Ekranlar

### Ekran 1: Açılış

Ekranın merkezinde büyük bir kamera butonu bulunur. Butonun altında kısa bir açıklama metni yer alır. Ekranın alt kısmında geçmiş taramalara ve ayarlara giden ikinci derece bağlantılar bulunur.

Ayarlar ekranında kullanıcı kendi mezhebini seçebilir. Seçim yapılırsa sonuç ekranında öncelikli olarak o mezhebin hükmü gösterilir. Seçim yapılmazsa dört mezhep birlikte gösterilir.

### Ekran 2: Fotoğraf alma ve kırpma

Fotoğraf alındıktan sonra kullanıcıya kırpma ekranı gösterilir. Kullanıcı yalnızca içindekiler bölümünü seçer. Bu adım Doğu Asya etiketlerinde okuma başarısını belirgin biçimde artırır çünkü karakter yoğunluğu yüksek olan etiketlerde model gereksiz alana dağılmaz. Kırpma ekranı parmakla yakınlaştırma ve kaydırma desteklemelidir.

### Ekran 3: Analiz

Analiz sırasında adım adım ilerleme gösterilir. Örnek adımlar şunlardır: etiket okunuyor, dil tespit ediliyor, çeviri yapılıyor, malzemeler ayrıştırılıyor, veritabanı sorgulanıyor, sonuç hazırlanıyor.

### Ekran 4: Sonuç

Bu ekran iki bölümden oluşur ve dikey olarak kaydırılır.

**Üst bölüm (ilk açılışta görünen alan).** Ekranın tamamını kaplayan tek bir karar kartı bulunur. Kart yalnızca şu bilgileri içerir.

* Büyük punto ile ana hüküm: HELAL, HARAM veya ŞÜPHELİ
* Renk kodu. Helal için yeşil, haram için kırmızı, şüpheli için amber tonu kullanılır. Renk tek başına bilgi taşımaz, yanında metin ve simge bulunur.
* Hüküm helal ise, uygun olduğu mezheplerin listesi rozetler halinde gösterilir.
* Hüküm mezhepler arasında farklılaşıyorsa ana hüküm MEZHEBE GÖRE DEĞİŞİR olur. Bu durumda hangi mezhebe göre helal, hangisine göre haram olduğu kısaca listelenir.
* Kartın alt kenarında aşağı kaydırmayı işaret eden bir ok ve Detaylar yazısı bulunur.

Üst bölümde başka hiçbir bilgi bulunmaz. Kullanıcı tek bakışta kararı görebilmelidir.

**Alt bölüm (kaydırınca açılan detay alanı).** Şu bölümler sırayla yer alır.

**1. İçindekiler tercümesi.** Bu bölüm detay alanının en üstünde yer alır ve uygulamanın en önemli ikinci özelliğidir. Amaç, kullanıcının uygulamanın kararına bağımlı kalmadan malzemeleri kendi dilinde okuyup kendi değerlendirmesini yapabilmesidir.

Bölüm şu şekilde gösterilir. Etiketten okunan içindekiler metni ve Türkçe çevirisi, satır satır hizalanmış olarak sunulur. Her satırda solda özgün yazım, sağda Türkçe karşılığı bulunur. Dar ekranlarda bu düzen alt alta geçer, özgün yazım üstte ve Türkçe karşılığı hemen altında hafif soluk renkte yer alır.

Bu bölümde iki görünüm arasında geçiş yapan bir düğme bulunur. Birinci görünüm satır satır eşleşmeli listedir. İkinci görünüm ise metnin tamamının akıcı Türkçe çevirisidir.

Malzemenin durumu (helal, haram, şüpheli, bilinmiyor) her satırın yanında küçük bir simgeyle gösterilir. Böylece kullanıcı çeviriyi okurken hangi maddenin sorun çıkardığını da görür.

Veritabanında bulunan malzemelerin çevirisi veritabanındaki `translationTr` alanından gelir. Yalnızca veritabanında bulunmayan malzemelerin çevirisi modelden gelir. Modelden gelen çeviriler görsel olarak ayırt edilir ve yanlarında bu çevirinin otomatik üretildiğini belirten küçük bir işaret bulunur.

**2. Alerjen bildirimi.** Etiketten okunan alerjen satırı özgün haliyle ve Türkçe çevirisiyle gösterilir. Domuz eti bildirimi varsa bu bölüm belirgin biçimde vurgulanır.

**3. Sorunlu malzemeler.** Karara sebep olan malzemeler listelenir. Her malzeme için etiketteki özgün yazımı, Türkçe karşılığı, kaynak bilgisi ve mezhep bazlı hüküm gösterilir. Her malzeme kartı dokunulduğunda açılıp gerekçeyi gösterir.

**4. Mezhep karşılaştırma tablosu.** Satırlarda malzemeler, sütunlarda dört mezhep bulunur. Tablo yatay kaydırılabilir bir kutu içindedir.

**5. Gerekçeler.** Mezhepler arasındaki farkın hangi fıkhi ilkeden kaynaklandığı sade bir dille açıklanır.

**6. Okunan ham metin.** Kullanıcı okumanın doğru çalışıp çalışmadığını görebilir. Yanlış okuma varsa metni düzenleyip yeniden analiz başlatabilir.

**7. Uyarı metni.** Sonuçların bilgilendirme amaçlı olduğu, dini bir fetva niteliği taşımadığı ve kesin bilgi için resmi helal belgelendirme kuruluşlarına başvurulması gerektiği belirtilir.

---

## 10. Sonuç Nesnesi

Sunucu şu yapıda bir nesne döndürür. Zod şemasını `src/lib/schemas.ts` altında tanımla.

```typescript
{
  scanId: string;
  detectedLanguage: "ja" | "ko" | "zh_hans" | "zh_hant" | "en" | "other";
  verdict: "helal" | "haram" | "supheli" | "mezhebe_gore_degisir";
  madhhabVerdicts: {
    hanefi: "helal" | "haram" | "supheli";
    safii: "helal" | "haram" | "supheli";
    maliki: "helal" | "haram" | "supheli";
    hanbeli: "helal" | "haram" | "supheli";
  };
  translation: {
    rawBlock: string;          // Etiketten okunan içindekiler metninin tamamı
    fluentTr: string;          // Metnin tamamının akıcı Türkçe çevirisi
    lines: Array<{
      rawText: string;         // Etiketteki özgün yazım
      translationTr: string;   // Türkçe karşılığı
      translationSource: "database" | "model";
      status: "helal" | "haram" | "supheli" | "bilinmiyor";
    }>;
  };
  allergenLine: {
    rawText: string | null;
    translationTr: string | null;
    containsPork: boolean;
  };
  problematicIngredients: Array<{
    rawText: string;
    matchedNameTr: string;
    sourceHint: string | null;
    resolvedSource: string | null;
    insCode: string | null;
    matchConfidence: number;
    matchMethod: "exact" | "alias" | "fuzzy" | "embedding" | "unmatched";
    rulings: Array<{
      madhhab: string;
      status: string;
      principleKey: string;
      reasoningTr: string;
      sourceRef: string;
    }>;
  }>;
  unmatchedCount: number;
}
```

---

## 11. Yapay Zeka Katmanı Kuralları

Model çağrılarını `src/lib/ai` altında topla ve sağlayıcıdan bağımsız bir arayüz arkasına al. Farklı sağlayıcılar arasında yapılandırma ile geçiş yapılabilmelidir.

Modele verilecek sistem talimatında şu kurallar bulunmalıdır.

* Model yalnızca metin çıkarma, dil tespiti, malzeme adı normalleştirme ve çeviri yapar.
* Model hiçbir koşulda helal veya haram hükmü vermez. Çeviri metnine dini yorum eklemez.
* Model bir malzemeyi tanımıyorsa tahmin yürütmez ve `null` döndürür.
* Model, etiketteki özgün yazımı asla değiştirmez veya düzeltmez. Özgün yazım `rawText` alanında olduğu gibi korunur.
* Model her malzeme için ayrı ayrı Türkçe çeviri üretir. Çeviri kısa ve teknik olarak doğru olmalıdır, açıklama içermez.
* Model parantez içindeki kaynak bilgisini ayrı alan olarak çıkarır.
* Model alerjen satırını ayrı alan olarak çıkarır.
* Model dikey yazımlı metinleri doğru sırayla okur.
* Model çıktıyı yalnızca istenen JSON şemasında verir. Ek açıklama yazmaz.

Bu ayrım hayati önemdedir. Dil modelleri dini hüküm konusunda hata yapabilir ve bu hatalar kullanıcı açısından ciddi sonuçlar doğurur. Hüküm üretme yetkisi yalnızca veritabanındadır.

Model çıktısını zod ile doğrula. Şemaya uymayan çıktı için bir kez yeniden dene. İkinci denemede de başarısız olursa kullanıcıya okuma başarısız mesajı göster. Şemaya uymayan çıktıyı asla kısmen kullanma.

---

## 12. Hata ve Kenar Durumları

Şu durumların tamamı ele alınmalıdır.

* Fotoğrafta hiç metin bulunamaması
* Okunan metnin içindekiler listesi olmaması, örnek olarak besin değerleri tablosunun çekilmesi
* İçindekiler başlığının bulunamaması
* Dikey yazımlı etiketin yanlış sırayla okunması
* Parlama, buruşukluk veya kavisli ambalaj sebebiyle kısmi okuma
* Etiketin beklenmeyen bir dilde olması
* Tarayıcının kamera erişimini desteklememesi veya iznin reddedilmesi
* Bağlantının kopması veya çok yavaş olması. Yükleme sırasında iptal butonu bulunmalıdır.
* Sunucu hatası veya zaman aşımı
* Model çıktısının şemaya uymaması
* Kullanıcının analiz sırasında sayfayı arka plana alması

Her hata durumunda kullanıcıya ne yapması gerektiğini söyleyen somut bir mesaj göster. Teknik hata kodu gösterme.

---

## 13. Dağıtım Bilgileri

Bu bilgiler dokuzuncu fazda kullanılacaktır.

* **Alan adı:** `edibel.talhaonur.com`. DNS kaydı hazırdır ve sunucuya yönlendirilmiştir.
* **Kapsayıcı portu:** Sunucuda başka servisler çalıştığı için 3000 ve 3006 gibi yaygın portlar dolu olabilir. Uygulamayı `127.0.0.1:3200` üzerine bağla. Aynı şekilde PostgreSQL de yalnızca yerel arayüze bağlanır.
* **Ana bilgisayara bağlama kuralı:** Hiçbir kapsayıcı `0.0.0.0` üzerine bağlanmaz. Docker, ana bilgisayarın güvenlik duvarı kurallarını atlar ve bu durumda servis farkında olmadan doğrudan internete açık kalır. Bütün port eşlemelerini `127.0.0.1:PORT:PORT` biçiminde yaz.
* **nginx:** `edibel.talhaonur.com` için ayrı bir sunucu bloğu oluştur. `127.0.0.1:3200` adresine ters vekil yap. HTTP isteklerini HTTPS'e yönlendir.
* **TLS:** Certbot ile sertifika alınır. Tarayıcı kamerası yalnızca güvenli bağlamda çalıştığı için TLS zorunludur, isteğe bağlı değildir.
* **Yükleme boyutu:** nginx tarafında `client_max_body_size` değerini 10 megabayt yap. Görüntüler tarayıcıda küçültülüyor, bu değer rahat bir üst sınırdır.
* **Zaman aşımı:** Model çağrısı uzun sürebilir. nginx tarafında `proxy_read_timeout` değerini 120 saniye yap.
* **Kimlik doğrulama:** Uygulama herkese açıktır, önüne kimlik doğrulama katmanı konmaz. Yalnızca `/admin` yolundaki yönetim sayfası korunur.
* **Ortam değişkenleri:** `.env.example` dosyasında şunlar bulunur: `DATABASE_URL`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, `NEXT_PUBLIC_APP_URL`, `ADMIN_TOKEN`. Gerçek değerler yalnızca `.env` içinde bulunur ve depoya asla yazılmaz.
* **Next.js yapılandırması:** `output: "standalone"` kullanılır. Bu, kapsayıcı boyutunu belirgin biçimde küçültür.

---

## 14. Geliştirme Fazları

Fazları sırayla tamamla. Her fazın sonunda dur ve bana durum raporu ver. Onay almadan bir sonraki faza geçme. Her faz üretim kalitesinde tamamlanır. Geçici çözüm veya yer tutucu bırakma.

**Faz 1: İskelet.** Next.js projesini kur. Docker Compose ile PostgreSQL'i `pg_trgm` ve `pgvector` eklentileriyle ayağa kaldır. `/api/health` rotası çalışsın. `.env.example` dosyasını hazırla. PWA bildirim dosyasını ve Edibel simgelerini ekle.

**Faz 2: İçerik veritabanı.** Drizzle şemasını yaz ve göç dosyalarını üret. Bu fazda örnek veri değil, üretimde kullanılacak gerçek içerik veritabanının ilk sürümü hazırlanır. Kapsam şudur.

* Beşinci bölümdeki tabloların tamamındaki maddeler
* Doğu Asya paketli gıdalarında yaygın olan en az iki yüz malzeme
* Her malzeme için Japonca, Korece, basitleştirilmiş Çince ve geleneksel Çince takma adlar ve bunların Türkçe karşılıkları
* Her malzeme için dört mezhebin hükmü ve kaynak referansı
* `source_hints` tablosunun her dilde doldurulması
* `fiqh_principles` tablosunun yedinci bölümdeki ilkelerle doldurulması

İçerik dosyalarını `data/ingredients` altında dile göre ayrılmış JSON dosyaları olarak tut. Veriyi yükleyen betiği yaz ve betik tekrar çalıştırıldığında veriyi bozmayacak biçimde kur.

**Faz 3: Ayrıştırma ve normalleştirme.** Beşinci bölümdeki bütün kuralları uygulayan modülü yaz. Başlık tespiti, alerjen satırı ayrıştırma, parantez ayrıştırma, Unicode normalleştirme ve yazı sistemi tespiti bu fazda tamamlanır.

**Faz 4: Eşleştirme motoru.** Dört eşleştirme yöntemini sırayla uygulayan modülü yaz. Eşleşmeyen terimleri `unmatched_terms` tablosuna kaydet. Gömme vektörlerini üreten betiği `scripts` altına yaz. Bu betik geliştirme makinesinde çalıştırılacaktır.

**Faz 5: Karar motoru.** Yedinci bölümdeki toplama kurallarını uygulayan modülü yaz. Bu modül saf fonksiyonlardan oluşmalıdır ve yan etkisi bulunmamalıdır. Her kuralın kod içinde hangi maddeye karşılık geldiğini yorum satırıyla belirt.

**Faz 6: Yapay zeka entegrasyonu.** Görme modeli çağrısını, sağlayıcıdan bağımsız arayüzü, çeviri üretimini ve zod doğrulamasını ekle.

**Faz 7: Arayüz.** Sekizinci ve dokuzuncu bölümlerdeki bütün kuralları uygulayarak ekranları yaz. Kamera erişiminin iki yolunu da uygula. İçindekiler tercümesi bölümüne özel dikkat göster, bu bölüm uygulamanın ayırt edici özelliğidir. Türkçe arayüz metinlerini tek bir sözlük dosyasında tut.

**Faz 8: Tamamlayıcı özellikler.** Geçmiş taramalar, mezhep tercihi ayarı, çevrimdışı davranış, hata ekranları ve `/admin` altındaki `unmatched_terms` yönetim sayfası tamamlanır.

**Faz 9: Dağıtım.** On üçüncü bölümdeki bilgileri kullanarak şunları hazırla.

* Üretim için çok aşamalı Dockerfile
* `deploy/compose.prod.yml` dosyası
* `deploy/nginx/edibel.talhaonur.com.conf` dosyası
* Certbot ile sertifika alma adımlarını anlatan `deploy/README.md`
* Veritabanı yedekleme betiği
* Hız sınırlama. Cihaz başına dakikada en fazla on tarama.
* Yapılandırılmış günlük kaydı. Kişisel veri günlüğe yazılmaz.

---

## 15. Kısıtlar ve Çalışma Kuralları

* Her fazın sonunda dur ve onay iste.
* Otomatik test paketi kurma. Bunun yerine her fazın sonunda, o fazda yazılan kodun ne yaptığını, hangi durumları ele aldığını ve hangi durumları ele almadığını anlatan kısa bir doğrulama notu sun.
* İçerik veritabanındaki her hüküm kaydında kaynak referansı bulunmalıdır. Kaynağı olmayan kayıt eklenmez.
* Sahte veri, yer tutucu metin veya geçici çözüm bırakma. Bir şeyi tamamlayamıyorsan bana söyle.
* API anahtarlarını asla depoya yazma. Model çağrıları yalnızca sunucu tarafında yapılır, anahtar tarayıcıya gönderilmez.
* Depoya gizli bilgi içeren dağıtım dosyası koyma. `deploy/README.md` içinde gerçek anahtar, parola veya sunucu adresi bulunmaz.
* Uygulama içindeki uyarı metnini kaldırma veya küçültme.
* Kullanıcı fotoğrafları sunucuda saklanmaz.
* Etiketten okunan özgün metin ve çevirisi hiçbir ekranda gizlenmez.
* Çeviri hiçbir zaman karar mantığına girdi olmaz. Eşleştirme yalnızca özgün metin üzerinden yapılır.
* Karar mantığında yorum yaptığın her yere, hangi fıkhi ilkeye dayandığını belirten bir açıklama satırı ekle.