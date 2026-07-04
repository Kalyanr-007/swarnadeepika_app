# Swarna Deepika Fertilizers, Pesticides & Seeds — Billing App

Bilingual (Telugu + English) offline-first billing / stock / loans / accounting
app for a fertilizer, pesticide & seed shop.

- **Windows**: runs 100% offline as a single desktop app (SQLite)
- **Linux / macOS / EC2**: runs as a web app (FastAPI + MongoDB)
- One installer script on each OS handles all dependencies automatically.

Default login: **admin / swarna123**

> 📖 **Documentation:** [User Manual](./MANUAL.md) · [Developer Guide](./DEVELOPER.md)

---

## One-click setup

### Windows
1. Clone / download this project.
2. Double-click **`install.bat`** at the root.
3. That's it — the script auto-installs Python + Node.js + Yarn (via `winget`),
   builds the UI, and starts the offline backend at `http://127.0.0.1:8756`.
4. Open your browser (it auto-opens) and login with `admin / swarna123`.

Data is stored at `%USERPROFILE%\SwarnaDeepika\swarna_deepika.db`.

### Linux / macOS / EC2 (Ubuntu, Debian, Amazon Linux, RHEL, Alpine, Homebrew)
```bash
git clone <this repo>
cd <this repo>
sudo bash install.sh --prod        # for a server that should be exposed to the internet
# or
bash install.sh                    # for local development (dev server on :3000)
```
The script auto-detects your package manager (apt / dnf / yum / apk / brew),
installs Python 3, Node.js 20, Yarn and MongoDB 7, creates the `.env` files
from templates, builds the frontend, and starts:

- **Backend**: `http://<host>:8001/api`
- **Frontend**: `http://<host>:3000`
- Logs in `./logs/backend.log`, `./logs/frontend.log`
- PIDs in `./logs/*.pid` — stop everything with `bash stop.sh`

To make this survive server reboots, add a systemd unit that runs
`install.sh --prod` after MongoDB comes up (see the `# ---------- Run! ----------`
block at the bottom of `install.sh` for the exact commands).

---

## Where is data stored?

Open the **Data & Backup** page (sidebar → "Data & Backup" / "డేటా & బ్యాకప్").
It shows the exact on-disk path of your database and how many rows are in each
collection.

- **Windows / offline (SQLite)**: single file at
  `%USERPROFILE%\SwarnaDeepika\swarna_deepika.db` — back it up by copying to a USB drive.
- **Linux / cloud (MongoDB)**: default `/var/lib/mongodb`. MongoDB writes data to
  disk continuously and it survives restarts.

All business data (products, categories, customers, bills, loan payments,
purchases, expenses) is stored permanently and remains available after any
restart.

### Export data to CSV

Data & Backup page → **"Download ZIP of all data"** creates a single zip file
containing one CSV per collection (`products.csv`, `customers.csv`, `bills.csv`,
etc.) plus a `_metadata.json` with row counts and timestamp. Use it for
backups, reporting, or migration.

### Reset Login Credentials (safe reset)

Data & Backup page → **"Reset Login Credentials…"** — this button:

1. Requires you to type `RESET AUTH` **and** re-enter the admin password.
2. Automatically creates a **complete backup ZIP** (including current users)
   on disk before doing anything destructive.
3. Wipes ONLY the `users` table — every product, customer, bill, loan,
   purchase, expense stays intact.
4. Re-seeds the default `admin / swarna123` login so the app is usable again.
5. Shows you the **exact path** where the backup file was saved and offers to
   download it right there.

You can also download any earlier server-side backup from the same page.

---

## Features

- Auth (bcrypt) + security-question / recovery-code password reset (offline)
- Bilingual UI, printable bills matching traditional Indian bill books
- Products / Categories CRUD, purchase price hidden except admin endpoint
- Customers CRUD with **12-digit Aadhaar** support + client-side validation
- Billing with split payment (Cash + UPI + Credit)
- Loans (pending list, cash/UPI payment recording, per-customer history)
- Purchases / Stock-in (with bag size per product)
- Expenses with dedicated **Hamali (Labor) Quick Payout** section
- Accounts — P&L, cash flow, expenses by category
- **Day Book (Business Health)** — today's cash flow, top-moving items,
  Khata issued vs recovered, month-over-month growth, outstanding market credit,
  and Smart Alerts for products expiring within 60 days + low stock warnings
- **Government subsidy CSV sync** — paste the daily CSV from the government
  fertilizer machine (columns: `Product Name / Sold (Bags)` or `Sold (MT)`) and it
  converts MT → bags using each product's `Bag Size (kg)` and adjusts local stock
- **Data & Backup** — see storage location, export everything as CSV zip, safe
  auth-only reset with automatic backup
- Daily report page with CSV / print

---

## Manual setup (advanced / if the installer failed)

### Cloud / web (MongoDB)
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# new terminal
cd frontend && yarn install && yarn start
```

### Offline desktop (SQLite, Windows)
```
cd desktop
run_local.bat
```

### Building the installable Windows .exe
See `desktop/README.md`. Requires Windows + Python + Node + Yarn.
