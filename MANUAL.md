# Swarna Deepika — User Manual

**స్వర్ణదీపిక** is the daily billing, stock, credit and accounts app for the shop.
This manual explains what each screen does, when to use it, and small tips
learned from real-world operation.

Default login: **admin / swarna123** (change it from Settings → Change Password).

---

## Table of contents

1. [The sidebar & Privacy Mode](#the-sidebar--privacy-mode)
2. [Dashboard](#dashboard)
3. [Billing](#billing)
4. [Customers](#customers)
5. [Loans / Khata](#loans--khata)
6. [Stock](#stock)
7. [Farmer Report](#farmer-report)
8. [Purchases](#purchases) &nbsp;·&nbsp; **Read this — new "Declare in Stock" flow**
9. [Suppliers](#suppliers)
10. [Expenses (+ Hamali payout)](#expenses)
11. [Day Book](#day-book)
12. [Accounts](#accounts) — Farmer / My side / Overall
13. [Data & Backup](#data--backup)
14. [Settings](#settings)
15. [Government Subsidy CSV sync](#government-subsidy-csv-sync)
16. [Bill printing](#bill-printing)
17. [Handy keyboard shortcuts](#handy-keyboard-shortcuts)

---

## The sidebar & Privacy Mode

The left sidebar is grouped into 4 sections:

| Section | What's inside | Visible in Privacy Mode? |
|---|---|---|
| **Farmer / Selling side** (రైతు వైపు) | Dashboard, Billing, Customers, Loans, Stock, Farmer Report | ✅ always visible |
| **My side** (నా వైపు) | Purchases, Suppliers, Expenses | 🚫 hidden |
| **Overall & System** | Day Book, Accounts | ✅ always visible |
| **System** | Data & Backup, Settings | 🚫 hidden |

**Privacy Mode** — the eye icon (👁 / 🚫) at the top of the sidebar.
Turn it ON while farmers are at the counter so they can't see what you paid
suppliers, your expenses, credit taken from wholesalers, backups, or admin
settings. Turn it OFF at the end of the day.

Shortcut: **Ctrl + Shift + P** to toggle Privacy Mode.

---

## Dashboard

Six KPI cards for today + Low Stock and Recent Bills. **Hover any card** to see
the underlying data (bills, customers, products). Every card has an "Open …"
link that opens the source screen in a new browser tab.

- Today's Sales — total value of today's bills.
- Cash Received — cash portion of today's bills.
- Credit Given — value of today's unpaid balances.
- Pending Loans — money customers still owe.
- Total Products / Total Customers — count only.

---

## Billing

Create a new bill for a farmer.

1. Search/pick a customer (or add new inline).
2. Add products from the searchable dropdown — quantity, rate, batch/expiry
   auto-fill from stock.
3. Choose payment: **Cash**, **UPI**, **Credit**, or a combination (Cash + UPI
   split). If unpaid balance > 0, the bill goes into "Loans / Khata" as an open
   credit.
4. Save & Print — the printed layout matches a traditional Indian bill book.

Tip: A bill can be part-cash + part-UPI + rest-credit all at once.

---

## Customers

Master list of every farmer. Includes an optional **12-digit Aadhaar**
field — the form only accepts exactly 12 digits, no letters. Search by name,
village, or phone.

The Loans screen also links to the customer's outstanding balance.

---

## Loans / Khata

Every bill with an unpaid balance appears here.

- **Record payment** button: choose Cash or UPI, enter amount, add a note.
- Full loan payment history per customer is one click away.

The Day Book's "Khata issued today vs recovered today" line is populated from
this screen.

---

## Stock

Products / inventory master. Includes:

- Name (English + optional Telugu)
- Category, batch number, mfg & expiry dates
- Purchase cost (hidden from cashier staff — admin-only)
- MRP, selling price, quantity on hand, unit
- **Bag size (kg)** — needed for the Government subsidy CSV sync

Low stock and expiring products are automatically flagged on the Dashboard and
Day Book.

---

## Farmer Report

The daily "farmer-facing" report — what was sold, to whom, and for how much on
a chosen date. Print or export to CSV. Renamed from "Reports" so it clearly
belongs to the farmer side of the business.

---

## Purchases

**Important new flow (this is different from before):**

Recording a purchase **no longer** touches your stock automatically. This is
intentional — first you record the paperwork, later you physically count and
declare the goods into inventory.

### Step 1 — Record the purchase

1. Type the supplier name. If they're already in your directory, autocomplete
   suggests them (and pre-fills phone). Otherwise, just type — the supplier is
   auto-added to your directory when you save.
2. Choose **Restock existing product** (for something you already stock) or
   leave "— New / not in stock yet —" for a fresh SKU.
3. Fill product name, quantity, unit, cost/unit, batch no.
4. **Payment Method**:
   - Cash — assumes fully paid.
   - Credit — you can optionally enter "Amount paid now"; the rest becomes a
     supplier credit (shown in Accounts → My side → Credit Taken).
   - UPI — reference / txn id required.
   - Account Transfer — UTR / cheque number required.
5. Click **Save Purchase**. It appears in the history with an amber "Declare in
   Stock" button.

### Step 2 — Declare in Stock

When you physically receive and count the goods, click the amber **Declare in
Stock** button on that row.

- If you selected an existing product in Step 1 → it just adds the quantity to
  that product's stock.
- If it's a new SKU → a small dialog asks for Category, MRP, Selling price,
  Mfg/Exp dates, Bag size (kg), and optional Telugu name. A new product is
  created **and** the quantity added.

The row now shows a green ✅ **In stock** badge. Deleting the purchase after
it's been declared will also **reverse** the stock movement.

### Reading the totals row

- **Total purchases** — ₹ of paperwork in this date range.
- **Not yet in stock** — count of undeclared purchases you should physically
  verify.
- **Open credit** — ₹ you still owe suppliers across all purchases.

---

## Suppliers

Directory of everyone you buy from. Store:

- Name, 10-digit phone (click to call from the row).
- Address.
- **Items Supplied** — one or more of Seeds / Fertilizers / Pesticides / Other.
- Notes (payment terms, contact person, etc.)

When you type a supplier name on the Purchases screen, matches from this
directory appear as suggestions.

---

## Expenses

Any business expense (rent, electricity, transport, etc.). Free-text category.

**Quick Hamali Payout card** — amber-highlighted at the top-left. Two fields:
amount + optional worker name. One click records an expense with category
`Hamali` — the Day Book's "Total Hamali (Labor) payouts made today" line and
the drawer-cash calculation automatically include it.

---

## Day Book

The single-screen daily business-health page.

- **Today's Cash Flow** — Total Cash Collected, Total UPI Collected, Total
  Hamali payouts, expected drawer cash (`cash − expenses`).
- **Stock Movement Summary** — top-moving items of the day (e.g. "Urea:
  50 bags sold").
- **Khata Today** — credit issued today vs recovered today.
- **Business Growth** — Month-over-Month growth % and Total Outstanding Market
  Credit (money locked in the market).
- **Smart Alerts** — red indicators for pesticides/seeds expiring in the next
  60 days, and low-stock warnings for fast-moving items.

Print / CSV export supported.

---

## Accounts

Three summary cards on top:

- **Farmer side** — Sales, Cash In, UPI In, Credit Given, Credit Recovered.
- **My side** — Purchases (total + by payment method), Expenses, Credit Taken.
- **Overall** — Money In minus Money Out = Net.

Below them, a detailed breakdown grid with 8 metric cards. Hover any card to
see the raw rows behind the number, and click the "Open …" link to jump into
the source screen (Reports / Purchases / Expenses / Loans etc.) in a new tab.

Change the date range with the Today / This Month / custom picker in the
header.

---

## Data & Backup

Everything about where your data lives and how to protect it.

- **Where your data lives** — exact file path (SQLite) or Mongo connection
  (cloud). Copy-to-clipboard for the path.
- **Stored data** — row counts for every collection.
- **Export data (CSV backup)** — Download a single ZIP with one CSV per
  collection. Good for month-end reporting and off-site backup.
- **Reset Login Credentials** — safety-guarded button. See below.
- **Recent server-side backups** — list of the last 10 automatic backups (from
  reset-auth), each with a Download link.

### Reset Login Credentials (safe reset)

Use if you forgot the admin password AND security-answer recovery isn't
working, or if you're handing the shop over and want a fresh auth state.

1. Click **Reset Login Credentials…** — a red warning dialog opens.
2. Type `RESET AUTH` (exact case), enter your current admin password.
3. The system **automatically**:
   - Creates a complete backup ZIP (business data + current users) at
     `<data-dir>/backups/backup_YYYYMMDD_HHMMSS.zip`.
   - Deletes all user accounts.
   - Re-seeds the default `admin / swarna123` login.
4. A confirmation dialog shows the exact backup file path and a "Download
   backup now" button.

**Business data is never deleted.** Products, customers, bills, loans,
purchases, expenses all stay.

---

## Settings

- Change password.
- Set up / rotate password-recovery question (offline) and recovery code.
- Edit shop info that appears on printed bills.

---

## Government Subsidy CSV sync

For fertilizers sold on the government machine. Once a day, paste the CSV from
the machine into the "Import subsidy CSV" screen (on the Stock page).

The importer accepts either:

- **Sold (Bags)** column — used directly.
- **Sold (MT)** column — converted to bags using each product's `Bag Size (kg)`
  (e.g. 0.9 MT ÷ 45 kg = 20 bags).

Click **Preview** to see the changes; click **Apply** to actually deduct from
local stock. If a product isn't found in your stock (name mismatch), the
importer skips it and shows why.

Example CSV that works:
```
Product Name,Supplier,Opening (Bags),Received (Bags),Sold (Bags),Closing (Bags)
Urea (45kg),IFFCO,120,50,20,150
DAP (50kg),IFFCO,200,0,45,155
```

---

## Bill printing

The bill layout mirrors traditional Indian bill books:

- Shop header + address (edit in Settings → Shop Info).
- Bill number, date, farmer name + village, Aadhaar (last 4).
- Item table with batch, expiry, quantity, rate, total.
- Payment split (Cash / UPI / Credit balance).
- Bilingual footer.

Ctrl + P (browser print) or the on-screen Print button.

---

## Handy keyboard shortcuts

| Shortcut | Action |
|---|---|
| **Ctrl + Shift + P** | Toggle Privacy Mode |
| **Ctrl + P** | Browser print (works on the bill preview) |

---

## Troubleshooting

- **"Nothing works, can't add stock/customers"** — usually the frontend can't
  reach the backend. Check `frontend/.env` has `REACT_APP_BACKEND_URL` set. On
  the offline desktop version, just re-run `desktop/run_local.bat`.
- **Data went missing after moving to a new PC** — copy the SQLite file
  (`swarna_deepika.db`) or MongoDB dump from the old PC. Data location is shown
  on the Data & Backup page.
- **Can't login after password recovery** — from Settings you can re-generate
  a one-time recovery code; keep it printed and stored safely offline.
