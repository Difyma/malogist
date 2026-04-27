# MaLogist

Fullstack MVP: frontend на React (Vite), backend на Node.js (Express).

## Запуск

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

## Backend env

Скопируйте `backend/.env.example` в `backend/.env`.

```bash
cp backend/.env.example backend/.env
```

Для тестовой отправки в Telegram заполните:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `JWT_SECRET` (для auth)
- `REDIS_URL` (для очередей/воркеров)
- `DATABASE_URL` (если нужен PostgreSQL)
- `USE_MOCK_DB=true|false` (`true` по умолчанию для локального демо)

## Архитектурный каркас MVP

- API: Express с модульными роутами (`auth/accounts/products/stocks/sales/forecast/recommendations/notifications`)
- База: PostgreSQL schema в [`backend/src/db/schema.sql`](/Users/dmitriifyrfa/Projects/MaLogist/backend/src/db/schema.sql)
- Интеграции: единый MarketplaceAdapter (`wb/ozon/yandex`) в `backend/src/integrations/*`
- Очереди: BullMQ + Redis (`sync-products`, `sync-warehouses`, `sync-stocks`, `sync-orders`, `sync-sales`, `sync-tariffs`, `aggregate-sales-daily`, `forecast-generate`, `recommendations-generate`, `notifications-send`)
- Воркеры: [`backend/src/workers/index.js`](/Users/dmitriifyrfa/Projects/MaLogist/backend/src/workers/index.js)

Demo auth:

- email: `demo@malogist.ru`
- password: `demo12345`

## Backend scripts

```bash
npm run dev --prefix backend          # API
npm run dev:worker --prefix backend   # workers
npm run jobs:enqueue --prefix backend # enqueue demo jobs
npm run db:init --prefix backend      # создать schema в PostgreSQL
npm run db:seed --prefix backend      # наполнить PostgreSQL demo-данными
```

Для запуска на PostgreSQL:

1. В `backend/.env`: `USE_MOCK_DB=false` и валидный `DATABASE_URL`
2. Выполнить `npm run db:init` и `npm run db:seed`
3. Запустить API (`npm run dev --prefix backend`)

## API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/accounts`
- `GET /api/accounts`
- `GET /api/products?search=&category=&stockStatus=`
- `PATCH /api/products/:id/rules`
- `GET /api/stocks`
- `GET /api/stocks/product/:productId`
- `GET /api/stocks/critical?days=5`
- `GET /api/sales/daily`
- `GET /api/sales/by-region`
- `GET /api/sales/by-warehouse`
- `GET /api/sales/product/:productId`
- `POST /api/forecast/run`
- `GET /api/forecast/latest?accountId=1`
- `GET /api/forecast/product/:productId?accountId=1`
- `GET /api/forecast/settings?accountId=1`
- `PATCH /api/forecast/settings?accountId=1`
- `GET /api/recommendations?accountId=1`
- `GET /api/recommendations/critical?accountId=1`
- `POST /api/recommendations/generate`
- `POST /api/recommendations/export`
- `GET /api/notifications` (auth)
- `PATCH /api/notifications/settings` (auth)
- `POST /api/notifications/test`
- `GET /api/integrations` (auth)
- `POST /api/integrations/connect` (auth)
- `POST /api/integrations/:id/test` (auth)
- `POST /api/integrations/:id/sync` (auth)

Backward-compatible endpoints for current frontend:

- `GET /api/landing-data`
- `GET /api/critical-skus?days=5`
- `POST /api/supply-plan`
- `GET /api/supply-plan-export?horizonDays=28&selectedSkus=SKU%20123,SKU%20789`
- `POST /api/notifications/telegram/test`
