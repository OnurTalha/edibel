-- Eşleştirme motorunun ihtiyaç duyduğu eklentiler.
-- pg_trgm: bulanık (trigram) eşleştirme, Katman 4'ün üçüncü yöntemi.
-- vector (pgvector): anlamsal gömme vektörü eşleştirmesi, dördüncü yöntem.
-- Bu betik, veritabanı kapsayıcısının ilk açılışında otomatik çalışır.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
