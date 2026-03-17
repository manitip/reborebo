#!/usr/bin/env python3
import csv
import io
import json
import os
import re
import sqlite3
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import smtplib

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "leads.db"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

RATE_LIMIT_MAX = int(os.getenv("RATE_LIMIT_MAX", "8"))
RATE_LIMIT_WINDOW_SEC = int(os.getenv("RATE_LIMIT_WINDOW_SEC", "300"))
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_TYPES = {"pdf", "xls", "xlsx", "doc", "docx", "jpg", "jpeg", "png", "zip", "csv"}
ALLOWED_REQUEST_TYPES = {"quote", "analogue", "solution", "project", "general", "specification"}
ALLOWED_STATUSES = {"new", "in_progress", "waiting_clarification", "quote_sent", "completed", "cancelled"}
ALLOWED_AVAILABILITY = {"in_stock", "out_of_stock", "on_request", "discontinued"}


class UploadedFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content


def _parse_disposition(value: str):
    parts = [part.strip() for part in value.split(';') if part.strip()]
    meta = {}
    for part in parts[1:]:
        if '=' not in part:
            continue
        k, v = part.split('=', 1)
        meta[k.strip().lower()] = v.strip().strip('"')
    return meta


def _parse_multipart(raw: bytes, content_type: str):
    boundary_match = re.search(r'boundary=([^;]+)', content_type)
    if not boundary_match:
        raise ValueError('boundary not found for multipart/form-data')

    boundary = boundary_match.group(1).strip().strip('"').encode('utf-8')
    delimiter = b'--' + boundary
    data = {}
    files = []

    parts = raw.split(delimiter)
    for part in parts[1:]:
        part = part.strip()
        if not part or part == b'--':
            continue

        if b'\r\n\r\n' in part:
            header_blob, body = part.split(b'\r\n\r\n', 1)
        elif b'\n\n' in part:
            header_blob, body = part.split(b'\n\n', 1)
        else:
            continue

        body = body.rstrip(b'\r\n')
        headers = {}
        for line in header_blob.decode('utf-8', errors='replace').splitlines():
            if ':' not in line:
                continue
            key, value = line.split(':', 1)
            headers[key.strip().lower()] = value.strip()

        disp = headers.get('content-disposition', '')
        meta = _parse_disposition(disp)
        field_name = meta.get('name')
        if not field_name:
            continue

        filename = meta.get('filename')
        if filename:
            files.append(UploadedFile(filename=filename, content=body))
        else:
            data[field_name] = body.decode('utf-8', errors='replace')

    return data, files


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean_phone(value: str):
    return re.sub(r"\D", "", value or "")


def slugify(value: str):
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-zа-я0-9]+", "-", value, flags=re.IGNORECASE)
    return value.strip("-") or "item"


def ensure_unique_slug(conn, table: str, slug: str, row_id=None):
    current = slug
    idx = 2
    while True:
        if row_id is None:
            row = conn.execute(f"SELECT id FROM {table} WHERE slug=?", (current,)).fetchone()
        else:
            row = conn.execute(f"SELECT id FROM {table} WHERE slug=? AND id<>?", (current, row_id)).fetchone()
        if not row:
            return current
        current = f"{slug}-{idx}"
        idx += 1


