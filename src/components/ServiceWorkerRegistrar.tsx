"use client";

import { useEffect } from "react";

/*
 * Hizmet çalışanını kaydeder (bkz. public/sw.js).
 * Geliştirmede kayıt yapılmaz; geliştirme sunucusunun ürettiği dosyalar
 * önbelleğe alınırsa bayat içerik sorunları çıkar. Daha önce kaydedilmiş
 * bir çalışan varsa geliştirmede kaldırılır.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => undefined);
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Kayıt başarısız olursa uygulama çevrimiçi olarak normal çalışır */
    });
  }, []);

  return null;
}
