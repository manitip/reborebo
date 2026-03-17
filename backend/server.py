#!/usr/bin/env python3
import json
import os
import re
import sqlite3
import time
import urllib.parse
import urllib.request
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
ALLOWED_TYPES = {"pdf", "xls", "xlsx", "doc", "docx", "jpg", "jpeg", "png", "zip"}
ALLOWED_REQUEST_TYPES = {"quote", "analogue", "solution", "project", "general", "specification"}
ALLOWED_STATUSES = {"new", "in_progress", "waiting_clarification", "quote_sent", "completed", "cancelled"}

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
        """
    )
    conn.commit()
    conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean_phone(value: str):
    return re.sub(r"\D", "", value or "")


def parse_payload(handler: BaseHTTPRequestHandler):
    ctype = handler.headers.get("Content-Type", "")
    raw = handler.rfile.read(int(handler.headers.get("Content-Length", "0") or "0"))

    if ctype.startswith("multipart/form-data"):
        return _parse_multipart(raw, ctype)
    if ctype.startswith("application/json"):
        return json.loads(raw.decode("utf-8") or "{}"), []

    parsed = urllib.parse.parse_qs(raw.decode("utf-8"), keep_blank_values=True)
    return {k: v[-1] for k, v in parsed.items()}, []


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
        self.send_header("Access-Control-Allow-Methods", "POST, GET, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True})
        return self._json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/api/leads":
            return self._json(404, {"error": "Not found"})

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


if __name__ == "__main__":
    init_db()
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))
    print(f"Lead backend started on http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
