/*
 * Mezheplerin ekranda gösterim sırası.
 *
 * Bu sabit, karar motorundaki MADHHABS ile aynı listedir ama arayüz için
 * AYRI tutulur: @/lib/verdict paketi hüküm okuma katmanını (veritabanı
 * istemcisini) de dışa aktarır ve istemci bileşeninden içe aktarıldığında
 * postgres sürücüsü tarayıcı paketine girmeye çalışır, derleme "Module not
 * found: Can't resolve 'fs'" hatasıyla düşer.
 */
export const MADHHAB_ORDER = ["hanefi", "safii", "maliki", "hanbeli"] as const;

export type MadhhabName = (typeof MADHHAB_ORDER)[number];
