# OSINT Lead Tool

Универсална B2B/локална система за генериране на лийдове и (по-късно) аутрийч.
Намира бизнеси по локация + индустрия, нормализира ги в стандартен `Lead`, пази ги
в **Upstash Redis**, филтрира комбинируемо и експортира CSV.

Стек: **Next.js (App Router) + TypeScript + Tailwind**, база **Upstash Redis**,
деплой на **Vercel**.

## Какво прави тази версия (Фаза 1 + старт на Фаза 2)

- Източник **OSM / Overpass** (безплатно, по подразбиране).
- Източник **Google Places** (зад `GOOGLE_MAPS_API_KEY`).
- Стандартизиран `Lead` модел + съхранение в Upstash с дедупликация.
- Комбинируеми филтри: гео, индустрия, без/със сайт, контакти, качество, статус.
- CSV експорт.
- Просто уеб UI за търсене, филтриране и сваляне.

Следващите фази (имейл enrichment, dashboard, аутрийч, аналитика) са скицирани в
`lib/enrichment/` и `lib/outreach/`.

## Локален старт

```bash
npm install
cp .env.example .env.local     # попълни UPSTASH_* (и по избор GOOGLE_MAPS_API_KEY)
npm run dev                    # http://localhost:3000
```

За `UPSTASH_*` стойностите: направи безплатна Redis база в
[Upstash](https://upstash.com) (или добави storage-а във Vercel — виж по-долу) и
копирай REST URL + TOKEN.

### Пример за ползване

1. Източник **OSM**, локация `Plovdiv`, индустрия **Ресторант** → **Събери**.
2. Филтър **без сайт** + **има телефон** → **Приложи филтри**.
3. **Свали CSV**.

## Деплой на Vercel

1. `git push` към GitHub repo-то.
2. Vercel → **Import** repo-то.
3. Vercel → **Storage** → добави **Upstash Redis** към проекта — `UPSTASH_REDIS_REST_URL`
   и `UPSTASH_REDIS_REST_TOKEN` се добавят автоматично.
4. Vercel → **Settings → Environment Variables** → добави `GOOGLE_MAPS_API_KEY`
   (по избор, ако ще ползваш Google източника).
5. **Deploy**.

## Структура

```
app/            Next.js страница + API маршрути (collect / leads / export / stats)
components/     UI компоненти (форма, таблица, статистики)
lib/
  sources/      източници (osm, googlePlaces) + регистър
  storage/      repository (upsert с дедуп/индекси, заявки, статистики)
  filters/      парсване и прилагане на филтри
  utils/        http (retry/кеш), dedup, quality
  types.ts      Lead модел + FilterSpec
  industries.ts речник на индустриите (разширяем)
```

## Забележки

- API ключове само през environment променливи — никога в кода.
- OSM/Nominatim се ползват учтиво (User-Agent, кеш, backoff).
- Google Places харчи кредити на заявка — ползвай лимита в UI.