def init_db():
    conn = db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            company TEXT,
            comment TEXT,
            request_type TEXT NOT NULL,
            request_items_json TEXT,
            files_json TEXT,
            source_page TEXT,
            submitted_at TEXT NOT NULL,
            utm_json TEXT,
            referrer TEXT,
            status TEXT NOT NULL DEFAULT 'new',
            crm_status TEXT NOT NULL DEFAULT 'pending',
            crm_error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rate_limits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            parent_id INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(parent_id) REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS brands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            brand_id INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(brand_id) REFERENCES brands(id)
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            sku TEXT NOT NULL UNIQUE,
            category_id INTEGER,
            brand_id INTEGER,
            series_id INTEGER,
            short_description TEXT,
            full_description TEXT,
            images_json TEXT NOT NULL DEFAULT '[]',
            specs_json TEXT NOT NULL DEFAULT '[]',
            process_type TEXT,
            material TEXT,
            application_area TEXT,
            documents_json TEXT NOT NULL DEFAULT '[]',
            availability_status TEXT NOT NULL DEFAULT 'on_request',
            lead_time TEXT,
            seo_title TEXT,
            seo_description TEXT,
            seo_keywords TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(category_id) REFERENCES categories(id),
            FOREIGN KEY(brand_id) REFERENCES brands(id),
            FOREIGN KEY(series_id) REFERENCES series(id)
        );

        CREATE TABLE IF NOT EXISTS product_relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            related_product_id INTEGER NOT NULL,
            relation_type TEXT NOT NULL,
            UNIQUE(product_id, related_product_id, relation_type),
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(related_product_id) REFERENCES products(id)
        );

        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
        CREATE INDEX IF NOT EXISTS idx_products_process_type ON products(process_type);
        CREATE INDEX IF NOT EXISTS idx_products_material ON products(material);
        CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability_status);
        """
    )
    conn.commit()
    conn.close()


def parse_payload(handler: BaseHTTPRequestHandler):
    ctype = handler.headers.get("Content-Type", "")
    raw = handler.rfile.read(int(handler.headers.get("Content-Length", "0") or "0"))

    if ctype.startswith("multipart/form-data"):
        return _parse_multipart(raw, ctype)
    if ctype.startswith("application/json"):
        return json.loads(raw.decode("utf-8") or "{}"), []

    parsed = urllib.parse.parse_qs(raw.decode("utf-8"), keep_blank_values=True)
    return {k: v[-1] for k, v in parsed.items()}, []


def parse_json_array(value, default=None):
    if default is None:
        default = []
    if isinstance(value, list):
        return value
    if not value:
        return default
    if isinstance(value, str):
        return json.loads(value)
    return default


def upsert_category(conn, name: str, parent_name=None):
    name = (name or "").strip()
    if not name:
        return None
    parent_id = None
    if parent_name:
        parent_id = upsert_category(conn, parent_name, None)
    row = conn.execute("SELECT id FROM categories WHERE lower(name)=lower(?) AND coalesce(parent_id,0)=coalesce(?,0)", (name, parent_id)).fetchone()
    if row:
        return row["id"]
    ts = now_iso()
    slug = ensure_unique_slug(conn, "categories", slugify(name))
    cur = conn.execute(
        "INSERT INTO categories(name, slug, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (name, slug, parent_id, ts, ts),
    )
    return cur.lastrowid


def upsert_brand(conn, name: str):
    name = (name or "").strip()
    if not name:
        return None
    row = conn.execute("SELECT id FROM brands WHERE lower(name)=lower(?)", (name,)).fetchone()
    if row:
        return row["id"]
    ts = now_iso()
    slug = ensure_unique_slug(conn, "brands", slugify(name))
    cur = conn.execute("INSERT INTO brands(name, slug, created_at, updated_at) VALUES (?, ?, ?, ?)", (name, slug, ts, ts))
    return cur.lastrowid


def upsert_series(conn, name: str, brand_id=None):
    name = (name or "").strip()
    if not name:
        return None
    row = conn.execute("SELECT id FROM series WHERE lower(name)=lower(?) AND coalesce(brand_id,0)=coalesce(?,0)", (name, brand_id)).fetchone()
    if row:
        return row["id"]
    ts = now_iso()
    slug = ensure_unique_slug(conn, "series", slugify(name))
    cur = conn.execute("INSERT INTO series(name, slug, brand_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", (name, slug, brand_id, ts, ts))
    return cur.lastrowid


def save_product(conn, payload, product_id=None):
    name = (payload.get("name") or "").strip()
    sku = (payload.get("sku") or "").strip()
    if not name or not sku:
        raise ValueError("name и sku обязательны")

    category_id = payload.get("category_id")
    if not category_id and (payload.get("category") or payload.get("subcategory")):
        parent_name = payload.get("category") if payload.get("subcategory") else None
        category_name = payload.get("subcategory") or payload.get("category")
        category_id = upsert_category(conn, category_name, parent_name)
    brand_id = payload.get("brand_id")
    if not brand_id and payload.get("brand"):
        brand_id = upsert_brand(conn, payload.get("brand"))
    series_id = payload.get("series_id")
    if not series_id and payload.get("series"):
        series_id = upsert_series(conn, payload.get("series"), brand_id)

    availability = (payload.get("availability_status") or "on_request").strip()
    if availability not in ALLOWED_AVAILABILITY:
        raise ValueError("Недопустимый status availability_status")

    short_description = (payload.get("short_description") or "").strip()
    full_description = (payload.get("full_description") or "").strip()
    process_type = (payload.get("process_type") or "").strip()
    material = (payload.get("material") or "").strip()
    application_area = (payload.get("application_area") or "").strip()
    lead_time = (payload.get("lead_time") or "").strip()

    images = parse_json_array(payload.get("images"), [])
    specs = parse_json_array(payload.get("specs"), [])
    documents = parse_json_array(payload.get("documents"), [])

    seo_title = (payload.get("seo_title") or "").strip()
    seo_description = (payload.get("seo_description") or "").strip()
    seo_keywords = (payload.get("seo_keywords") or "").strip()

    ts = now_iso()
    if product_id:
        existing = conn.execute("SELECT slug FROM products WHERE id=?", (product_id,)).fetchone()
        if not existing:
            raise ValueError("Товар не найден")
        slug = ensure_unique_slug(conn, "products", slugify(payload.get("slug") or name), product_id)
        conn.execute(
            """
            UPDATE products
            SET name=?, slug=?, sku=?, category_id=?, brand_id=?, series_id=?, short_description=?, full_description=?,
                images_json=?, specs_json=?, process_type=?, material=?, application_area=?, documents_json=?,
                availability_status=?, lead_time=?, seo_title=?, seo_description=?, seo_keywords=?, updated_at=?
            WHERE id=?
            """,
            (
                name, slug, sku, category_id, brand_id, series_id, short_description, full_description,
                json.dumps(images, ensure_ascii=False), json.dumps(specs, ensure_ascii=False), process_type, material,
                application_area, json.dumps(documents, ensure_ascii=False), availability, lead_time, seo_title,
                seo_description, seo_keywords, ts, product_id,
            ),
        )
    else:
        slug = ensure_unique_slug(conn, "products", slugify(payload.get("slug") or name))
        cur = conn.execute(
            """
            INSERT INTO products(
                name, slug, sku, category_id, brand_id, series_id, short_description, full_description,
                images_json, specs_json, process_type, material, application_area, documents_json,
                availability_status, lead_time, seo_title, seo_description, seo_keywords, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name, slug, sku, category_id, brand_id, series_id, short_description, full_description,
                json.dumps(images, ensure_ascii=False), json.dumps(specs, ensure_ascii=False), process_type, material,
                application_area, json.dumps(documents, ensure_ascii=False), availability, lead_time, seo_title,
                seo_description, seo_keywords, ts, ts,
            ),
        )
        product_id = cur.lastrowid

    analogs = parse_json_array(payload.get("analogs"), [])
    related = parse_json_array(payload.get("related_products"), [])
    conn.execute("DELETE FROM product_relations WHERE product_id=?", (product_id,))

    for rel_id in analogs:
        conn.execute(
            "INSERT OR IGNORE INTO product_relations(product_id, related_product_id, relation_type) VALUES (?, ?, 'analogue')",
            (product_id, int(rel_id)),
        )
    for rel_id in related:
        conn.execute(
            "INSERT OR IGNORE INTO product_relations(product_id, related_product_id, relation_type) VALUES (?, ?, 'related')",
            (product_id, int(rel_id)),
        )
    return product_id


