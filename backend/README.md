# Lead backend

## Быстрый локальный запуск (VS Code)

1. В первом терминале запустите backend:

```bash
python backend/server.py
```

2. Во втором терминале запустите статику сайта:

```bash
python -m http.server 5500
```

3. Откройте `http://127.0.0.1:5500/contacts.html`.

> В локальном режиме frontend автоматически отправляет заявки на `http://127.0.0.1:8080/api/leads`,
> даже если страница открыта с другого порта (например, 5500).

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
