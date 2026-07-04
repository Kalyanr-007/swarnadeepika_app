# Swarna Deepika — Developer & Technical Documentation

Complete technical reference for the app: architecture, stack, folder layout,
data model, key design decisions, how to build/run/deploy, and interview-ready
talking points.

---

## 1. What the product does (one paragraph)

Swarna Deepika is a bilingual (Telugu + English) point-of-sale, stock, credit
(khata) and accounts app for a fertilizer, pesticide and seed shop. It runs
in two flavours from the same codebase: (a) a **cloud / web** deployment
(FastAPI + MongoDB) exposed over the internet from an EC2 instance, and (b) a
**fully offline Windows desktop** deployment (same FastAPI codebase but with
SQLite persistence, packaged into a single-port executable that serves the
React build from `/static/*`). One-click installer scripts (`install.sh`,
`install.bat`) autodetect the OS/package manager and set everything up.

---

## 2. Tech stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 (CRA), React Router v6, Tailwind CSS + shadcn/ui components, Axios, sonner (toasts), date-fns, lucide-react (icons) | Zero-config CRA is enough for a small business app; shadcn gives us radix-based accessible primitives without a heavy design system |
| **Backend (cloud)** | FastAPI + Uvicorn + Motor (async MongoDB driver) + Pydantic v2 + bcrypt | Async I/O, minimal boilerplate, first-class Pydantic models, no ORM overhead |
| **Database (cloud)** | MongoDB 7 | Document model matches our nested bill/items shape naturally; simple ops on a single-shop dataset |
| **Backend (offline)** | Same FastAPI code (`desktop/backend/app.py`) + SQLite (via `sqlite3` stdlib) | Zero external dependency for the offline flavour, single file on disk |
| **Packaging (Windows)** | PyInstaller + Inno Setup (optional) via `desktop/build.bat`; simpler flow via `desktop/run_local.bat` | Ships a `.exe` installer or a one-click BAT for shops that just want to double-click and go |
| **Process management (cloud)** | Kubernetes ingress in the Emergent preview environment (production: systemd or Docker) with `supervisord` inside the container | Auto-restart on crash, log capture, foreground supervision |
| **CI / test** | pytest / requests / manual E2E screenshots; the "backend testing" and "frontend testing" agents in this environment execute the suite | See `test_result.md` for the current pass/fail |

---

## 3. Repository layout

```
/app
├── backend/                  # FastAPI + MongoDB backend
│   ├── server.py             #  every endpoint (monolithic; ~1300 LOC)
│   ├── requirements.txt
│   ├── .env / .env.example   # MONGO_URL, DB_NAME, CORS_ORIGINS
│   └── data/backups/         # auto-created; auth-reset backup zips land here
│
├── frontend/                 # React app (CRA)
│   ├── src/
│   │   ├── App.js            # routes + auth gate
│   │   ├── components/
│   │   │   ├── Layout.jsx    # sidebar with 4 sections + Privacy Mode toggle
│   │   │   ├── DrillMetricCard.jsx  # hover-drill KPI wrapper
│   │   │   └── ui/           # shadcn primitives (Card, Dialog, HoverCard, ...)
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx    LoginPage.jsx
│   │   │   ├── BillingPage.jsx      ReportsPage.jsx  (Farmer Report)
│   │   │   ├── StockPage.jsx        CustomersPage.jsx (Aadhaar 12-digit)
│   │   │   ├── LoansPage.jsx        ExpensesPage.jsx (+ Hamali quick payout)
│   │   │   ├── PurchasesPage.jsx    SuppliersPage.jsx
│   │   │   ├── AccountsPage.jsx     DaySummaryPage.jsx  DataPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   └── index.js
│   ├── package.json, tailwind.config.js, craco.config.js
│   └── .env / .env.example   # REACT_APP_BACKEND_URL
│
├── desktop/                  # Offline Windows desktop flavour
│   ├── backend/app.py        # ~1200 LOC FastAPI + SQLite mirror of server.py
│   ├── backend/static/       # React build copied here at build time
│   ├── build.bat             # produce .exe installer via PyInstaller/Inno
│   ├── run_local.bat         # one-click dev/offline runner
│   ├── main.js, package.json # optional Electron wrapper (not required)
│
├── install.sh                # cross-platform Linux/macOS installer
├── install.bat               # Windows installer (delegates to run_local.bat)
├── stop.sh
├── README.md
├── MANUAL.md                 # end-user manual (for the shop owner)
└── DEVELOPER.md              # you are here
```

