# PRD — Swarna Deepika Fertilizers, Pesticides & Seeds — Billing App

## Original problem statement
Build a billing/receipt app for a fertilizer & pesticide shop. Requirements:
- Basic login
- Clear billing page with live print preview matching traditional bill books
- Bilingual bills/UI (Telugu + English)
- Store data for shop use to track loans (buy now, pay later)
- Stock management, hiding product purchase price (show only MRP + selling price)
- Clean green-themed UI

User language: English (respond in English).

## Tech stack
- Frontend: React, Tailwind, Shadcn UI
- Backend: FastAPI + MongoDB (Motor)
- Auth: username/password with bcrypt (session stored client-side in localStorage)

## Implemented features
- Auth: /api/auth/login, /register (bcrypt). **Change password, security-question + one-time recovery code reset** (offline-friendly, no email/SMS). Settings page + Forgot Password dialog on login.
- Products/Categories CRUD; purchase price hidden except admin endpoint
- Bills: create (auto bill_no, decrement stock, compute balance), list w/ filters
- Customers CRUD
- Loans: pending list, record payments, per-customer/per-bill history
- **Expenses** (2026-07-03): /api/expenses CRUD; ExpensesPage with free-text category, date-range filter.
- **Purchases / Stock-in** (2026-07-03): /api/purchases CRUD; restock increments product stock + updates cost; delete reverses stock. PurchasesPage.
- **Accounts — Cash Flow & P&L** (2026-07-03): /api/reports/summary; AccountsPage with Net Profit/Loss, Net Cash Flow, Revenue, COGS, Gross Profit, Expenses, Cash In/Out, Purchases, Credit Given, daily breakdown, expenses-by-category. Date-range + Today/This-Month quick filters.
- Dashboard: today sales/cash/credit, pending loans, low stock
- Daily Report page: /reports + /api/reports/daily (who bought what, item-wise summary, CSV/print)
- **Offline Windows desktop app** (2026-07-03): /app/desktop — Electron + PyInstaller-bundled FastAPI/SQLite backend that also serves the React UI. build.bat produces the .exe on Windows. Mirrors all cloud API endpoints. See /app/desktop/README.md. NOT built/tested (requires Windows).

## Nav (sidebar, bilingual, 10 items)
Dashboard, Billing, Stock, Purchases, Customers, Loans, Expenses, Reports, Accounts, Settings

## Key files
- backend/server.py — all API logic
- frontend/src/App.js — routing
- frontend/src/components/Layout.jsx — sidebar nav (bilingual)
- frontend/src/pages/{Login,Dashboard,Billing,Stock,Customers,Loans,Reports}Page.jsx
- frontend/src/components/BillTemplate.jsx — printable bill

## Credentials
See /app/memory/test_credentials.md — admin / swarna123

## Backlog / Roadmap
- P1: (in progress notes) split server.py into routers; switch date filtering to Mongo $gte/$lte for scale
- P2: Phone OTP login for the CLOUD version only (needs Twilio account + keys) — impossible offline
- P2: SMS/WhatsApp loan reminders (needs Twilio/messaging account)
- P3: store cost snapshot on BillItem so back-dated P&L is exact (currently uses current product cost for COGS)
- Idea: opening cash balance setting so Accounts shows absolute cash-in-hand, not just net flow

## 2026-07-04 — Local-run fix + desktop backend sync
- Root cause of user's "nothing works in local (add stock/customer fails)": .env files gitignored, so cloned repo had no MONGO_URL (backend crash-looped) and no REACT_APP_BACKEND_URL (frontend hit undefined/api/... 404).
- Added: backend/.env.example, frontend/.env.example (committed). server.py now has safe fallbacks (mongodb://localhost:27017 + swarna_deepika_db) and auto-seeds admin/swarna123 on startup.
- Root README rewritten with the one-click desktop/run_local.bat flow + cloud flow.
- desktop/backend/app.py brought up to parity with cloud: fixed 4 INSERT bugs (product bag_size_kg, customer aadhaar, bill cash_amount+upi_amount, loan_payment method) and added /api/reports/day-summary + /api/subsidy/{preview,apply}. Verified with FastAPI TestClient.
- Backend testing subagent ran 31/31 test cases passing.

## 2026-07-04 — Cross-platform installer + Data & Backup module
- Added `install.sh` (Linux/macOS/EC2 — apt/dnf/yum/apk/brew aware, installs Python3/Node20/Yarn/MongoDB7, sets up .env, builds+starts in dev or --prod mode) and `stop.sh`.
- Added `install.bat` (Windows — auto-installs Python3.12 + NodeLTS via winget, sets up .env from templates, delegates to `desktop/run_local.bat` for offline SQLite backend on 127.0.0.1:8756).
- Data & Backup module (`/api/data/*` on both backends + `/data` page in UI):
  - GET /api/data/info — shows where the DB lives + row counts + list of recent backups
  - GET /api/data/export — streams a ZIP with a CSV per collection; users.csv strips password_hash
  - POST /api/data/reset-auth — safe reset: writes a full backup ZIP to disk first, wipes users, re-seeds admin/swarna123, returns backup absolute path and size. Business data (products/customers/bills/loans/purchases/expenses) preserved.
  - GET /api/data/backup/download/{name} — regex-guarded backup download
  - New DataPage.jsx (sidebar "Data & Backup") with big warning box, confirm phrase "RESET AUTH", admin password re-entry, backup-path display + copy-to-clipboard + download link.
- Frontend polish: Aadhaar customer field validated to exactly 12 digits (already in previous session, verified); new Hamali Quick Payout card on Expenses page (amber highlight) that logs an expense with category=Hamali → Day Book's hamali_payouts picks it up automatically.
- Backend testing subagent ran 55/55 test cases passing (31 existing + 24 new Data endpoints).

## Notes
- Daily report date matching uses stored ISO date prefix (UTC), consistent with dashboard.
