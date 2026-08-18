/* Anonim cihaz kimliği; yalnızca tarama kayıtlarını ilişkilendirmek için */
const KEY = "edibel-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