def product_from_row(conn, row):
    item = dict(row)
    item["images"] = json.loads(item.pop("images_json") or "[]")
    item["specs"] = json.loads(item.pop("specs_json") or "[]")
    item["documents"] = json.loads(item.pop("documents_json") or "[]")
    item["url"] = f"/catalog/{item['slug']}/"
    item["request_quote_action"] = "Запросить КП"
    item["add_to_request_action"] = "Добавить в запрос"

    rel = conn.execute(
        """
        SELECT pr.relation_type, p.id, p.name, p.slug, p.sku
        FROM product_relations pr
        JOIN products p ON p.id = pr.related_product_id
        WHERE pr.product_id=?
        """,
        (item["id"],),
    ).fetchall()
    item["analogs"] = [dict(r) for r in rel if r["relation_type"] == "analogue"]
    item["related_products"] = [dict(r) for r in rel if r["relation_type"] == "related"]
    return item


def search_products(conn, query):
    q = f"%{query.strip().lower()}%"
    rows = conn.execute(
        """
        SELECT p.*, c.name AS category_name, b.name AS brand_name, s.name AS series_name
        FROM products p
        LEFT JOIN categories c ON c.id=p.category_id
        LEFT JOIN brands b ON b.id=p.brand_id
        LEFT JOIN series s ON s.id=p.series_id
        WHERE lower(p.name) LIKE ? OR lower(p.sku) LIKE ?
        ORDER BY p.updated_at DESC
        LIMIT 100
        """,
        (q, q),
    ).fetchall()
    return [dict(r) for r in rows]