---

## 4. Data model

### Cloud (MongoDB collections)

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | Auth | `id, username, password_hash (bcrypt), role, security_question, security_answer_hash, recovery_code_hash` |
| `products` | Inventory | `id, name, name_telugu, category_id, batch_no, mfg_date, exp_date, purchase_price, mrp, selling_price, quantity, unit, bag_size_kg` |
| `categories` | Product grouping | `id, name` |
| `customers` | Farmers | `id, name, village, phone, address, aadhaar (12 digits)` |
| `bills` | Sales | `id, bill_no (autoincrement), customer_id?, customer_name, village, items:[BillItem], total_amount, payment_type, paid_amount, cash_amount, upi_amount, balance_amount, date` |
| `loan_payments` | Credit repayments | `id, bill_id, amount, method (cash/upi), notes, payment_date` |
| `expenses` | Overheads incl. Hamali | `id, amount, category, note, date` |
| `purchases` | Stock-in paperwork | `id, supplier, supplier_id?, supplier_phone, product_id?, product_name, quantity, unit, purchase_price, total_cost, payment_method (cash/credit/upi/account_transfer), reference_number, paid_amount, balance_amount, declared_in_stock (bool)` |
| `suppliers` | Vendor directory | `id, name, phone, address, items_supplied[], notes` |

### Offline (SQLite tables)

Same shape as above, translated to relational rows. `bills.items` is stored as
JSON text and parsed on read. Indexes are minimal (single-shop workload).

### IDs

All primary keys are UUID4 strings (never Mongo `ObjectId`) so responses are
JSON-serialisable and both backends stay symmetric.

### Timestamps

Stored as ISO-8601 UTC strings, e.g. `2026-07-04T10:15:00+00:00`. Date-range
filters compare with `$gte`/`$lte`; the frontend appends `T23:59:59` to the
`end_date` to include the full last day.

---

## 5. API surface (highlights)

Base URL: `${REACT_APP_BACKEND_URL}/api`

### Auth
- `POST /auth/register` `{username, password, role}`
- `POST /auth/login` `{username, password}` → `{success, user}`
- `POST /auth/change-password`
- `POST /auth/setup-recovery`, `GET /auth/recovery-status`, `POST /auth/reset-password`

### CRUD sets (products, categories, customers, bills, loans, purchases, suppliers, expenses)
Standard REST. `products` has two variants:
- `GET /products` — public, hides `purchase_price`.
- `GET /products/admin` — includes cost.

### Purchases (new 2-step flow)
- `POST /purchases` — records the paperwork; does NOT touch stock.
- `POST /purchases/{id}/declare-in-stock` `{category_id?, mrp?, selling_price?, mfg_date?, exp_date?, bag_size_kg?, name_telugu?}`
  → creates the product if missing, then increments stock. Idempotent (400 if
  already declared).
- `DELETE /purchases/{id}` — reverses stock only if it was declared.

### Reports
- `GET /reports/summary?start_date=&end_date=` — profit, cash flow, daily breakdown, expenses-by-category.
- `GET /reports/daily?date=` — farmer report.
- `GET /reports/day-summary?date=` — the Day Book payload (cash flow + top items + khata + growth + smart alerts).
- `GET /reports/accounts-segregated?start_date=&end_date=` — Farmer side / My side / Overall totals.

