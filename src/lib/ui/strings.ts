/*
 * Türkçe arayüz metinleri — tek sözlük dosyası (bkz. CLAUDE.md, Faz 7).
 * Arayüzde serbest metin kullanılmaz; her metin buradan gelir.
 */
export const STR = {
  appName: "Edibel",
  appTagline:
    "Paketli gıdaların içindekiler etiketini fotoğraflayın, helal analizini ve Türkçe çevirisini görün.",
  appHint: "Japonca, Korece ve Çince etiketleri okur.",

  scan: "Etiketi Tara",
  scanDescription: "İçindekiler bölümünü fotoğraflayın",

  cameraModeTitle: "Kamera yöntemi",
  cameraModePrimary: "Telefon kamerası",
  cameraModeLive: "Canlı görüntü",
  cameraModeHelp:
    "Telefon kamerası daha yüksek çözünürlük verir; canlı görüntü hizalama çerçevesi gösterir.",
  primaryModeHint:
    "Etiketin içindekiler bölümünü yakından, parlamasız ve net çekin. Fotoğrafı çektikten sonra yalnızca içindekiler listesini kırpacaksınız.",
  takePhoto: "Fotoğraf çek",
  pickPhoto: "Galeriden seç",
  capture: "Çek",
  liveCameraHint: "İçindekiler bölümünü çerçeveye hizalayın",
  liveCameraStarting: "Kamera açılıyor...",
  flashOn: "Flaşı aç",
  flashOff: "Flaşı kapat",
  cameraDenied:
    "Kamera erişimine izin verilmedi. Tarayıcı ayarlarından izin verebilir veya aşağıdaki butonla telefon kamerasıyla çekebilirsiniz.",
  cameraUnavailable:
    "Bu tarayıcıda canlı kamera kullanılamıyor. Telefon kamerasıyla çekmek için aşağıdaki butonu kullanın.",
  cameraInsecure:
    "Canlı kamera yalnızca güvenli bağlantıda (https) çalışır. Telefon kamerasıyla çekmek için aşağıdaki butonu kullanın.",
  useDeviceCamera: "Telefon kamerasıyla çek",
  imageLoadFailed:
    "Fotoğraf açılamadı. Lütfen başka bir fotoğraf çekip tekrar deneyin.",

  cropTitle: "İçindekiler bölümünü seçin",
  cropHint:
    "Parmaklarınızla yakınlaştırıp kaydırarak yalnızca içindekiler listesini çerçeveye alın.",
  cropConfirm: "Analiz Et",
  cropRetake: "Yeniden çek",

  analysisTitle: "Analiz ediliyor",
  analysisSteps: [
    "Etiket okunuyor",
    "Dil tespit ediliyor",
    "Çeviri yapılıyor",
    "Malzemeler ayrıştırılıyor",
    "Veritabanı sorgulanıyor",
    "Sonuç hazırlanıyor",
  ],
  analysisCancel: "İptal",
  analysisKeepOpen: "Analiz sürerken uygulamayı kapatmayın.",
  analysisCancelled: "Analiz iptal edildi. Dilerseniz yeniden deneyebilirsiniz.",
  analysisFailedTitle: "Analiz tamamlanamadı",
  retry: "Tekrar dene",

  verdictLabels: {
    helal: "HELAL",
    haram: "HARAM",
    supheli: "ŞÜPHELİ",
    mezhebe_gore_degisir: "MEZHEBE GÖRE DEĞİŞİR",
  } as Record<string, string>,
  verdictSub: {
    helal: "Tüm malzemeler dört mezhebe göre uygun görünüyor.",
    haram: "Listede dört mezhebe göre de haram olan malzeme var.",
    supheli: "Emin olunamayan malzemeler var; temkinli olun.",
    mezhebe_gore_degisir: "Hüküm, mezhebe göre farklılık gösteriyor.",
  } as Record<string, string>,
  madhhabNames: {
    hanefi: "Hanefi",
    safii: "Şafii",
    maliki: "Maliki",
    hanbeli: "Hanbeli",
  } as Record<string, string>,
  statusLabels: {
    helal: "helal",
    haram: "haram",
    supheli: "şüpheli",
    mekruh: "mekruh",
    bilinmiyor: "bilinmiyor",
  } as Record<string, string>,
  languageNames: {
    ja: "Japonca",
    ko: "Korece",
    zh_hans: "Çince (Basitleştirilmiş)",
    zh_hant: "Çince (Geleneksel)",
    en: "İngilizce",
    other: "Belirlenemedi",
  } as Record<string, string>,
  verdictBadgesTitle: "Uygun olduğu mezhepler",
  verdictDiffTitle: "Mezheplere göre",
  unmatchedNote: (n: number) =>
    `${n} malzeme veritabanında bulunamadı; bu malzemeler helal sayılmaz.`,
  scrollForDetails: "Detaylar",

  sectionTranslation: "İçindekiler tercümesi",
  translationViewLines: "Satır satır",
  translationViewFluent: "Akıcı çeviri",
  modelTranslationMark: "otomatik",
  modelTranslationNote:
    "“otomatik” işaretli çeviriler yapay zeka tarafından üretilmiştir; diğer çeviriler denetlenmiş veritabanından gelir.",
  untranslated: "(çevrilemedi)",
  translationEmpty: "Çeviri üretilemedi.",

  sectionAllergen: "Alerjen bildirimi",
  allergenPorkWarning: "Bu üründe domuz eti bildirimi var.",
  allergenNone: "Etikette alerjen bildirimi bulunamadı.",
  allergenOriginalLabel: "Etiketteki bildirim",
  allergenTranslationLabel: "Türkçe karşılığı",

  sectionProblematic: "Sorunlu malzemeler",
  problematicNone:
    "Karara olumsuz etki eden malzeme bulunmadı; tüm malzemeler veritabanında helal olarak kayıtlı.",
  matchMethodLabels: {
    exact: "birebir eşleşme",
    alias: "yazım varyantı ile eşleşme",
    fuzzy: "yaklaşık eşleşme",
    embedding: "anlamsal eşleşme",
    unmatched: "veritabanında bulunamadı",
  } as Record<string, string>,
  sourceLabel: "Kaynak",
  sourceHintLabel: "Etiketteki kaynak ifadesi",
  matchLabel: "Eşleşme",
  insLabel: "INS numarası",
  rulingsTitle: "Mezhep hükümleri",
  sourceNames: {
    domuz: "domuz",
    sigir: "sığır",
    tavuk: "tavuk",
    balik: "balık",
    soya: "soya",
    misir: "mısır",
    palm: "palmiye",
    bitkisel: "bitkisel",
    mikrobiyal: "mikrobiyal",
    sentetik: "sentetik",
    bilinmiyor: "bilinmiyor",
  } as Record<string, string>,
  sourceRefLabel: "Kaynak",
  unmatchedIngredientNote:
    "Bu malzeme veritabanında bulunamadı. Sistem, emin olmadığı hiçbir malzemeyi helal saymaz.",
  expandDetails: "Gerekçeyi göster",
  collapseDetails: "Gerekçeyi gizle",

  sectionMadhhabTable: "Mezhep karşılaştırması",
  tableIngredient: "Malzeme",
  tableScrollHint: "Tabloyu yana kaydırabilirsiniz.",

  sectionPrinciples: "Gerekçeler",
  principlesIntro:
    "Mezhepler arasındaki fark aşağıdaki fıkhi ilkelerden kaynaklanır.",

  sectionRawText: "Okunan ham metin",
  rawTextHint:
    "Okuma hatası görüyorsanız metni düzeltip yeniden analiz edebilirsiniz.",
  rawTextLabel: "Etiketten okunan metin",
  reanalyze: "Yeniden analiz et",
  reanalyzing: "Yeniden analiz ediliyor...",
  rawTextEmpty: "Metin boş olamaz.",

  disclaimer:
    "Bu sonuçlar bilgilendirme amaçlıdır ve dini bir fetva niteliği taşımaz. Kesin bilgi için resmi helal belgelendirme kuruluşlarına başvurunuz.",

  /* Faz 8: geçmiş, ayarlar, çevrimdışı, hata ekranları, yönetim sayfası */
  historyLink: "Geçmiş taramalar",
  historyTitle: "Geçmiş taramalar",
  historyEmpty:
    "Henüz tarama yapmadınız. Ana sayfadan ilk taramanızı başlatabilirsiniz.",
  historyStoredNote:
    "Taramalar bu cihaza ait anonim bir kimlikle saklanır. Fotoğraflar sunucuda tutulmaz, yalnızca okunan metin ve sonuç saklanır.",
  historyUnmatched: (n: number) => `${n} bilinmeyen malzeme`,

  settingsLink: "Ayarlar",
  settingsTitle: "Ayarlar",
  settingsMadhhabTitle: "Mezhebiniz",
  settingsMadhhabHelp:
    "Seçim yaparsanız sonuç ekranında önce sizin mezhebinizin hükmü gösterilir. Seçim yapmazsanız dört mezhep birlikte gösterilir. Bu tercih yalnızca gösterimi değiştirir; hüküm her zaman dört mezhep için hesaplanır.",
  settingsMadhhabNone: "Belirtmek istemiyorum",
  settingsCameraTitle: "Kamera yöntemi",
  settingsCameraHelp:
    "Telefon kamerası tam çözünürlüklü fotoğraf verir ve varsayılan yöntemdir. Canlı görüntü sayfa içinde hizalama çerçevesi gösterir.",
  settingsStoredLocally: "Tercihleriniz yalnızca bu cihazda saklanır.",

  verdictAccordingTo: (madhhab: string) => `${madhhab} mezhebine göre`,
  verdictOtherMadhhabs: "Diğer mezhepler",

  offlineBanner: "Çevrimdışısınız. Yeni tarama yapılamaz.",
  offlineTitle: "Bağlantı yok",
  offlineBody:
    "İnternet bağlantısı kurulamadı. Daha önce görüntülediğiniz sonuçlara bakabilir, bağlantı gelince yeni tarama yapabilirsiniz.",
  offlineRetry: "Tekrar dene",

  errorTitle: "Bir sorun oluştu",
  errorBody:
    "Beklenmeyen bir durum oluştu. Sayfayı yenileyip tekrar deneyebilirsiniz.",
  notFoundTitle: "Sayfa bulunamadı",
  notFoundBody:
    "Aradığınız sayfa yok. Ana sayfadan yeni bir tarama başlatabilirsiniz.",

  adminTitle: "Eşleşmeyen terimler",
  adminIntro:
    "Etiketlerde karşılaşılan ancak içerik veritabanında bulunmayan malzeme adları. En sık görülenler önce listelenir.",
  adminTokenLabel: "Yönetim anahtarı",
  adminTokenSubmit: "Giriş",
  adminTokenWrong: "Anahtar doğrulanamadı.",
  adminNotConfigured:
    "Yönetim arayüzü yapılandırılmamış. Sunucuda ADMIN_TOKEN tanımlanmalıdır.",
  adminEmpty: "Eşleşmeyen terim kaydı yok.",
  adminRefresh: "Yenile",
  adminLogout: "Çıkış",
  adminFilter: "Terim ara",
  adminTotal: (n: number) => `${n} terim`,
  adminColumnTerm: "Terim",
  adminColumnLanguage: "Dil",
  adminColumnTranslation: "Model çevirisi",
  adminColumnCount: "Sayı",
  adminColumnLastSeen: "Son görülme",

  newScan: "Yeni tarama",
  back: "Geri",
  loading: "Yükleniyor...",
  resultNotFound:
    "Bu tarama bulunamadı. Ana sayfadan yeni bir tarama başlatabilirsiniz.",
  genericError: "Bir sorun oluştu. Lütfen tekrar deneyin.",
  rateLimited:
    "Kısa sürede çok fazla tarama yaptınız. Lütfen bir dakika bekleyip tekrar deneyin.",
  offlineError:
    "İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.",
  goHome: "Ana sayfa",
} as const;
