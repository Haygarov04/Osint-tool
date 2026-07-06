# enrichment/ — Фаза 3 (обогатяване с контакти)

Стъб за следващата фаза. Тук ще влязат модули за:

- Намиране на имейли по домейн/име (Hunter.io / Apollo / findymail).
- Верификация на имейли (MX + SMTP проверка) → попълва `lead.emailVerified`.
- Намиране на соц. профили (Facebook / Instagram / LinkedIn).
- Обновяване на `quality_score` след обогатяване.

Всеки модул ще работи срещу стандартния `Lead` от `lib/types.ts` и ще ползва
`upsertMany` от `lib/storage/repository.ts`, за да записва обогатените данни.