def parse_xlsx_rows(content: bytes):
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            for si in root.findall("x:si", ns):
                txt = "".join((t.text or "") for t in si.findall(".//x:t", ns))
                shared.append(txt)
        sheet_name = "xl/worksheets/sheet1.xml"
        root = ET.fromstring(zf.read(sheet_name))
        ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

        rows = []
        for row in root.findall(".//x:sheetData/x:row", ns):
            values = []
            for c in row.findall("x:c", ns):
                cell_type = c.attrib.get("t")
                v = c.find("x:v", ns)
                raw = v.text if v is not None else ""
                if cell_type == "s" and raw:
                    idx = int(raw)
                    raw = shared[idx] if idx < len(shared) else ""
                values.append(raw)
            rows.append(values)
    if not rows:
        return []
    header = [h.strip() for h in rows[0]]
    out = []
    for r in rows[1:]:
        while len(r) < len(header):
            r.append("")
        out.append({header[i]: r[i] for i in range(len(header)) if header[i]})
    return out


def parse_import_file(uploaded: UploadedFile):
    ext = uploaded.filename.rsplit(".", 1)[-1].lower()
    if ext == "csv":
        text = uploaded.content.decode("utf-8-sig")
        return list(csv.DictReader(io.StringIO(text)))
    if ext == "xlsx":
        return parse_xlsx_rows(uploaded.content)
    raise ValueError("Поддерживаются только CSV и XLSX")


