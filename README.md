# Swarna Deepika Fertilizers, Pesticides & Seeds — Billing App

Bilingual (Telugu + English) billing / stock / loans app for a fertilizer & pesticide
shop. Two ways to run it:

- **Cloud / web version** — React + FastAPI + MongoDB (multi-user)
- **Offline desktop version** — Same UI, self-contained SQLite backend that runs on
  a single Windows PC (no internet, no MongoDB, no config)

Default login: **admin / swarna123**

---

## Quickest way to run locally (offline, one click)

The **easiest** local setup uses the offline backend — everything runs from one
window and data lives in a local SQLite file.

**Prerequisites (install once on the Windows PC):**
1. **Python 3.10+** — https://www.python.org/downloads/ (tick *Add Python to PATH*)
2. **Node.js LTS** — https://nodejs.org (includes npm)
3. **Yarn** — after Node is installed, `run_local.bat` will install it automatically
   if missing.

**Steps:**
1. Clone / download this project.
2. Open the `desktop/` folder in File Explorer.
3. Double-click **`run_local.bat`**.
4. The first run takes a few minutes (installs deps + builds the UI). Subsequent
   runs start in ~5 seconds.
5. Your browser opens at `http://127.0.0.1:8756`. Login with `admin / swarna123`.

Everything (products, customers, bills, loans) is saved in
`%USERPROFILE%\SwarnaDeepika\swarna_deepika.db`. Back that file up occasionally.

Press `Ctrl+C` in the console window to stop the app.

---

## Cloud / web version (MongoDB, multi-user)

If you want to run the "cloud" flavour locally for development:

1. Install MongoDB Community and start `mongod`.
2. Backend env: `cp backend/.env.example backend/.env`  (defaults use
   `mongodb://localhost:27017`, DB name `swarna_deepika_db`).
3. Frontend env: `cp frontend/.env.example frontend/.env`
   (defaults to `REACT_APP_BACKEND_URL=http://localhost:8001`).
4. Start backend:
   ```
   cd backend
   pip install -r requirements.txt
   uvicorn server:app --host 0.0.0.0 --port 8001 --reload
   ```
5. Start frontend (new terminal):
   ```
   cd frontend
   yarn install
   yarn start
   ```
6. Visit `http://localhost:3000`. An `admin / swarna123` user is auto-seeded on
   first backend start.

> **Common gotcha:** if you skip step 2/3 and there are no `.env` files, the
> backend uses safe defaults but the frontend's `REACT_APP_BACKEND_URL` becomes
> `undefined` — you'll see the UI at :3000 but every "Add stock / customer" call
> will fail. Copy the example files!

---

## Building the installable Windows .exe

See `desktop/README.md`. In short: on a Windows PC with the prerequisites above,
open the `desktop/` folder and run `build.bat` — the installer is produced in
`desktop/dist/`.

---

## Features

- Auth (bcrypt) + security-question / recovery-code password reset (offline)
- Bilingual UI, printable bills matching traditional Indian bill books
- Products / Categories CRUD, purchase price hidden except admin endpoint
- Customers CRUD with Aadhaar (12-digit) support
- Billing with split payment (Cash + UPI + Credit)
- Loans (pending list, cash/UPI payment recording, per-customer history)
- Purchases / Stock-in (with bag size per product)
- Expenses (free-text categories; Hamali / Labor tracked separately)
- Accounts — P&L, cash flow, expenses by category
- **Day Book (Business Health)** — today's cash flow, top-moving items,
  Khata issued vs recovered, month-over-month growth, outstanding market credit,
  and Smart Alerts for products expiring within 60 days + low stock warnings
- **Government subsidy CSV sync** — paste the daily CSV from the government
  fertilizer machine (columns: Product Name / Sold (Bags) or Sold (MT)) and it
  converts MT → bags using each product's Bag Size (kg) and adjusts local stock
- Daily report page with CSV / print