### Government subsidy
- `POST /subsidy/preview` `{csv}` — parses CSV, converts MT→bags, returns preview.
- `POST /subsidy/apply` `{csv}` — actually deducts stock.

### Data management
- `GET /data/info` — where the DB lives, per-collection counts, recent server-side backups.
- `GET /data/export` — streams a zip of one CSV per collection (users.csv omits `password_hash`).
- `POST /data/reset-auth` `{confirm_phrase:"RESET AUTH", admin_username, admin_password}` — full backup → wipe `users` → reseed `admin/swarna123`. Returns absolute backup path.
- `GET /data/backup/download/{name}` — download a backup zip (regex-guarded filename).

---

## 6. Notable design decisions

1. **One codebase, two persistence layers.** `backend/server.py` (MongoDB) and
   `desktop/backend/app.py` (SQLite) implement the same endpoints so the React
   frontend is unchanged between cloud and offline. This is cheaper than an
   abstraction layer given the small surface area.

2. **UUIDs everywhere.** Never expose `ObjectId`. Simpler serialization,
   consistent across both backends.

3. **Two-step purchase → stock.** Recording a purchase is paperwork; declaring
   it into stock is a separate physical action. This mirrors how shops
   actually operate ("bill arrived, but the truck hasn't unloaded yet") and
   prevents phantom stock.

4. **Privacy Mode.** Purely a client-side UI concern (localStorage flag)
   because it's a "friend at the counter" problem, not a security boundary.
   Sensitive numbers still live in the DB — anyone with the login sees
   everything. For real access control we'd use per-user roles.

5. **Aadhaar as a plain string with 12-digit input filter.** No PII masking
   yet; ok for a small local shop but flagged as a TODO for anything
   larger.

6. **CSV export excludes password_hash.** Basic safety hygiene.

7. **Drill-downs in Dashboard/Accounts** use `HoverCard` + lazy fetch to keep
   pages fast; nothing loads until the user hovers. The "See all →" link
   opens the source page in a new tab so the user doesn't lose the
   date-range context.

8. **Segregated Accounts view.** Farmer side vs My side vs Overall is
   computed server-side (`/reports/accounts-segregated`) so both flavours
   agree on the math.

9. **`.env` files are gitignored** but `.env.example` files are committed with
   sane defaults. On startup, both backends fall back to
   `mongodb://localhost:27017` and `swarna_deepika_db` if `MONGO_URL` is
   missing, and auto-seed the default admin.

10. **No external services required for MVP.** No Stripe, no Twilio, no S3.
    All data is local. Reduces cost and eliminates internet dependency for the
    offline flavour.

---

## 7. Setup

### Windows (offline / desktop)
1. Install Python 3.10+, Node.js LTS, Yarn.
2. `install.bat` at repo root (or `desktop\run_local.bat`).
3. First run installs deps and builds the UI; subsequent runs start in ~5s.
4. Serves on `http://127.0.0.1:8756`, data lives at
   `%USERPROFILE%\SwarnaDeepika\swarna_deepika.db`.

### Linux / macOS / EC2 (cloud)
1. `sudo bash install.sh --prod` (or `bash install.sh` for dev).
2. Autodetects apt/dnf/yum/apk/brew, installs Python 3, Node 20, Yarn,
   MongoDB 7.
3. Copies `.env.example` → `.env` if missing.
4. Builds frontend (`REACT_APP_BACKEND_URL=""` so it hits same origin) and
   starts:
   - Backend at `:8001` via uvicorn (in `--prod`, no `--reload`)
   - Frontend at `:3000` via `serve -s build`
   - PIDs in `./logs/*.pid`, logs in `./logs/*.log`
5. Stop everything with `bash stop.sh`.

### Exposing to the internet
Add an Nginx (or Caddy / Traefik) reverse-proxy in front:

```nginx
server {
    listen 443 ssl http2;
    server_name shop.example.com;
    ssl_certificate /etc/letsencrypt/live/shop.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;

    location /api/ { proxy_pass http://127.0.0.1:8001; proxy_set_header Host $host; }
    location /    { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
}
```

