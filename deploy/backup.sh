#!/usr/bin/env bash
# Edibel veritabanı yedekleme betiği (bkz. CLAUDE.md, Faz 9).
#
# Kullanım (sunucuda, deploy dizininden):
#   ./backup.sh                 -> deploy/backups altına sıkıştırılmış yedek
#   BACKUP_DIR=/yol ./backup.sh -> başka bir dizine yedek
#
# Betik gizli bilgi içermez; kullanıcı adı ve veritabanı adı deploy/.env
# dosyasından okunur, parola kapsayıcının kendi ortamından gelir.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/compose.prod.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "HATA: ${ENV_FILE} bulunamadı. deploy/.env.example dosyasını kopyalayın." >&2
  exit 1
fi

# Yalnızca ihtiyaç duyulan iki değişken okunur
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | cut -d= -f2-)"

if [[ -z "${POSTGRES_USER}" || -z "${POSTGRES_DB}" ]]; then
  echo "HATA: POSTGRES_USER veya POSTGRES_DB deploy/.env içinde tanımlı değil." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/edibel-${TIMESTAMP}.sql.gz"

echo "Yedek alınıyor: ${TARGET}"
docker compose -f "${COMPOSE_FILE}" exec -T db \
  pg_dump --clean --if-exists --no-owner --no-privileges \
  -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip -9 > "${TARGET}"

chmod 600 "${TARGET}"

# Boş veya bozuk yedek bırakılmaz
if [[ ! -s "${TARGET}" ]]; then
  echo "HATA: yedek dosyası boş, siliniyor." >&2
  rm -f "${TARGET}"
  exit 1
fi

echo "Yedek tamam: $(du -h "${TARGET}" | cut -f1)"

# Eski yedekleri temizle
find "${BACKUP_DIR}" -name 'edibel-*.sql.gz' -type f -mtime "+${KEEP_DAYS}" -print -delete

# Geri yükleme:
#   gunzip -c edibel-YYYYMMDD-HHMMSS.sql.gz | \
#     docker compose -f compose.prod.yml exec -T db \
#     psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