def import_products(conn, rows):
    created = 0
    updated = 0
    errors = []
    for idx, row in enumerate(rows, start=2):
        try:
            payload = {
                "name": row.get("name") or row.get("Название"),
                "sku": row.get("sku") or row.get("Артикул"),
                "category": row.get("category") or row.get("Категория"),
                "subcategory": row.get("subcategory") or row.get("Подкатегория"),
                "brand": row.get("brand") or row.get("Бренд"),
                "series": row.get("series") or row.get("Серия"),
                "short_description": row.get("short_description") or row.get("Краткое описание"),
                "full_description": row.get("full_description") or row.get("Полное описание"),
                "process_type": row.get("process_type") or row.get("Тип процесса"),
                "material": row.get("material") or row.get("Материал"),
                "application_area": row.get("application_area") or row.get("Область применения"),
                "availability_status": (row.get("availability_status") or row.get("Статус наличия") or "on_request"),
                "lead_time": row.get("lead_time") or row.get("Срок поставки"),
                "seo_title": row.get("seo_title") or row.get("SEO title"),
                "seo_description": row.get("seo_description") or row.get("SEO description"),
                "seo_keywords": row.get("seo_keywords") or row.get("SEO keywords"),
                "images": row.get("images") or "[]",
                "specs": row.get("specs") or "[]",
                "documents": row.get("documents") or "[]",
            }
            existing = conn.execute("SELECT id FROM products WHERE sku=?", (payload["sku"],)).fetchone()
            if existing:
                save_product(conn, payload, existing["id"])
                updated += 1
            else:
                save_product(conn, payload)
                created += 1
        except Exception as exc:
            errors.append(f"Строка {idx}: {exc}")
    return created, updated, errors


def save_files(file_fields):
    saved = []
    for field in file_fields:
        name = os.path.basename(field.filename)
        ext = (name.split(".")[-1] if "." in name else "").lower()
        content = field.content
        if ext not in ALLOWED_TYPES:
            raise ValueError(f"Недопустимый тип файла: {name}")
        if len(content) > MAX_FILE_SIZE:
            raise ValueError(f"Файл превышает 50 МБ: {name}")

        stamp = f"{int(time.time() * 1000)}_{len(saved)}"
        path = UPLOAD_DIR / f"{stamp}_{name}"
        with path.open("wb") as out:
            out.write(content)
        saved.append({"original_name": name, "path": str(path.relative_to(BASE_DIR)), "size": len(content)})
    return saved


