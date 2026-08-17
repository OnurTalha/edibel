/*
 * Karakter normalleştirme (bkz. CLAUDE.md, Bölüm 5.4).
 *
 * Sıra önemlidir:
 *  1. Unicode NFKC — tam genişlikli karakterleri (Ａ, １, （) yarım
 *     genişlikliye çevirir.
 *  2. Ayırıcı birleştirme — 、 ve ， tek ayırıcıya (,) indirilir.
 *  3. Boşluk temizliği — Doğu Asya karakterleri arasındaki yapay boşluklar
 *     (okuma katmanının eklediği) kaldırılır.
 *
 * Katakana/hiragana katlaması ve basitleştirilmiş/geleneksel Çince eşlemesi
 * eşleştirme anında (Faz 4) kullanılmak üzere burada fonksiyon olarak sunulur;
 * görüntülenen metne uygulanmaz.
 */

const CJK_CLASS =
  "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\u3001-\\u303F";

const SPACE_BETWEEN_CJK = new RegExp(
  `(?<=[${CJK_CLASS}])[ \\t\\u00A0]+(?=[${CJK_CLASS}])`,
  "gu",
);

export function normalizeText(input: string): string {
  let t = input.normalize("NFKC");
  t = t.replace(/\r\n?/g, "\n");
  /* Ayırıcı birleştirme: ideografik virgül ve tam genişlikli virgül → , */
  t = t.replace(/[、，]/g, ",");
  /* Doğu Asya karakterleri arasındaki yapay boşluklar kaldırılır */
  t = t.replace(SPACE_BETWEEN_CJK, "");
  /* Art arda boşluk ve boş satırların sadeleştirilmesi */
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

/* Katakana → hiragana; Japonca yazım farkı toleransı için (eşleştirme anında) */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/* Hiragana → katakana */
export function hiraganaToKatakana(text: string): string {
  return text.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60),
  );
}

/*
 * Geleneksel ↔ basitleştirilmiş Çince eşlemesi.
 *
 * Birincil mekanizma, takma ad tablosunun iki yazımı da içermesidir; bu tablo
 * yalnızca gıda etiketi alanında sık geçen karakterler için eşleştirme anında
 * ek tolerans sağlar. Genel amaçlı tam bir dönüştürücü değildir.
 * Biçim: [geleneksel, basitleştirilmiş]
 */
const HANT_HANS_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["豬", "猪"], ["雞", "鸡"], ["魚", "鱼"], ["蝦", "虾"], ["膠", "胶"],
  ["醬", "酱"], ["麵", "面"], ["麥", "麦"], ["鹽", "盐"], ["紅", "红"],
  ["黃", "黄"], ["藍", "蓝"], ["綠", "绿"], ["劑", "剂"], ["澱", "淀"],
  ["變", "变"], ["纖", "纤"], ["維", "维"], ["鈉", "钠"], ["鉀", "钾"],
  ["鈣", "钙"], ["鎂", "镁"], ["鐵", "铁"], ["鈦", "钛"], ["調", "调"],
  ["蔥", "葱"], ["薑", "姜"], ["蘿", "萝"], ["蔔", "卜"], ["馬", "马"],
  ["鈴", "铃"], ["欖", "榄"], ["櫚", "榈"], ["發", "发"], ["麴", "曲"],
  ["鳥", "鸟"], ["穀", "谷"], ["蟲", "虫"], ["蠟", "蜡"], ["蘭", "兰"],
  ["蘇", "苏"], ["棗", "枣"], ["棄", "弃"], ["醯", "酰"], ["飴", "饴"],
  ["糊", "糊"], ["蔗", "蔗"], ["蜜", "蜜"], ["釀", "酿"], ["榨", "榨"],
  ["雙", "双"], ["單", "单"], ["聚", "聚"], ["椰", "椰"], ["醇", "醇"],
  ["酶", "酶"], ["蛋", "蛋"], ["糖", "糖"], ["鹼", "碱"], ["梘", "枧"],
  ["滷", "卤"], ["醚", "醚"], ["苯", "苯"], ["酚", "酚"], ["醛", "醛"],
  ["氫", "氢"], ["氧", "氧"], ["磷", "磷"], ["醋", "醋"], ["檸", "柠"],
  ["檬", "檬"], ["蘋", "苹"], ["橙", "橙"], ["葡", "葡"], ["萄", "萄"],
  ["棕", "棕"], ["櫻", "樱"], ["蝦", "虾"], ["蟹", "蟹"], ["貝", "贝"],
  ["蠔", "蚝"], ["鰹", "鲣"], ["鱈", "鳕"], ["鰻", "鳗"], ["魷", "鱿"],
  ["賊", "贼"], ["墨", "墨"], ["蜆", "蚬"], ["蛤", "蛤"], ["牡", "牡"],
  ["蠣", "蛎"], ["藻", "藻"], ["帶", "带"], ["紫", "紫"], ["菜", "菜"],
  ["蘑", "蘑"], ["菇", "菇"], ["針", "针"], ["雲", "云"], ["靈", "灵"],
  ["營", "营"], ["養", "养"], ["強", "强"], ["寧", "宁"], ["體", "体"],
  ["粧", "妆"], ["漿", "浆"], ["滲", "渗"], ["過", "过"], ["敏", "敏"],
  ["質", "质"], ["產", "产"], ["製", "制"], ["嬰", "婴"], ["兒", "儿"],
  ["適", "适"], ["標", "标"], ["準", "准"], ["劲", "劲"], ["穀", "谷"],
];

const hantToHansMap = new Map<string, string>();
const hansToHantMap = new Map<string, string>();
for (const [hant, hans] of HANT_HANS_PAIRS) {
  if (hant !== hans) {
    hantToHansMap.set(hant, hans);
    if (!hansToHantMap.has(hans)) hansToHantMap.set(hans, hant);
  }
}

export function traditionalToSimplified(text: string): string {
  return [...text].map((ch) => hantToHansMap.get(ch) ?? ch).join("");
}

export function simplifiedToTraditional(text: string): string {
  return [...text].map((ch) => hansToHantMap.get(ch) ?? ch).join("");
}

/* Yazı sistemi tespitinde kullanılan ayırt edici karakter kümeleri */
export const TRADITIONAL_ONLY_CHARS = new Set(hantToHansMap.keys());
export const SIMPLIFIED_ONLY_CHARS = new Set(hansToHantMap.keys());
