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
- Auth: /api/auth/login, /api/auth/register (bcrypt)
- Products/Categories CRUD; purchase price hidden except admin endpoint
- Bills: create (auto bill_no, decrement stock, compute balance), list w/ filters
- Customers CRUD
- Loans: pending list, record payments, per-customer/per-bill history
- Dashboard: today sales/cash/credit, pending loans, low stock
- **Daily Report page (2026-07-03):** `/reports` page + `GET /api/reports/daily?date=YYYY-MM-DD`.
  Shows day summary (sales, bill count, cash, credit), full transaction list (customer, village,
  items with qty), item-wise sold summary. Date navigation (prev/next/picker), CSV export, print.

## Key files
- backend/server.py — all API logic
- frontend/src/App.js — routing
- frontend/src/components/Layout.jsx — sidebar nav (bilingual)
- frontend/src/pages/{Login,Dashboard,Billing,Stock,Customers,Loans,Reports}Page.jsx
- frontend/src/components/BillTemplate.jsx — printable bill

## Credentials
See /app/memory/test_credentials.md — admin / swarna123

## Backlog / Roadmap
- P1: Windows local-run guide (README + setup script) — user asked earlier for .exe (web app)
- P2: SMS/WhatsApp loan reminders (needs Twilio/messaging account)
- P3: Electron wrapper for standalone Windows desktop app
- Idea: monthly/date-range reports & profit report (admin-only, uses hidden cost)

## Notes
- Daily report date matching uses stored ISO date prefix (UTC), consistent with dashboard.