For auto-restart across reboots, drop this into `/etc/systemd/system/swarna.service`:

```ini
[Unit]
Description=Swarna Deepika
After=network.target mongod.service

[Service]
WorkingDirectory=/opt/swarna
ExecStart=/opt/swarna/install.sh --prod
ExecStop=/opt/swarna/stop.sh
Restart=on-failure
User=ubuntu

[Install]
WantedBy=multi-user.target
```
Then `sudo systemctl enable --now swarna`.

---

## 8. Testing

- `test_result.md` at the repo root is the living checklist.
- Backend endpoints are covered by an in-repo test suite executed by the
  `deep_testing_backend_v2` agent (55/55 passing at last run).
- Frontend is exercised by the `deep_testing_frontend_v2` agent when opted-in.
- The offline SQLite backend is smoke-tested via `fastapi.TestClient` — see
  `desktop/backend/app.py` end-of-file.

---

## 9. Common gotchas & fixes

- **`KeyError: 'MONGO_URL'`** — you deleted `backend/.env` or never created it.
  Copy `.env.example`. The code has safe fallbacks (localhost:27017 /
  `swarna_deepika_db`), so this should now be rare.
- **Frontend calls go to `undefined/api/...`** — same root cause on the
  frontend side. Copy `frontend/.env.example` to `.env`.
- **Purchase doesn't appear in stock** — by design, click **Declare in Stock**
  on that purchase row.
- **Date filter excludes today** — ISO timestamps compare as strings; extend
  the end date to `T23:59:59` (already handled by `endOfDay()` helper).
- **`"password_hash"` visible after Export** — should never happen; if it
  does, the `USER_SAFE_FIELDS` allow-list in server.py was accidentally
  changed.

---

## 10. What I built and can talk about in an interview (cheat sheet)

- **Full-stack app** in React (functional, hooks-only) + FastAPI + MongoDB
  with a mirrored SQLite offline flavour packaged as a Windows single-file
  runner. One React frontend targets both.
- **Bilingual UX** — every label has Telugu + English (Noto Sans Telugu font),
  printed bills mimic the traditional book layout.
- **Domain-specific features** shipped end-to-end: split-payment billing,
  credit ledger with per-loan payments, Government subsidy CSV ingest with
  MT-to-bags conversion, day-book with month-over-month growth, smart alerts
  for expiry and low stock.
- **UX for a shared physical counter** — Privacy Mode hides the
  purchases/expenses/backup sections when farmers can see the screen, without
  logging out.
- **Two-step purchase → stock declaration** — models real-world receipt of
  goods, keeps inventory honest.
- **Segregated Accounts view** — Farmer side, My side, Overall — with a
  server-side aggregation endpoint and hover-drill KPI cards that open the
  source page in a new tab.
- **Cross-platform installer scripts** — `install.sh` autodetects
  apt/dnf/yum/apk/brew and installs Python/Node/Yarn/MongoDB; `install.bat`
  uses `winget` on Windows and delegates to the offline single-port launcher.
- **Data & Backup module** — CSV zip export, safe auth-only reset with
  automatic backup and a returned absolute path, download-any-backup endpoint,
  password-hash exclusion on export.
- **Tested** — 55/55 backend endpoint tests, plus a UI drill-down flow
  verified with an automation agent.

**Trade-offs I'd point out honestly**:
- Single `server.py` monolith — fine at ~1300 LOC, would split into
  routers/services at 3k+ LOC.
- No async job queue (backups are synchronous). Fine for a single-shop
  dataset. Would need Celery/RQ for a chain of shops.
- Aadhaar stored in plain text. For anything beyond a single shop, encrypt at
  rest (Fernet with a key kept out of the DB) and mask on read.
- Privacy Mode is UI-only (localStorage). Real segregation would need
  per-role auth.
