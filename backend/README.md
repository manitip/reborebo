# Lead + B2B Catalog backend

## Быстрый локальный запуск

```bash
python backend/server.py
```

## Что реализовано для каталога

- Иерархия каталога: категории/подкатегории, бренды, серии, товары.
- Карточка товара: название, артикул, категория, бренд, описания, изображения, характеристики, область применения, документы, аналоги, сопутствующие товары, наличие, срок поставки, SEO.
- Фильтрация: категория, бренд, тип процесса, материал, наличие, диапазон параметров (`param_name`, `param_min`, `param_max`).
- Поиск по названию и артикулу.
- Массовый импорт товаров из `CSV` и `XLSX`.
- ЧПУ URL по `slug` (`/catalog/<slug>/` в API-ответе).
- Индексация и производительность: отдельные SQL-индексы по полям фильтров и поиска.

## API

### Leads (существующий функционал)

- `POST /api/leads`
- `PATCH /api/leads/{id}/status`
- `GET /health`

### Catalog

- `GET /api/catalog/meta` — дерево справочников (категории, бренды, серии).
- `GET /api/catalog/products` — список товаров + фильтры:
  - `category` (slug), `brand` (slug), `process_type`, `material`, `availability`, `q`
  - `param_name`, `param_min`, `param_max`
- `GET /api/catalog/search?q=` — поиск по названию/артикулу.
- `GET /api/catalog/products/{slug|id}` — карточка товара (описание, характеристики, документы, аналоги, похожие, CTA-кнопки).

### Admin API (создание/обновление)

- `POST /api/admin/products` — создать товар.
- `PUT /api/admin/products/{id}` — обновить товар.
- `POST /api/admin/import` — импорт CSV/XLSX (создание/обновление по `sku`).

## Пример создания товара

```bash
curl -X POST http://127.0.0.1:8080/api/admin/products \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Насос-дозатор 1000",
    "sku":"ND-1000",
    "category":"Насосы",
    "subcategory":"Дозирующие насосы",
    "brand":"AquaTech",
    "series":"ProLine",
    "short_description":"Компактный промышленный насос",
    "full_description":"Подходит для дозирования химических реагентов",
    "process_type":"Дозирование",
    "material":"Нержавеющая сталь",
    "application_area":"Водоподготовка",
    "availability_status":"in_stock",
    "lead_time":"2-3 дня",
    "specs":[{"name":"pressure_bar","value":"12"}],
    "documents":[{"name":"Паспорт","url":"/docs/nd-1000.pdf"}],
    "images":["/img/nd-1000.jpg"],
    "seo_title":"Насос-дозатор ND-1000",
    "seo_description":"Промышленный насос для B2B",
    "seo_keywords":"насос, дозатор, b2b"
  }'
```

## Импорт

В файле (CSV/XLSX) поддерживаются колонки:

- `name`, `sku`, `category`, `subcategory`, `brand`, `series`
- `short_description`, `full_description`, `process_type`, `material`, `application_area`
- `availability_status`, `lead_time`
- `seo_title`, `seo_description`, `seo_keywords`
- `images`, `specs`, `documents` (JSON-строки)

Русские синонимы колонок тоже поддерживаются (например, `Название`, `Артикул`, `Категория`).
