"""
Swarna Deepika — Offline Desktop Backend
Self-contained FastAPI server backed by SQLite. Also serves the built React UI.
Used ONLY for the standalone Windows .exe build. The cloud version uses server.py + MongoDB.
"""
import os
import sys
import json
import uuid
import csv
import io
import re
import sqlite3
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

import bcrypt
import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict


# ---------- Paths (work both in dev and inside PyInstaller onefile) ----------
def resource_dir() -> Path:
    """Directory containing bundled read-only assets (the built frontend)."""
    if getattr(sys, "_MEIPASS", None):
        return Path(sys._MEIPASS)
    return Path(__file__).parent


def data_dir() -> Path:
    """Writable directory for the SQLite DB. Electron passes SDB_DATA_DIR."""
    env = os.environ.get("SDB_DATA_DIR")
    if env:
        p = Path(env)
    else:
        p = Path.home() / "SwarnaDeepika"
    p.mkdir(parents=True, exist_ok=True)
    return p


STATIC_DIR = resource_dir() / "static"
DB_PATH = data_dir() / "swarna_deepika.db"
PORT = int(os.environ.get("SDB_PORT", "8756"))

_lock = threading.Lock()


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


# ---------- Schema ----------
def init_db():
    with _lock, get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT,
                role TEXT, created_at TEXT,
                security_question TEXT, security_answer_hash TEXT, recovery_code_hash TEXT
            );
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY, name TEXT, description TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY, name TEXT, name_telugu TEXT, category_id TEXT,
                batch_no TEXT, mfg_date TEXT, exp_date TEXT, purchase_price REAL,
                mrp REAL, selling_price REAL, quantity INTEGER, unit TEXT,
                bag_size_kg REAL DEFAULT 0, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY, name TEXT, village TEXT, phone TEXT,
                address TEXT, aadhaar TEXT DEFAULT '', created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS bills (
                id TEXT PRIMARY KEY, bill_no INTEGER, customer_id TEXT, customer_name TEXT,
                village TEXT, items TEXT, total_amount REAL, payment_type TEXT,
                paid_amount REAL, cash_amount REAL DEFAULT 0, upi_amount REAL DEFAULT 0,
                balance_amount REAL, date TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS loan_payments (
                id TEXT PRIMARY KEY, bill_id TEXT, amount REAL, payment_date TEXT,
                notes TEXT, method TEXT DEFAULT 'cash'
            );
            CREATE TABLE IF NOT EXISTS expenses (
                id TEXT PRIMARY KEY, amount REAL, category TEXT, note TEXT, date TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS purchases (
                id TEXT PRIMARY KEY, supplier TEXT, product_id TEXT, product_name TEXT,
                quantity INTEGER, unit TEXT, purchase_price REAL, total_cost REAL,
                batch_no TEXT, date TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS purchase_returns (
                id TEXT PRIMARY KEY, supplier TEXT, product_id TEXT, product_name TEXT,
                quantity INTEGER, unit TEXT, return_price REAL, total_refund REAL,
                batch_no TEXT, date TEXT, created_at TEXT
            );
            """
        )
        # Seed default admin on first run
        cur = conn.execute("SELECT COUNT(*) AS c FROM users")
        if cur.fetchone()["c"] == 0:
            pw = bcrypt.hashpw("swarna123".encode(), bcrypt.gensalt()).decode()
            conn.execute(
                "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)",
                (new_id(), "admin", pw, "admin", now_iso()),
            )


# ---------- Models ----------
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "staff"


class UserLogin(BaseModel):
    username: str
    password: str


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ProductCreate(BaseModel):
    name: str
    name_telugu: Optional[str] = ""
    category_id: str
    batch_no: str
    mfg_date: str
    exp_date: str
    purchase_price: float
    mrp: float
    selling_price: float
    quantity: int
    unit: str = "piece"
    bag_size_kg: float = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    name_telugu: Optional[str] = None
    category_id: Optional[str] = None
    batch_no: Optional[str] = None
    mfg_date: Optional[str] = None
    exp_date: Optional[str] = None
    purchase_price: Optional[float] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    bag_size_kg: Optional[float] = None


class CustomerCreate(BaseModel):
    name: str
    village: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    aadhaar: Optional[str] = ""


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    village: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    aadhaar: Optional[str] = None


class BillItem(BaseModel):
    product_id: str
    product_name: str
    batch_no: str
    mfg_date: str
    exp_date: str
    quantity: int
    unit: str
    rate: float
    amount: float


class BillCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    village: str
    items: List[BillItem]
    total_amount: float
    payment_type: str
    paid_amount: float = 0
    cash_amount: float = 0
    upi_amount: float = 0


class DeclareStockRequest(BaseModel):
    category_id: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    mfg_date: Optional[str] = None
    exp_date: Optional[str] = None
    bag_size_kg: Optional[float] = 0
    name_telugu: Optional[str] = ""


class PurchaseCreate(BaseModel):

    bill_id: str
    amount: float
    notes: str = ""
    method: str = "cash"


class ChangePasswordRequest(BaseModel):
    username: str
    current_password: str
    new_password: str


class ExpenseCreate(BaseModel):
    amount: float
    category: str
    note: Optional[str] = ""
    date: Optional[str] = None


class PurchaseCreate(BaseModel):
    supplier: Optional[str] = ""
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    unit: str = "piece"
    purchase_price: float
    batch_no: Optional[str] = ""
    date: Optional[str] = None
    update_stock: bool = True


class PurchaseReturnCreate(BaseModel):
    supplier: Optional[str] = ""
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    unit: str = "piece"
    return_price: float
    batch_no: Optional[str] = ""
    date: Optional[str] = None
    update_stock: bool = True


class SetupRecoveryRequest(BaseModel):
    username: str
    current_password: str
    security_question: str
    security_answer: str


class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str
    security_answer: Optional[str] = None
    recovery_code: Optional[str] = None


def _norm_answer(a):
    return (a or "").strip().lower()


def _gen_recovery_code():
    raw = uuid.uuid4().hex.upper()
    return f"SD-{raw[0:4]}-{raw[4:8]}-{raw[8:12]}"


def _in_range(iso_date, start, end):
    d = (iso_date or "")[:10]
    if start and d < start:
        return False
    if end and d > end:
        return False
    return True


# ---------- App ----------
app = FastAPI()
api = APIRouter(prefix="/api")


def row_to_product(r, hide_cost=True):
    d = dict(r)
    if hide_cost:
        d.pop("purchase_price", None)
    return d


def row_to_bill(r):
    d = dict(r)
    d["items"] = json.loads(d["items"]) if d.get("items") else []
    return d


# --- Auth ---
@api.post("/auth/register")
def register(user: UserCreate):
    with _lock, get_conn() as conn:
        exists = conn.execute("SELECT 1 FROM users WHERE username=?", (user.username,)).fetchone()
        if exists:
            raise HTTPException(400, "Username already exists")
        h = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
        uid = new_id()
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)",
            (uid, user.username, h, user.role, now_iso()),
        )
    return {"id": uid, "username": user.username, "role": user.role}


@api.post("/auth/login")
def login(credentials: UserLogin):
    with get_conn() as conn:
        u = conn.execute("SELECT * FROM users WHERE username=?", (credentials.username,)).fetchone()
    if not u or not bcrypt.checkpw(credentials.password.encode(), u["password_hash"].encode()):
        raise HTTPException(401, "Invalid credentials")
    return {"success": True, "user": {"id": u["id"], "username": u["username"], "role": u["role"]}}


@api.post("/auth/change-password")
def change_password(req: ChangePasswordRequest):
    with get_conn() as conn:
        u = conn.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
    if not u or not bcrypt.checkpw(req.current_password.encode(), u["password_hash"].encode()):
        raise HTTPException(401, "Current password is incorrect")
    if len(req.new_password) < 4:
        raise HTTPException(400, "New password must be at least 4 characters")
    h = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    with _lock, get_conn() as conn:
        conn.execute("UPDATE users SET password_hash=? WHERE username=?", (h, req.username))
    return {"success": True}


@api.post("/auth/setup-recovery")
def setup_recovery(req: SetupRecoveryRequest):
    with get_conn() as conn:
        u = conn.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
    if not u or not bcrypt.checkpw(req.current_password.encode(), u["password_hash"].encode()):
        raise HTTPException(401, "Password is incorrect")
    ans_hash = bcrypt.hashpw(_norm_answer(req.security_answer).encode(), bcrypt.gensalt()).decode()
    code = _gen_recovery_code()
    code_hash = bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()
    with _lock, get_conn() as conn:
        conn.execute(
            "UPDATE users SET security_question=?, security_answer_hash=?, recovery_code_hash=? WHERE username=?",
            (req.security_question, ans_hash, code_hash, req.username),
        )
    return {"success": True, "recovery_code": code}


@api.get("/auth/recovery-status")
def recovery_status(username: str):
    with get_conn() as conn:
        u = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not u:
        return {"has_recovery": False, "security_question": None}
    return {
        "has_recovery": bool(u["security_answer_hash"] or u["recovery_code_hash"]),
        "security_question": u["security_question"],
    }


@api.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    with get_conn() as conn:
        u = conn.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
    if not u:
        raise HTTPException(401, "Incorrect recovery answer or code")
    verified = False
    if req.recovery_code and u["recovery_code_hash"]:
        if bcrypt.checkpw(req.recovery_code.strip().encode(), u["recovery_code_hash"].encode()):
            verified = True
    if not verified and req.security_answer and u["security_answer_hash"]:
        if bcrypt.checkpw(_norm_answer(req.security_answer).encode(), u["security_answer_hash"].encode()):
            verified = True
    if not verified:
        raise HTTPException(401, "Incorrect recovery answer or code")
    if len(req.new_password) < 4:
        raise HTTPException(400, "New password must be at least 4 characters")
    h = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    with _lock, get_conn() as conn:
        if req.recovery_code:
            conn.execute("UPDATE users SET password_hash=?, recovery_code_hash=NULL WHERE username=?", (h, req.username))
        else:
            conn.execute("UPDATE users SET password_hash=? WHERE username=?", (h, req.username))
    return {"success": True}


# --- Categories ---
@api.post("/categories")
def create_category(c: CategoryCreate):
    obj = {"id": new_id(), "name": c.name, "description": c.description or "", "created_at": now_iso()}
    with _lock, get_conn() as conn:
        conn.execute("INSERT INTO categories (id,name,description,created_at) VALUES (?,?,?,?)",
                     (obj["id"], obj["name"], obj["description"], obj["created_at"]))
    return obj


@api.get("/categories")
def get_categories():
    with get_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM categories").fetchall()]


@api.delete("/categories/{category_id}")
def delete_category(category_id: str):
    with _lock, get_conn() as conn:
        cur = conn.execute("DELETE FROM categories WHERE id=?", (category_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Category not found")
    return {"success": True}


# --- Products ---
@api.post("/products")
def create_product(p: ProductCreate):
    obj = p.model_dump()
    obj["id"] = new_id()
    obj["created_at"] = now_iso()
    with _lock, get_conn() as conn:
        conn.execute(
            """INSERT INTO products (id,name,name_telugu,category_id,batch_no,mfg_date,exp_date,
               purchase_price,mrp,selling_price,quantity,unit,bag_size_kg,created_at)
               VALUES (:id,:name,:name_telugu,:category_id,:batch_no,:mfg_date,:exp_date,
               :purchase_price,:mrp,:selling_price,:quantity,:unit,:bag_size_kg,:created_at)""",
            obj,
        )
    return obj


@api.get("/products")
def get_products(category_id: Optional[str] = None, show_hidden: bool = False):
    q = "SELECT * FROM products"
    args = ()
    if category_id:
        q += " WHERE category_id=?"
        args = (category_id,)
    with get_conn() as conn:
        rows = conn.execute(q, args).fetchall()
    return [row_to_product(r, hide_cost=not show_hidden) for r in rows]


@api.get("/products/admin")
def get_products_admin(category_id: Optional[str] = None):
    q = "SELECT * FROM products"
    args = ()
    if category_id:
        q += " WHERE category_id=?"
        args = (category_id,)
    with get_conn() as conn:
        return [dict(r) for r in conn.execute(q, args).fetchall()]


@api.get("/products/{product_id}")
def get_product(product_id: str):
    with get_conn() as conn:
        r = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    if not r:
        raise HTTPException(404, "Product not found")
    return row_to_product(r, hide_cost=True)


@api.put("/products/{product_id}")
def update_product(product_id: str, p: ProductUpdate):
    data = {k: v for k, v in p.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No data to update")
    sets = ", ".join(f"{k}=:{k}" for k in data)
    data["id"] = product_id
    with _lock, get_conn() as conn:
        cur = conn.execute(f"UPDATE products SET {sets} WHERE id=:id", data)
        if cur.rowcount == 0:
            raise HTTPException(404, "Product not found")
        r = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    return dict(r)


@api.delete("/products/{product_id}")
def delete_product(product_id: str):
    with _lock, get_conn() as conn:
        cur = conn.execute("DELETE FROM products WHERE id=?", (product_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Product not found")
    return {"success": True}


# --- Customers ---
@api.post("/customers")
def create_customer(c: CustomerCreate):
    obj = c.model_dump()
    obj["id"] = new_id()
    obj["created_at"] = now_iso()
    obj["phone"] = obj.get("phone") or ""
    obj["address"] = obj.get("address") or ""
    obj["aadhaar"] = obj.get("aadhaar") or ""
    with _lock, get_conn() as conn:
        conn.execute(
            "INSERT INTO customers (id,name,village,phone,address,aadhaar,created_at) VALUES (:id,:name,:village,:phone,:address,:aadhaar,:created_at)",
            obj,
        )
    return obj


@api.get("/customers")
def get_customers(search: Optional[str] = None):
    with get_conn() as conn:
        if search:
            like = f"%{search}%"
            rows = conn.execute(
                "SELECT * FROM customers WHERE name LIKE ? OR village LIKE ? OR phone LIKE ?",
                (like, like, like),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM customers").fetchall()
    return [dict(r) for r in rows]


@api.get("/customers/{customer_id}")
def get_customer(customer_id: str):
    with get_conn() as conn:
        r = conn.execute("SELECT * FROM customers WHERE id=?", (customer_id,)).fetchone()
    if not r:
        raise HTTPException(404, "Customer not found")
    return dict(r)


@api.put("/customers/{customer_id}")
def update_customer(customer_id: str, c: CustomerUpdate):
    data = {k: v for k, v in c.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No data to update")
    sets = ", ".join(f"{k}=:{k}" for k in data)
    data["id"] = customer_id
    with _lock, get_conn() as conn:
        cur = conn.execute(f"UPDATE customers SET {sets} WHERE id=:id", data)
        if cur.rowcount == 0:
            raise HTTPException(404, "Customer not found")
        r = conn.execute("SELECT * FROM customers WHERE id=?", (customer_id,)).fetchone()
    return dict(r)


@api.delete("/customers/{customer_id}")
def delete_customer(customer_id: str):
    with _lock, get_conn() as conn:
        cur = conn.execute("DELETE FROM customers WHERE id=?", (customer_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Customer not found")
    return {"success": True}


# --- Bills ---
@api.post("/bills")
def create_bill(bill: BillCreate):
    with _lock, get_conn() as conn:
        last = conn.execute("SELECT MAX(bill_no) AS m FROM bills").fetchone()
        next_no = (last["m"] + 1) if last and last["m"] else 1
        balance = max(0.0, bill.total_amount - bill.paid_amount) if bill.payment_type != "cash" else 0.0
        obj = {
            "id": new_id(),
            "bill_no": next_no,
            "customer_id": bill.customer_id,
            "customer_name": bill.customer_name,
            "village": bill.village,
            "items": json.dumps([i.model_dump() for i in bill.items]),
            "total_amount": bill.total_amount,
            "payment_type": bill.payment_type,
            "paid_amount": bill.paid_amount,
            "cash_amount": bill.cash_amount,
            "upi_amount": bill.upi_amount,
            "balance_amount": balance,
            "date": now_iso(),
            "created_at": now_iso(),
        }
        conn.execute(
            """INSERT INTO bills (id,bill_no,customer_id,customer_name,village,items,total_amount,
               payment_type,paid_amount,cash_amount,upi_amount,balance_amount,date,created_at)
               VALUES (:id,:bill_no,:customer_id,:customer_name,:village,:items,:total_amount,
               :payment_type,:paid_amount,:cash_amount,:upi_amount,:balance_amount,:date,:created_at)""",
            obj,
        )
        for it in bill.items:
            conn.execute("UPDATE products SET quantity = quantity - ? WHERE id=?", (it.quantity, it.product_id))
    obj["items"] = json.loads(obj["items"])
    return obj


@api.get("/bills")
def get_bills(payment_type: Optional[str] = None, customer_id: Optional[str] = None,
              start_date: Optional[str] = None, end_date: Optional[str] = None):
    clauses, args = [], []
    if payment_type:
        clauses.append("payment_type=?"); args.append(payment_type)
    if customer_id:
        clauses.append("customer_id=?"); args.append(customer_id)
    if start_date:
        clauses.append("date>=?"); args.append(start_date)
    if end_date:
        clauses.append("date<=?"); args.append(end_date)
    q = "SELECT * FROM bills"
    if clauses:
        q += " WHERE " + " AND ".join(clauses)
    q += " ORDER BY bill_no DESC"
    with get_conn() as conn:
        rows = conn.execute(q, args).fetchall()
    return [row_to_bill(r) for r in rows]


@api.get("/bills/{bill_id}")
def get_bill(bill_id: str):
    with get_conn() as conn:
        r = conn.execute("SELECT * FROM bills WHERE id=?", (bill_id,)).fetchone()
    if not r:
        raise HTTPException(404, "Bill not found")
    return row_to_bill(r)


# --- Loans ---
@api.get("/loans/pending")
def pending_loans():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM bills WHERE balance_amount>0.01 ORDER BY date DESC").fetchall()
    return [row_to_bill(r) for r in rows]


@api.post("/loans/payment")
def record_payment(payment: LoanPaymentCreate):
    with _lock, get_conn() as conn:
        b = conn.execute("SELECT * FROM bills WHERE id=?", (payment.bill_id,)).fetchone()
        if not b:
            raise HTTPException(404, "Bill not found")
        if payment.amount > b["balance_amount"] + 0.01:
            raise HTTPException(400, "Payment amount exceeds balance")
        new_paid = b["paid_amount"] + payment.amount
        new_balance = max(0.0, b["total_amount"] - new_paid)
        conn.execute("UPDATE bills SET paid_amount=?, balance_amount=? WHERE id=?",
                     (new_paid, new_balance, payment.bill_id))
        obj = {"id": new_id(), "bill_id": payment.bill_id, "amount": payment.amount,
               "payment_date": now_iso(), "notes": payment.notes, "method": payment.method or "cash"}
        conn.execute("INSERT INTO loan_payments (id,bill_id,amount,payment_date,notes,method) VALUES (:id,:bill_id,:amount,:payment_date,:notes,:method)", obj)
    return obj


@api.get("/loans/payments/{bill_id}")
def bill_payments(bill_id: str):
    with get_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM loan_payments WHERE bill_id=?", (bill_id,)).fetchall()]


@api.get("/loans/customer/{customer_id}")
def customer_loans(customer_id: str):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM bills WHERE customer_id=? AND balance_amount>0.01", (customer_id,)).fetchall()
    bills = [row_to_bill(r) for r in rows]
    return {"bills": bills, "total_pending": sum(b["balance_amount"] for b in bills)}


# --- Dashboard ---
@api.get("/dashboard/stats")
def dashboard_stats():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with get_conn() as conn:
        today_bills = [row_to_bill(r) for r in conn.execute("SELECT * FROM bills WHERE date LIKE ?", (today + "%",)).fetchall()]
        pending = [row_to_bill(r) for r in conn.execute("SELECT * FROM bills WHERE balance_amount>0.01").fetchall()]
        low_stock = [dict(r) for r in conn.execute("SELECT * FROM products WHERE quantity<10").fetchall()]
        total_products = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"]
        total_customers = conn.execute("SELECT COUNT(*) AS c FROM customers").fetchone()["c"]
    return {
        "today_sales": sum(b["total_amount"] for b in today_bills),
        "today_cash": sum(b.get("paid_amount", 0) for b in today_bills),
        "today_credit": sum(b.get("balance_amount", 0) for b in today_bills),
        "total_pending_loans": sum(b["balance_amount"] for b in pending),
        "pending_loan_count": len(pending),
        "low_stock_items": low_stock,
        "low_stock_count": len(low_stock),
        "total_products": total_products,
        "total_customers": total_customers,
        "total_bills_today": len(today_bills),
    }


@api.get("/dashboard/recent-bills")
def recent_bills():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM bills ORDER BY date DESC LIMIT 10").fetchall()
    return [row_to_bill(r) for r in rows]


# --- Reports ---
@api.get("/reports/daily")
def daily_report(date: Optional[str] = None):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM bills WHERE date LIKE ? ORDER BY bill_no ASC", (date + "%",)).fetchall()
    bills = [row_to_bill(r) for r in rows]
    item_map = {}
    for b in bills:
        for it in b["items"]:
            k = it["product_name"]
            if k not in item_map:
                item_map[k] = {"product_name": k, "unit": it.get("unit", ""), "quantity": 0, "amount": 0}
            item_map[k]["quantity"] += it["quantity"]
            item_map[k]["amount"] += it["amount"]
    return {
        "date": date,
        "bills": bills,
        "summary": {
            "total_sales": sum(b["total_amount"] for b in bills),
            "total_paid": sum(b["paid_amount"] for b in bills),
            "total_credit": sum(b["balance_amount"] for b in bills),
            "bill_count": len(bills),
            "cash_bills": sum(1 for b in bills if b["payment_type"] == "cash"),
            "credit_bills": sum(1 for b in bills if b["payment_type"] == "credit"),
        },
        "items_summary": sorted(item_map.values(), key=lambda x: x["amount"], reverse=True),
    }


# --- Expenses ---
@api.post("/expenses")
def create_expense(e: ExpenseCreate):
    obj = {
        "id": new_id(), "amount": e.amount, "category": e.category,
        "note": e.note or "", "date": e.date or now_iso(), "created_at": now_iso(),
    }
    with _lock, get_conn() as conn:
        conn.execute("INSERT INTO expenses (id,amount,category,note,date,created_at) VALUES (:id,:amount,:category,:note,:date,:created_at)", obj)
    return obj


@api.get("/expenses")
def get_expenses(start_date: Optional[str] = None, end_date: Optional[str] = None):
    with get_conn() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM expenses ORDER BY date DESC").fetchall()]
    if start_date or end_date:
        rows = [x for x in rows if _in_range(x["date"], start_date, end_date)]
    return rows


@api.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str):
    with _lock, get_conn() as conn:
        cur = conn.execute("DELETE FROM expenses WHERE id=?", (expense_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Expense not found")
    return {"success": True}


# --- Purchases / Stock-in ---
@api.post("/purchases")
def create_purchase(p: PurchaseCreate):
    obj = {
        "id": new_id(), "supplier": p.supplier or "", "product_id": p.product_id,
        "product_name": p.product_name, "quantity": p.quantity, "unit": p.unit,
        "purchase_price": p.purchase_price, "total_cost": p.purchase_price * p.quantity,
        "batch_no": p.batch_no or "", "date": p.date or now_iso(), "created_at": now_iso(),
    }
    with _lock, get_conn() as conn:
        conn.execute(
            """INSERT INTO purchases (id,supplier,product_id,product_name,quantity,unit,purchase_price,
               total_cost,batch_no,date,created_at)
               VALUES (:id,:supplier,:product_id,:product_name,:quantity,:unit,:purchase_price,
               :total_cost,:batch_no,:date,:created_at)""", obj)
        if p.product_id and p.update_stock:
            conn.execute("UPDATE products SET quantity = quantity + ?, purchase_price = ? WHERE id=?",
                         (p.quantity, p.purchase_price, p.product_id))
    return obj


@api.get("/purchases")
def get_purchases(start_date: Optional[str] = None, end_date: Optional[str] = None):
    with get_conn() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM purchases ORDER BY date DESC").fetchall()]
    if start_date or end_date:
        rows = [x for x in rows if _in_range(x["date"], start_date, end_date)]
    return rows


@api.delete("/purchases/{purchase_id}")
def delete_purchase(purchase_id: str):
    with _lock, get_conn() as conn:
        r = conn.execute("SELECT * FROM purchases WHERE id=?", (purchase_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Purchase not found")
        conn.execute("DELETE FROM purchases WHERE id=?", (purchase_id,))
        if r["product_id"]:
            conn.execute("UPDATE products SET quantity = quantity - ? WHERE id=?", (r["quantity"], r["product_id"]))
    return {"success": True}


@api.post("/purchases/{purchase_id}/declare-in-stock")
def declare_purchase_in_stock(purchase_id: str, req: DeclareStockRequest):
    with _lock, get_conn() as conn:
        p = conn.execute("SELECT * FROM purchases WHERE id=?", (purchase_id,)).fetchone()
        if not p:
            raise HTTPException(404, "Purchase not found")
        
        pid = p["product_id"]
        if not pid:
            # Create new product
            pid = new_id()
            conn.execute(
                """INSERT INTO products (id,name,name_telugu,category_id,batch_no,mfg_date,exp_date,
                   purchase_price,mrp,selling_price,quantity,unit,bag_size_kg,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (pid, p["product_name"], req.name_telugu or "", req.category_id, p["batch_no"] or "",
                 req.mfg_date or "", req.exp_date or "", p["purchase_price"],
                 req.mrp or 0, req.selling_price or 0, p["quantity"], p["unit"], req.bag_size_kg or 0, now_iso()),
            )
            conn.execute("UPDATE purchases SET product_id=? WHERE id=?", (pid, purchase_id))
        else:
            # Update existing
            conn.execute("UPDATE products SET quantity = quantity + ?, purchase_price = ? WHERE id=?",
                         (p["quantity"], p["purchase_price"], pid))
            
    return {"success": True, "product_id": pid}


# --- Purchase Returns ---
@api.post("/purchase-returns")
def create_purchase_return(p: PurchaseReturnCreate):
    obj = {
        "id": new_id(), "supplier": p.supplier or "", "product_id": p.product_id,
        "product_name": p.product_name, "quantity": p.quantity, "unit": p.unit,
        "return_price": p.return_price, "total_refund": p.return_price * p.quantity,
        "batch_no": p.batch_no or "", "date": p.date or now_iso(), "created_at": now_iso(),
    }
    with _lock, get_conn() as conn:
        conn.execute(
            """INSERT INTO purchase_returns (id,supplier,product_id,product_name,quantity,unit,return_price,
               total_refund,batch_no,date,created_at)
               VALUES (:id,:supplier,:product_id,:product_name,:quantity,:unit,:return_price,
               :total_refund,:batch_no,:date,:created_at)""", obj)
        if p.product_id and p.update_stock:
            conn.execute("UPDATE products SET quantity = quantity - ? WHERE id=?",
                         (p.quantity, p.product_id))
    return obj


@api.get("/purchase-returns")
def get_purchase_returns(start_date: Optional[str] = None, end_date: Optional[str] = None):
    with get_conn() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM purchase_returns ORDER BY date DESC").fetchall()]
    if start_date or end_date:
        rows = [x for x in rows if _in_range(x["date"], start_date, end_date)]
    return rows


@api.delete("/purchase-returns/{return_id}")
def delete_purchase_return(return_id: str):
    with _lock, get_conn() as conn:
        r = conn.execute("SELECT * FROM purchase_returns WHERE id=?", (return_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Return not found")
        conn.execute("DELETE FROM purchase_returns WHERE id=?", (return_id,))
        if r["product_id"]:
            conn.execute("UPDATE products SET quantity = quantity + ? WHERE id=?", (r["quantity"], r["product_id"]))
    return {"success": True}


@api.get("/reports/accounts-segregated")
def accounts_segregated(start_date: Optional[str] = None, end_date: Optional[str] = None):
    today_s = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = start_date or today_s
    end_date = end_date or today_s

    with get_conn() as conn:
        bills_all = [row_to_bill(r) for r in conn.execute("SELECT * FROM bills").fetchall()]
        loans_all = [dict(r) for r in conn.execute("SELECT * FROM loan_payments").fetchall()]
        purchases_all = [dict(r) for r in conn.execute("SELECT * FROM purchases").fetchall()]
        expenses_all = [dict(r) for r in conn.execute("SELECT * FROM expenses").fetchall()]

    bills = [b for b in bills_all if _in_range(b.get("date"), start_date, end_date)]
    loans = [p for p in loans_all if _in_range(p.get("payment_date"), start_date, end_date)]
    purchases = [p for p in purchases_all if _in_range(p.get("date"), start_date, end_date)]
    expenses = [e for e in expenses_all if _in_range(e.get("date"), start_date, end_date)]

    # Farmer side
    farmer_sales = sum(b["total_amount"] for b in bills)
    farmer_cash_in = (
        sum(b.get("cash_amount", 0) or 0 for b in bills)
        + sum(b.get("paid_amount", 0) for b in bills if "cash_amount" not in b and b.get("payment_type") == "cash")
        + sum(p["amount"] for p in loans if p.get("method") == "cash")
    )
    farmer_upi_in = (
        sum(b.get("upi_amount", 0) or 0 for b in bills)
        + sum(b.get("paid_amount", 0) for b in bills if "upi_amount" not in b and b.get("payment_type") == "upi")
        + sum(p["amount"] for p in loans if p.get("method") == "upi")
    )
    farmer_credit_given = sum(b.get("balance_amount", 0) for b in bills)
    farmer_credit_recovered = sum(p["amount"] for p in loans)

    # My side
    my_purchases_total = sum(p["total_cost"] for p in purchases)
    my_purchases_by_method = {}
    for p in purchases:
        m = p.get("payment_method") or "cash"
        my_purchases_by_method[m] = my_purchases_by_method.get(m, 0) + (p.get("paid_amount", 0) or 0)
    my_credit_taken = sum(p.get("balance_amount", 0) for p in purchases)
    my_expenses_total = sum(e["amount"] for e in expenses)

    # Overall
    total_in = farmer_cash_in + farmer_upi_in
    total_out = sum(p.get("paid_amount", 0) or 0 for p in purchases) + my_expenses_total

    return {
        "start_date": start_date, "end_date": end_date,
        "farmer_side": {
            "sales": farmer_sales, "bill_count": len(bills),
            "cash_in": farmer_cash_in, "upi_in": farmer_upi_in,
            "credit_given": farmer_credit_given, "credit_recovered": farmer_credit_recovered,
        },
        "my_side": {
            "purchases_total": my_purchases_total, "purchase_count": len(purchases),
            "purchases_by_method": my_purchases_by_method,
            "credit_taken": my_credit_taken,
            "expenses": my_expenses_total, "expense_count": len(expenses),
        },
        "overall": {
            "money_in": total_in, "money_out": total_out,
            "net": total_in - total_out,
        },
    }


@api.get("/reports/summary")
def get_summary(start_date: Optional[str] = None, end_date: Optional[str] = None):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = start_date or today
    end_date = end_date or today
    with get_conn() as conn:
        bills = [row_to_bill(r) for r in conn.execute("SELECT * FROM bills").fetchall()]
        purchases = [dict(r) for r in conn.execute("SELECT * FROM purchases").fetchall()]
        expenses = [dict(r) for r in conn.execute("SELECT * FROM expenses").fetchall()]
        payments = [dict(r) for r in conn.execute("SELECT * FROM loan_payments").fetchall()]
        products = [dict(r) for r in conn.execute("SELECT * FROM products").fetchall()]
        returns = [dict(r) for r in conn.execute("SELECT * FROM purchase_returns").fetchall()]
    bills = [b for b in bills if _in_range(b.get("date"), start_date, end_date)]
    purchases = [p for p in purchases if _in_range(p.get("date"), start_date, end_date)]
    expenses = [e for e in expenses if _in_range(e.get("date"), start_date, end_date)]
    payments = [p for p in payments if _in_range(p.get("payment_date"), start_date, end_date)]
    returns = [r for r in returns if _in_range(r.get("date"), start_date, end_date)]
    cost_by_id = {p["id"]: p.get("purchase_price", 0) for p in products}

    total_sales = sum(b["total_amount"] for b in bills)
    cash_received = sum(b["paid_amount"] for b in bills)
    credit_given = sum(b["balance_amount"] for b in bills)
    loan_collections = sum(p["amount"] for p in payments)
    total_purchases = sum(p["total_cost"] for p in purchases)
    total_expenses = sum(e["amount"] for e in expenses)
    total_refunds = sum(r["total_refund"] for r in returns)

    cogs = 0
    for b in bills:
        for it in b.get("items", []):
            cogs += cost_by_id.get(it.get("product_id"), 0) * it.get("quantity", 0)
    gross_profit = total_sales - cogs

    cash_in = cash_received + loan_collections + total_refunds
    cash_out = total_purchases + total_expenses

    cat_map = {}
    for e in expenses:
        cat_map[e["category"]] = cat_map.get(e["category"], 0) + e["amount"]
    expenses_by_category = sorted([{"category": k, "amount": v} for k, v in cat_map.items()],
                                  key=lambda x: x["amount"], reverse=True)

    days = {}
    def ensure(d):
        if d not in days:
            days[d] = {"date": d, "sales": 0, "purchases": 0, "expenses": 0, "cash_in": 0, "cash_out": 0, "returns": 0}
        return days[d]
    for b in bills:
        x = ensure(b["date"][:10]); x["sales"] += b["total_amount"]; x["cash_in"] += b["paid_amount"]
    for p in payments:
        ensure(p["payment_date"][:10])["cash_in"] += p["amount"]
    for p in purchases:
        x = ensure(p["date"][:10]); x["purchases"] += p["total_cost"]; x["cash_out"] += p["total_cost"]
    for e in expenses:
        x = ensure(e["date"][:10]); x["expenses"] += e["amount"]; x["cash_out"] += e["amount"]
    for r in returns:
        x = ensure(r["date"][:10]); x["returns"] += r["total_refund"]; x["cash_in"] += r["total_refund"]
    for x in days.values():
        x["net_cash"] = x["cash_in"] - x["cash_out"]
    daily = sorted(days.values(), key=lambda x: x["date"])

    return {
        "period": {"start": start_date, "end": end_date},
        "sales": {"total": total_sales, "count": len(bills), "cash_received": cash_received, "credit_given": credit_given},
        "purchases": {"total": total_purchases, "count": len(purchases)},
        "purchase_returns": {"total": total_refunds, "count": len(returns)},
        "expenses": {"total": total_expenses, "count": len(expenses), "by_category": expenses_by_category},
        "loan_collections": loan_collections,
        "profit": {"revenue": total_sales, "cogs": cogs, "gross_profit": gross_profit, "net_profit": gross_profit - total_expenses},
        "cash_flow": {"inflow": cash_in, "outflow": cash_out, "net": cash_in - cash_out},
        "daily": daily,
    }


# --- Day Summary / Business Health ---
@api.get("/reports/day-summary")
def day_summary(date: Optional[str] = None):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    date = date or today
    ym = date[:7]
    y, m = int(ym[:4]), int(ym[5:7])
    pm_y, pm_m = (y, m - 1) if m > 1 else (y - 1, 12)
    prev_ym = f"{pm_y:04d}-{pm_m:02d}"

    with get_conn() as conn:
        bills_all = [row_to_bill(r) for r in conn.execute("SELECT * FROM bills").fetchall()]
        payments_all = [dict(r) for r in conn.execute("SELECT * FROM loan_payments").fetchall()]
        expenses_all = [dict(r) for r in conn.execute("SELECT * FROM expenses").fetchall()]
        products = [dict(r) for r in conn.execute("SELECT * FROM products").fetchall()]

    day_bills = [b for b in bills_all if (b.get('date') or '')[:10] == date]
    day_payments = [p for p in payments_all if (p.get('payment_date') or '')[:10] == date]
    day_expenses = [e for e in expenses_all if (e.get('date') or '')[:10] == date]

    cash_from_bills = sum(b.get('cash_amount', 0) or 0 for b in day_bills)
    upi_from_bills = sum(b.get('upi_amount', 0) or 0 for b in day_bills)
    cash_from_loans = sum(p['amount'] for p in day_payments if (p.get('method') or 'cash') == 'cash')
    upi_from_loans = sum(p['amount'] for p in day_payments if p.get('method') == 'upi')
    total_cash = cash_from_bills + cash_from_loans
    total_upi = upi_from_bills + upi_from_loans

    hamali = sum(e['amount'] for e in day_expenses if any(w in (e.get('category') or '').lower() for w in ['hamali', 'labor', 'labour']))
    all_day_expenses = sum(e['amount'] for e in day_expenses)
    other_expenses = all_day_expenses - hamali
    expected_drawer = total_cash - all_day_expenses

    item_map = {}
    for b in day_bills:
        for it in b['items']:
            k = it['product_name']
            item_map.setdefault(k, {"product_name": k, "unit": it.get('unit', ''), "quantity": 0, "amount": 0})
            item_map[k]['quantity'] += it['quantity']
            item_map[k]['amount'] += it['amount']
    top_items = sorted(item_map.values(), key=lambda x: x['quantity'], reverse=True)[:10]

    credit_issued = sum(b['balance_amount'] for b in day_bills)
    credit_recovered = sum(p['amount'] for p in day_payments)

    this_month_sales = sum(b['total_amount'] for b in bills_all if (b.get('date') or '')[:7] == ym)
    prev_month_sales = sum(b['total_amount'] for b in bills_all if (b.get('date') or '')[:7] == prev_ym)
    if prev_month_sales > 0:
        mom_growth = (this_month_sales - prev_month_sales) / prev_month_sales * 100
    else:
        mom_growth = 100.0 if this_month_sales > 0 else 0.0
    outstanding_credit = sum(b['balance_amount'] for b in bills_all if b['balance_amount'] > 0)

    expiring, low_stock = [], []
    todaydate = datetime.now(timezone.utc).date()
    for p in products:
        try:
            d = (datetime.strptime((p.get('exp_date') or '')[:10], "%Y-%m-%d").date() - todaydate).days
        except Exception:
            d = 9999
        if 0 <= d <= 60:
            expiring.append({"name": p['name'], "exp_date": p['exp_date'], "days_left": d, "quantity": p['quantity'], "unit": p.get('unit', '')})
        if p['quantity'] < 10:
            low_stock.append({"name": p['name'], "quantity": p['quantity'], "unit": p.get('unit', '')})
    expiring = sorted(expiring, key=lambda x: x['days_left'])

    return {
        "date": date,
        "cash_flow": {
            "cash_collected": total_cash, "upi_collected": total_upi,
            "hamali_payouts": hamali, "other_expenses": other_expenses,
            "expected_drawer_cash": expected_drawer, "total_collected": total_cash + total_upi,
        },
        "top_items": top_items,
        "khata": {"issued_today": credit_issued, "recovered_today": credit_recovered},
        "growth": {
            "this_month_sales": this_month_sales, "prev_month_sales": prev_month_sales,
            "mom_growth_pct": round(mom_growth, 1), "outstanding_market_credit": outstanding_credit,
        },
        "alerts": {
            "expiring": expiring, "low_stock": low_stock,
            "expiring_count": len(expiring), "low_stock_count": len(low_stock),
        },
    }


# --- Government subsidy CSV sync (MT -> bags) ---
def _parse_bag_size(name):
    mtch = re.search(r"(\d+(?:\.\d+)?)\s*kg", name or "", re.I)
    return float(mtch.group(1)) if mtch else 0

def _norm_name(name):
    return re.sub(r"\(.*?\)", "", name or "").strip().lower()

def _parse_subsidy_csv(text):
    for delim in [',', '\t']:
        try:
            rows = list(csv.DictReader(io.StringIO(text.strip()), delimiter=delim))
            if rows and len(rows[0].keys()) > 1:
                return rows
        except Exception:
            continue
    return []

def _build_subsidy_preview(text):
    rows = _parse_subsidy_csv(text)
    with get_conn() as conn:
        products = [dict(r) for r in conn.execute("SELECT * FROM products").fetchall()]
    by_norm = {_norm_name(p['name']): p for p in products}
    result = []
    for row in rows:
        keys = {k.lower().strip(): k for k in row.keys()}
        name = None
        for nk in ['product name', 'product', 'name', 'item']:
            if nk in keys:
                name = row[keys[nk]]; break
        if not name:
            continue
        sold_bags = None
        note = ""
        for cand in ['sold (bags)', 'sold bags', 'sold']:
            if cand in keys and row[keys[cand]] not in (None, ''):
                try:
                    sold_bags = float(row[keys[cand]]); break
                except Exception:
                    pass
        prod = by_norm.get(_norm_name(name))
        if sold_bags is None:
            for cand in ['sold (mt)', 'sold mt', 'mt', 'quantity (mt)', 'quantity']:
                if cand in keys and row[keys[cand]] not in (None, ''):
                    try:
                        mt = float(row[keys[cand]])
                        bag = (prod.get('bag_size_kg') if prod else 0) or _parse_bag_size(name)
                        if bag > 0:
                            sold_bags = mt * 1000 / bag
                            note = f"{mt} MT / {bag}kg = {sold_bags:.0f} bags"
                        else:
                            note = "No bag size set - cannot convert MT"
                        break
                    except Exception:
                        pass
        sb = int(round(sold_bags)) if sold_bags is not None else 0
        entry = {"product_name": name, "matched": bool(prod), "sold_bags": sb, "note": note}
        if prod:
            entry["product_id"] = prod['id']
            entry["current_stock"] = prod['quantity']
            entry["new_stock"] = prod['quantity'] - sb
        else:
            entry["note"] = (note + " | " if note else "") + "Not found in stock"
        result.append(entry)
    return result

@api.post("/subsidy/preview")
def subsidy_preview(payload: dict):
    return {"rows": _build_subsidy_preview(payload.get("csv", ""))}

@api.post("/subsidy/apply")
def subsidy_apply(payload: dict):
    rows = _build_subsidy_preview(payload.get("csv", ""))
    applied = 0
    with _lock, get_conn() as conn:
        for r in rows:
            if r.get("matched") and r.get("sold_bags", 0) > 0:
                conn.execute("UPDATE products SET quantity = quantity - ? WHERE id=?",
                             (int(r["sold_bags"]), r["product_id"]))
                applied += 1
    return {"applied": applied, "rows": rows}


# --- Data Management (info / export / reset auth) ---
import zipfile
from fastapi.responses import StreamingResponse

TABLES_TO_EXPORT = [
    "products", "categories", "customers", "bills",
    "loan_payments", "expenses", "purchases", "users",
]
USER_SAFE_FIELDS = ["id", "username", "role", "created_at"]
BACKUP_DIR = data_dir() / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _rows_to_csv_bytes(rows):
    if not rows:
        return b""
    keys = sorted({k for r in rows for k in r.keys()})
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=keys, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow({
            k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else ("" if v is None else v))
            for k, v in r.items()
        })
    return buf.getvalue().encode("utf-8")


def _collect_snapshot():
    """Read every table into (name -> list of dict rows)."""
    snap = {}
    with get_conn() as conn:
        for name in TABLES_TO_EXPORT:
            try:
                rows = [dict(r) for r in conn.execute(f"SELECT * FROM {name}").fetchall()]
            except sqlite3.OperationalError:
                rows = []
            if name == "bills":
                for r in rows:
                    if isinstance(r.get("items"), str):
                        try:
                            r["items"] = json.loads(r["items"])
                        except Exception:
                            pass
            if name == "users":
                rows = [{k: r.get(k) for k in USER_SAFE_FIELDS} for r in rows]
            snap[name] = rows
    return snap


def _write_backup_zip():
    snap = _collect_snapshot()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = BACKUP_DIR / f"backup_{ts}.zip"
    with zipfile.ZipFile(str(path), "w", zipfile.ZIP_DEFLATED) as zf:
        for name, rows in snap.items():
            zf.writestr(f"{name}.csv", _rows_to_csv_bytes(rows))
        zf.writestr("_metadata.json", json.dumps({
            "created_at": datetime.now(timezone.utc).isoformat(),
            "counts": {k: len(v) for k, v in snap.items()},
            "db_path": str(DB_PATH),
            "note": "Business-data snapshot. Users file excludes password hashes.",
        }, indent=2))
    return str(path), path.stat().st_size


@api.get("/data/info")
def data_info():
    counts = {}
    with get_conn() as conn:
        for name in TABLES_TO_EXPORT:
            try:
                counts[name] = conn.execute(f"SELECT COUNT(*) AS c FROM {name}").fetchone()["c"]
            except sqlite3.OperationalError:
                counts[name] = 0
    backups = []
    for p in sorted(BACKUP_DIR.glob("backup_*.zip"), reverse=True)[:10]:
        st = p.stat()
        backups.append({
            "name": p.name, "path": str(p), "size_bytes": st.st_size,
            "created_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
        })
    return {
        "backend": "sqlite",
        "db_path": str(DB_PATH),
        "data_dir": str(data_dir()),
        "backup_dir": str(BACKUP_DIR),
        "counts": counts,
        "recent_backups": backups,
    }


@api.get("/data/export")
def data_export():
    snap = _collect_snapshot()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, rows in snap.items():
            zf.writestr(f"{name}.csv", _rows_to_csv_bytes(rows))
        zf.writestr("_metadata.json", json.dumps({
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "counts": {k: len(v) for k, v in snap.items()},
            "db_path": str(DB_PATH),
        }, indent=2))
    buf.seek(0)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    fname = f"swarna_deepika_export_{ts}.zip"
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/data/backup/download/{name}")
def download_backup(name: str):
    if not re.match(r"^backup_[0-9_]+\.zip$", name):
        raise HTTPException(400, "Invalid backup filename")
    path = BACKUP_DIR / name
    if not path.is_file():
        raise HTTPException(404, "Backup not found")
    return FileResponse(str(path), media_type="application/zip", filename=name)


class ResetAuthRequest(BaseModel):
    confirm_phrase: str
    admin_username: str = "admin"
    admin_password: str


CONFIRM_PHRASES = {"RESET AUTH", "reset auth", "RESET-AUTH"}


@api.post("/data/reset-auth")
def reset_auth(req: ResetAuthRequest):
    if req.confirm_phrase not in CONFIRM_PHRASES:
        raise HTTPException(400, 'Please type "RESET AUTH" to confirm')
    with get_conn() as conn:
        caller = conn.execute("SELECT * FROM users WHERE username=?", (req.admin_username,)).fetchone()
    if not caller or not bcrypt.checkpw(req.admin_password.encode(), caller["password_hash"].encode()):
        raise HTTPException(401, "Current admin password is incorrect")

    backup_path, backup_size = _write_backup_zip()

    with _lock, get_conn() as conn:
        cur = conn.execute("DELETE FROM users")
        deleted = cur.rowcount
        hashed = bcrypt.hashpw("swarna123".encode(), bcrypt.gensalt()).decode()
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)",
            (new_id(), "admin", hashed, "admin", now_iso()),
        )

    return {
        "success": True,
        "backup_file": backup_path,
        "backup_filename": Path(backup_path).name,
        "backup_size_bytes": backup_size,
        "users_deleted": deleted,
        "reseeded_admin": {"username": "admin", "password": "swarna123"},
        "message": (
            f"Backed up ALL data to {backup_path} ({backup_size} bytes). "
            f"{deleted} user(s) removed. Default admin/swarna123 restored. "
            f"Business data (products, customers, bills, loans, purchases, expenses) is untouched."
        ),
    }


# --- Shop info ---
@api.get("/shop-info")
def shop_info():
    return {
        "name_english": "Swarna Deepika Fertilizers, Pesticides & Seeds",
        "name_telugu": "స్వర్ణదీపిక ఫర్టిలైజర్స్, పెస్టిసైడ్స్ & సీడ్స్",
        "address": "గ్రా॥ గంగారం, మం॥ కాటారం, జి॥ జయశంకర్ భూపాలపల్లి",
        "gstin": "36ASSPB9955F1Z8",
        "pl_no": "P/III/JSK/59/2023",
        "phone1": "9010067297",
        "phone2": "9347861548",
    }


@api.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


# --- Serve built React frontend (SPA) ---
if (STATIC_DIR / "static").exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR / "static")), name="assets")


@app.get("/{full_path:path}")
def spa(full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(404, "Not found")
    candidate = STATIC_DIR / full_path
    if full_path and candidate.is_file():
        return FileResponse(str(candidate))
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(str(index))
    return {"message": "Swarna Deepika Desktop API. Frontend build not bundled."}


if __name__ == "__main__":
    init_db()
    host = os.environ.get("SDB_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=PORT, log_level="warning")
