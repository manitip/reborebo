# Lead backend

Запуск:

```bash
python3 backend/server.py
```

## Переменные окружения

- `PORT` (по умолчанию `8080`)
- `MANAGER_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `BITRIX24_WEBHOOK` **или** `AMOCRM_WEBHOOK`
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SEC`

## API

- `POST /api/leads` — прием заявки (multipart/form-data)
- `PATCH /api/leads/{id}/status` — смена статуса заявки (`new`, `in_progress`, `waiting_clarification`, `quote_sent`, `completed`, `cancelled`)
- `GET /health` — healthcheck

Заявки сохраняются в SQLite: `backend/leads.db`.
Даже при ошибке интеграции CRM заявка остается в БД, а ошибка записывается в `crm_error`.