def validate_lead(data):
    errors = []
    name = (data.get("contactPerson") or data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip()
    company = (data.get("companyName") or data.get("company") or "").strip()
    comment = (data.get("comment") or "").strip()
    request_type = (data.get("requestType") or "general").strip()

    items = data.get("requestItems") or "[]"
    try:
        items = json.loads(items) if isinstance(items, str) else items
    except json.JSONDecodeError:
        errors.append("Некорректный список позиций")
        items = []

    utm = data.get("utm") or "{}"
    try:
        utm = json.loads(utm) if isinstance(utm, str) else utm
    except json.JSONDecodeError:
        utm = {}

    if not name:
        errors.append("Укажите имя/контактное лицо")
    if len(clean_phone(phone)) < 11:
        errors.append("Укажите корректный телефон")
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        errors.append("Укажите корректный email")
    if request_type not in ALLOWED_REQUEST_TYPES:
        errors.append("Неизвестный тип обращения")
    if not comment and not items:
        errors.append("Добавьте комментарий или позиции")

    return {
        "name": name,
        "phone": phone,
        "email": email,
        "company": company,
        "comment": comment,
        "request_type": request_type,
        "items": items,
        "source_page": (data.get("sourcePage") or "").strip(),
        "submitted_at": (data.get("submittedAt") or now_iso()).strip(),
        "utm": utm,
        "referrer": (data.get("referrer") or "").strip(),
    }, errors


def check_rate_limit(ip: str):
    conn = db()
    threshold = int(time.time()) - RATE_LIMIT_WINDOW_SEC
    conn.execute("DELETE FROM rate_limits WHERE created_at < ?", (threshold,))
    current = conn.execute("SELECT COUNT(*) AS cnt FROM rate_limits WHERE ip=?", (ip,)).fetchone()["cnt"]
    if current >= RATE_LIMIT_MAX:
        conn.commit()
        conn.close()
        return False
    conn.execute("INSERT INTO rate_limits(ip, created_at) VALUES (?, ?)", (ip, int(time.time())))
    conn.commit()
    conn.close()
    return True


def send_email_notification(lead):
    to_email = os.getenv("MANAGER_EMAIL")
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    pwd = os.getenv("SMTP_PASS")
    sender = os.getenv("SMTP_FROM", user or "")
    if not (to_email and host and user and pwd and sender):
        return "skipped"

    msg = EmailMessage()
    msg["Subject"] = f"Новая заявка #{lead['id']} ({lead['request_type']})"
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(
        f"""Имя: {lead['name']}\nТелефон: {lead['phone']}\nEmail: {lead['email']}\nКомпания: {lead['company']}\nТип: {lead['request_type']}\nСтраница: {lead['source_page']}\nКомментарий: {lead['comment']}\n"""
    )
    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587"))) as smtp:
        smtp.starttls()
        smtp.login(user, pwd)
        smtp.send_message(msg)
    return "sent"


def send_telegram_notification(lead):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not bot_token or not chat_id:
        return "skipped"
    text = urllib.parse.quote(
        f"Новая заявка #{lead['id']} ({lead['request_type']})\n{lead['name']}\n{lead['phone']}\n{lead['email']}"
    )
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage?chat_id={chat_id}&text={text}"
    with urllib.request.urlopen(url, timeout=8):
        return "sent"


def push_to_crm(lead):
    bitrix_webhook = os.getenv("BITRIX24_WEBHOOK")
    amo_url = os.getenv("AMOCRM_WEBHOOK")

    payload = {
        "title": f"Лид с сайта #{lead['id']}",
        "name": lead["name"],
        "phone": lead["phone"],
        "email": lead["email"],
        "company": lead["company"],
        "comment": lead["comment"],
        "request_type": lead["request_type"],
        "source_page": lead["source_page"],
    }

    if bitrix_webhook:
        req = urllib.request.Request(
            bitrix_webhook,
            data=json.dumps({"fields": payload}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8):
            return "synced", ""

    if amo_url:
        req = urllib.request.Request(
            amo_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8):
            return "synced", ""

    return "skipped", "CRM webhook not configured"


def save_lead(lead, files):
    ts = now_iso()
    conn = db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO leads(name, phone, email, company, comment, request_type, request_items_json, files_json,
                          source_page, submitted_at, utm_json, referrer, status, crm_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending', ?, ?)
        """,
        (
            lead["name"],
            lead["phone"],
            lead["email"],
            lead["company"],
            lead["comment"],
            lead["request_type"],
            json.dumps(lead["items"], ensure_ascii=False),
            json.dumps(files, ensure_ascii=False),
            lead["source_page"],
            lead["submitted_at"],
            json.dumps(lead["utm"], ensure_ascii=False),
            lead["referrer"],
            ts,
            ts,
        ),
    )
    lead_id = cur.lastrowid
    conn.commit()
    conn.close()
    return lead_id


def update_crm_state(lead_id, crm_status, crm_error=""):
    conn = db()
    conn.execute(
        "UPDATE leads SET crm_status=?, crm_error=?, updated_at=? WHERE id=?",
        (crm_status, crm_error, now_iso(), lead_id),
    )
    conn.commit()
    conn.close()


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, PATCH, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/health":
            return self._json(200, {"ok": True})

        if path == "/api/catalog/search":
            q = (qs.get("q", [""])[0] or "").strip()
            conn = db()
            result = search_products(conn, q) if q else []
            conn.close()
            return self._json(200, {"items": result, "count": len(result)})

        if path == "/api/catalog/products":
            conn = db()
            sql = """
                SELECT p.*, c.name AS category_name, b.name AS brand_name, s.name AS series_name
                FROM products p
                LEFT JOIN categories c ON c.id=p.category_id
                LEFT JOIN brands b ON b.id=p.brand_id
                LEFT JOIN series s ON s.id=p.series_id
                WHERE 1=1
            """
            params = []

            if qs.get("category"):
                sql += " AND c.slug=?"
                params.append(qs["category"][0])
            if qs.get("brand"):
                sql += " AND b.slug=?"
                params.append(qs["brand"][0])
            if qs.get("process_type"):
                sql += " AND lower(p.process_type)=lower(?)"
                params.append(qs["process_type"][0])
            if qs.get("material"):
                sql += " AND lower(p.material)=lower(?)"
                params.append(qs["material"][0])
            if qs.get("availability"):
                sql += " AND p.availability_status=?"
                params.append(qs["availability"][0])
            if qs.get("q"):
                sql += " AND (lower(p.name) LIKE ? OR lower(p.sku) LIKE ?)"
                val = f"%{qs['q'][0].lower()}%"
                params.extend([val, val])

            rows = conn.execute(sql + " ORDER BY p.updated_at DESC LIMIT 200", params).fetchall()
            items = []
            for row in rows:
                item = dict(row)
                specs = json.loads(item.get("specs_json") or "[]")
                param_name = qs.get("param_name", [""])[0]
                min_v = qs.get("param_min", [None])[0]
                max_v = qs.get("param_max", [None])[0]
                if param_name and (min_v is not None or max_v is not None):
                    values = [float(s.get("value")) for s in specs if s.get("name") == param_name and str(s.get("value", "")).replace('.', '', 1).isdigit()]
                    if not values:
                        continue
                    mn = float(min_v) if min_v is not None else None
                    mx = float(max_v) if max_v is not None else None
                    if mn is not None and all(v < mn for v in values):
                        continue
                    if mx is not None and all(v > mx for v in values):
                        continue
                item["images"] = json.loads(item.pop("images_json") or "[]")
                item["specs"] = specs
                item["documents"] = json.loads(item.pop("documents_json") or "[]")
                item["url"] = f"/catalog/{item['slug']}/"
                items.append(item)
            conn.close()
            return self._json(200, {"items": items, "count": len(items)})

        if path.startswith("/api/catalog/products/"):
            slug_or_id = path.rsplit("/", 1)[-1]
            conn = db()
            if slug_or_id.isdigit():
                row = conn.execute("""
                    SELECT p.*, c.name AS category_name, b.name AS brand_name, s.name AS series_name
                    FROM products p
                    LEFT JOIN categories c ON c.id=p.category_id
                    LEFT JOIN brands b ON b.id=p.brand_id
                    LEFT JOIN series s ON s.id=p.series_id
                    WHERE p.id=?
                """, (int(slug_or_id),)).fetchone()
            else:
                row = conn.execute("""
                    SELECT p.*, c.name AS category_name, b.name AS brand_name, s.name AS series_name
                    FROM products p
                    LEFT JOIN categories c ON c.id=p.category_id
                    LEFT JOIN brands b ON b.id=p.brand_id
                    LEFT JOIN series s ON s.id=p.series_id
                    WHERE p.slug=?
                """, (slug_or_id,)).fetchone()
            if not row:
                conn.close()
                return self._json(404, {"error": "Товар не найден"})
            item = product_from_row(conn, row)
            conn.close()
            return self._json(200, {"product": item})

        if path == "/api/catalog/meta":
            conn = db()
            categories = [dict(r) for r in conn.execute("SELECT * FROM categories ORDER BY name").fetchall()]
            brands = [dict(r) for r in conn.execute("SELECT * FROM brands ORDER BY name").fetchall()]
            series = [dict(r) for r in conn.execute("SELECT * FROM series ORDER BY name").fetchall()]
            conn.close()
            return self._json(200, {"categories": categories, "brands": brands, "series": series})

        return self._json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/api/leads":
            ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
            if not check_rate_limit(ip):
                return self._json(429, {"error": "Слишком много запросов. Повторите позже."})

            try:
                data, file_fields = parse_payload(self)
            except (ValueError, json.JSONDecodeError) as exc:
                return self._json(400, {"error": f"Некорректный формат запроса: {exc}"})

            if data.get("website"):
                return self._json(200, {"ok": True})

            lead, errors = validate_lead(data)
            if errors:
                return self._json(400, {"error": "Валидация не пройдена", "details": errors})

            try:
                files = save_files(file_fields)
            except ValueError as exc:
                return self._json(400, {"error": str(exc)})

            lead_id = save_lead(lead, files)
            lead_record = {"id": lead_id, **lead}

            notifications = {}
            for channel, fn in (("email", send_email_notification), ("telegram", send_telegram_notification)):
                try:
                    notifications[channel] = fn(lead_record)
                except Exception as exc:
                    notifications[channel] = f"failed: {exc}"

            try:
                crm_status, crm_error = push_to_crm(lead_record)
            except Exception as exc:
                crm_status, crm_error = "failed", str(exc)
            update_crm_state(lead_id, crm_status, crm_error)

            return self._json(
                201,
                {
                    "ok": True,
                    "leadId": lead_id,
                    "status": "new",
                    "crmStatus": crm_status,
                    "notifications": notifications,
                },
            )

        if self.path == "/api/admin/products":
            try:
                data, _ = parse_payload(self)
            except (ValueError, json.JSONDecodeError) as exc:
                return self._json(400, {"error": f"Некорректный формат запроса: {exc}"})
            conn = db()
            try:
                product_id = save_product(conn, data)
                conn.commit()
                row = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
                payload = product_from_row(conn, row)
                conn.close()
                return self._json(201, {"ok": True, "product": payload})
            except Exception as exc:
                conn.rollback()
                conn.close()
                return self._json(400, {"error": str(exc)})

        if self.path == "/api/admin/import":
            try:
                _, file_fields = parse_payload(self)
            except (ValueError, json.JSONDecodeError) as exc:
                return self._json(400, {"error": f"Некорректный формат запроса: {exc}"})
            if not file_fields:
                return self._json(400, {"error": "Прикрепите файл"})

            try:
                rows = parse_import_file(file_fields[0])
            except Exception as exc:
                return self._json(400, {"error": str(exc)})

            conn = db()
            created, updated, errors = import_products(conn, rows)
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True, "created": created, "updated": updated, "errors": errors})

        return self._json(404, {"error": "Not found"})

    def do_PATCH(self):
        match = re.match(r"^/api/leads/(\d+)/status$", self.path)
        if not match:
            return self._json(404, {"error": "Not found"})

        lead_id = int(match.group(1))
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0") or "0"))
        payload = json.loads(raw.decode("utf-8") or "{}")
        status = payload.get("status")
        if status not in ALLOWED_STATUSES:
            return self._json(400, {"error": "Недопустимый статус"})

        conn = db()
        conn.execute("UPDATE leads SET status=?, updated_at=? WHERE id=?", (status, now_iso(), lead_id))
        conn.commit()
        conn.close()
        return self._json(200, {"ok": True, "status": status})

    def do_PUT(self):
        match = re.match(r"^/api/admin/products/(\d+)$", self.path)
        if not match:
            return self._json(404, {"error": "Not found"})
        product_id = int(match.group(1))
        try:
            data, _ = parse_payload(self)
        except (ValueError, json.JSONDecodeError) as exc:
            return self._json(400, {"error": f"Некорректный формат запроса: {exc}"})

        conn = db()
        try:
            save_product(conn, data, product_id=product_id)
            conn.commit()
            row = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
            payload = product_from_row(conn, row)
            conn.close()
            return self._json(200, {"ok": True, "product": payload})
        except Exception as exc:
            conn.rollback()
            conn.close()
            return self._json(400, {"error": str(exc)})


if __name__ == "__main__":
    init_db()
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))
    print(f"Lead & catalog backend started on http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
