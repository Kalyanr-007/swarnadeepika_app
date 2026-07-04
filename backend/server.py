from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
import secrets
import csv
import io
import re
from datetime import datetime, timezone
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

# User/Auth Models
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "staff"  # admin or staff

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Category Models
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Product Models
class ProductCreate(BaseModel):
    name: str
    name_telugu: Optional[str] = ""
    category_id: str
    batch_no: str
    mfg_date: str
    exp_date: str
    purchase_price: float  # Hidden from normal view
    mrp: float
    selling_price: float
    quantity: int
    unit: str = "piece"  # kg, litre, piece, packet, etc.
    bag_size_kg: float = 0  # weight per bag (for govt MT->bags conversion)

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

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    name_telugu: str = ""
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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProductPublic(BaseModel):
    """Product without purchase price - for public/staff view"""
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    name_telugu: str
    category_id: str
    batch_no: str
    mfg_date: str
    exp_date: str
    mrp: float
    selling_price: float
    quantity: int
    unit: str
    bag_size_kg: float = 0
    created_at: str

# Customer Models
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

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    village: str
    phone: str = ""
    address: str = ""
    aadhaar: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Bill Item Model
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

# Bill Models
class BillCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    village: str
    items: List[BillItem]
    total_amount: float
    payment_type: str  # "cash" or "credit"
    paid_amount: float = 0
    cash_amount: float = 0
    upi_amount: float = 0

class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bill_no: int
    customer_id: Optional[str] = None
    customer_name: str
    village: str
    items: List[BillItem]
    total_amount: float
    payment_type: str
    paid_amount: float
    cash_amount: float = 0
    upi_amount: float = 0
    balance_amount: float
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Loan/Credit Payment Model
class LoanPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bill_id: str
    amount: float
    payment_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    notes: str = ""

class LoanPaymentCreate(BaseModel):
    bill_id: str
    amount: float
    notes: str = ""
    method: str = "cash"  # cash or upi

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=User)
async def register_user(user: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
    
    user_obj = User(username=user.username, role=user.role)
    doc = user_obj.model_dump()
    doc['password_hash'] = hashed
    
    await db.users.insert_one(doc)
    return user_obj

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode(), user['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "success": True,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "role": user['role']
        }
    }

# ---- Password recovery / change ----

class ChangePasswordRequest(BaseModel):
    username: str
    current_password: str
    new_password: str

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

def _norm_answer(a: Optional[str]) -> str:
    return (a or "").strip().lower()

def _gen_recovery_code() -> str:
    raw = secrets.token_hex(6).upper()
    return f"SD-{raw[0:4]}-{raw[4:8]}-{raw[8:12]}"

@api_router.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest):
    user = await db.users.find_one({"username": req.username})
    if not user or not bcrypt.checkpw(req.current_password.encode(), user['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one({"username": req.username}, {"$set": {"password_hash": new_hash}})
    return {"success": True}

@api_router.post("/auth/setup-recovery")
async def setup_recovery(req: SetupRecoveryRequest):
    user = await db.users.find_one({"username": req.username})
    if not user or not bcrypt.checkpw(req.current_password.encode(), user['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    ans_hash = bcrypt.hashpw(_norm_answer(req.security_answer).encode(), bcrypt.gensalt()).decode()
    code = _gen_recovery_code()
    code_hash = bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one({"username": req.username}, {"$set": {
        "security_question": req.security_question,
        "security_answer_hash": ans_hash,
        "recovery_code_hash": code_hash,
    }})
    return {"success": True, "recovery_code": code}

@api_router.get("/auth/recovery-status")
async def recovery_status(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        return {"has_recovery": False, "security_question": None}
    return {
        "has_recovery": bool(user.get("security_answer_hash") or user.get("recovery_code_hash")),
        "security_question": user.get("security_question"),
    }

@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    user = await db.users.find_one({"username": req.username})
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect recovery answer or code")
    verified = False
    if req.recovery_code and user.get("recovery_code_hash"):
        if bcrypt.checkpw(req.recovery_code.strip().encode(), user["recovery_code_hash"].encode()):
            verified = True
    if not verified and req.security_answer and user.get("security_answer_hash"):
        if bcrypt.checkpw(_norm_answer(req.security_answer).encode(), user["security_answer_hash"].encode()):
            verified = True
    if not verified:
        raise HTTPException(status_code=401, detail="Incorrect recovery answer or code")
    if len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    update = {"password_hash": new_hash}
    if req.recovery_code:
        update["recovery_code_hash"] = None
    await db.users.update_one({"username": req.username}, {"$set": update})
    return {"success": True}

# ==================== CATEGORY ENDPOINTS ====================

@api_router.post("/categories", response_model=Category)
async def create_category(category: CategoryCreate):
    cat_obj = Category(**category.model_dump())
    doc = cat_obj.model_dump()
    await db.categories.insert_one(doc)
    return cat_obj

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return categories

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}

# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate):
    prod_obj = Product(**product.model_dump())
    doc = prod_obj.model_dump()
    await db.products.insert_one(doc)
    return prod_obj

@api_router.get("/products", response_model=List[ProductPublic])
async def get_products(category_id: Optional[str] = None, show_hidden: bool = False):
    query = {}
    if category_id:
        query["category_id"] = category_id
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    
    # Remove purchase_price for non-admin views
    if not show_hidden:
        for p in products:
            p.pop('purchase_price', None)
    
    return products

@api_router.get("/products/admin", response_model=List[Product])
async def get_products_admin(category_id: Optional[str] = None):
    """Admin endpoint - includes purchase price"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    return products

@api_router.get("/products/{product_id}", response_model=ProductPublic)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.pop('purchase_price', None)
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product: ProductUpdate):
    update_data = {k: v for k, v in product.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}

# ==================== CUSTOMER ENDPOINTS ====================

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    cust_obj = Customer(**customer.model_dump())
    doc = cust_obj.model_dump()
    await db.customers.insert_one(doc)
    return cust_obj

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(search: Optional[str] = None):
    query = {}
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"village": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]}
    customers = await db.customers.find(query, {"_id": 0}).to_list(1000)
    return customers

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer: CustomerUpdate):
    update_data = {k: v for k, v in customer.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return updated

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"success": True}

# ==================== BILL ENDPOINTS ====================

@api_router.post("/bills", response_model=Bill)
async def create_bill(bill: BillCreate):
    # Get next bill number
    last_bill = await db.bills.find_one(sort=[("bill_no", -1)])
    next_bill_no = (last_bill['bill_no'] + 1) if last_bill else 1

    # Payment split (cash / upi). Backward compatible with paid_amount.
    cash_amount = bill.cash_amount or 0
    upi_amount = bill.upi_amount or 0
    if cash_amount == 0 and upi_amount == 0 and bill.paid_amount:
        cash_amount = bill.paid_amount  # legacy: treat paid as cash
    paid = cash_amount + upi_amount
    balance = bill.total_amount - paid

    bill_obj = Bill(
        bill_no=next_bill_no,
        customer_id=bill.customer_id,
        customer_name=bill.customer_name,
        village=bill.village,
        items=[item.model_dump() for item in bill.items],
        total_amount=bill.total_amount,
        payment_type=bill.payment_type,
        paid_amount=paid,
        cash_amount=cash_amount,
        upi_amount=upi_amount,
        balance_amount=balance
    )
    
    doc = bill_obj.model_dump()
    await db.bills.insert_one(doc)
    
    # Update product stock
    for item in bill.items:
        await db.products.update_one(
            {"id": item.product_id},
            {"$inc": {"quantity": -item.quantity}}
        )
    
    return bill_obj

@api_router.get("/bills", response_model=List[Bill])
async def get_bills(
    payment_type: Optional[str] = None,
    customer_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = {}
    if payment_type:
        query["payment_type"] = payment_type
    if customer_id:
        query["customer_id"] = customer_id
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    bills = await db.bills.find(query, {"_id": 0}).sort("bill_no", -1).to_list(1000)
    return bills

@api_router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str):
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill

# ==================== LOAN/CREDIT ENDPOINTS ====================

@api_router.get("/loans/pending")
async def get_pending_loans():
    """Get all bills with pending balance"""
    bills = await db.bills.find(
        {"balance_amount": {"$gt": 0}},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    return bills

@api_router.post("/loans/payment", response_model=LoanPayment)
async def record_loan_payment(payment: LoanPaymentCreate):
    # Get the bill
    bill = await db.bills.find_one({"id": payment.bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if payment.amount > bill['balance_amount']:
        raise HTTPException(status_code=400, detail="Payment amount exceeds balance")
    
    # Update bill
    new_paid = bill['paid_amount'] + payment.amount
    new_balance = bill['total_amount'] - new_paid
    
    await db.bills.update_one(
        {"id": payment.bill_id},
        {"$set": {"paid_amount": new_paid, "balance_amount": new_balance}}
    )
    
    # Record payment
    payment_obj = LoanPayment(
        bill_id=payment.bill_id,
        amount=payment.amount,
        notes=payment.notes
    )
    doc = payment_obj.model_dump()
    doc['method'] = payment.method or "cash"
    await db.loan_payments.insert_one(doc)
    
    return payment_obj

@api_router.get("/loans/payments/{bill_id}", response_model=List[LoanPayment])
async def get_bill_payments(bill_id: str):
    payments = await db.loan_payments.find({"bill_id": bill_id}, {"_id": 0}).to_list(100)
    return payments

@api_router.get("/loans/customer/{customer_id}")
async def get_customer_loans(customer_id: str):
    """Get all pending loans for a customer"""
    bills = await db.bills.find(
        {"customer_id": customer_id, "balance_amount": {"$gt": 0}},
        {"_id": 0}
    ).to_list(100)
    
    total_pending = sum(b['balance_amount'] for b in bills)
    return {"bills": bills, "total_pending": total_pending}

# ==================== EXPENSES / PURCHASES / ACCOUNTS ====================

def _in_range(iso_date, start, end):
    d = (iso_date or "")[:10]
    if start and d < start:
        return False
    if end and d > end:
        return False
    return True

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

@api_router.post("/expenses")
async def create_expense(e: ExpenseCreate):
    obj = {
        "id": str(uuid.uuid4()),
        "amount": e.amount,
        "category": e.category,
        "note": e.note or "",
        "date": e.date or datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.expenses.insert_one(dict(obj))
    return obj

@api_router.get("/expenses")
async def get_expenses(start_date: Optional[str] = None, end_date: Optional[str] = None):
    items = await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(2000)
    if start_date or end_date:
        items = [x for x in items if _in_range(x["date"], start_date, end_date)]
    return items

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    r = await db.expenses.delete_one({"id": expense_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"success": True}

@api_router.post("/purchases")
async def create_purchase(p: PurchaseCreate):
    obj = {
        "id": str(uuid.uuid4()),
        "supplier": p.supplier or "",
        "product_id": p.product_id,
        "product_name": p.product_name,
        "quantity": p.quantity,
        "unit": p.unit,
        "purchase_price": p.purchase_price,
        "total_cost": p.purchase_price * p.quantity,
        "batch_no": p.batch_no or "",
        "date": p.date or datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.purchases.insert_one(dict(obj))
    if p.product_id and p.update_stock:
        await db.products.update_one(
            {"id": p.product_id},
            {"$inc": {"quantity": p.quantity}, "$set": {"purchase_price": p.purchase_price}},
        )
    return obj

@api_router.get("/purchases")
async def get_purchases(start_date: Optional[str] = None, end_date: Optional[str] = None):
    items = await db.purchases.find({}, {"_id": 0}).sort("date", -1).to_list(2000)
    if start_date or end_date:
        items = [x for x in items if _in_range(x["date"], start_date, end_date)]
    return items

@api_router.delete("/purchases/{purchase_id}")
async def delete_purchase(purchase_id: str):
    purchase = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    await db.purchases.delete_one({"id": purchase_id})
    if purchase.get("product_id"):
        await db.products.update_one({"id": purchase["product_id"]}, {"$inc": {"quantity": -purchase["quantity"]}})
    return {"success": True}

@api_router.get("/reports/summary")
async def get_summary(start_date: Optional[str] = None, end_date: Optional[str] = None):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = start_date or today
    end_date = end_date or today

    bills = [b for b in await db.bills.find({}, {"_id": 0}).to_list(5000) if _in_range(b["date"], start_date, end_date)]
    purchases = [p for p in await db.purchases.find({}, {"_id": 0}).to_list(5000) if _in_range(p["date"], start_date, end_date)]
    expenses = [e for e in await db.expenses.find({}, {"_id": 0}).to_list(5000) if _in_range(e["date"], start_date, end_date)]
    payments = [p for p in await db.loan_payments.find({}, {"_id": 0}).to_list(5000) if _in_range(p["payment_date"], start_date, end_date)]
    products = await db.products.find({}, {"_id": 0}).to_list(5000)
    cost_by_id = {p["id"]: p.get("purchase_price", 0) for p in products}

    total_sales = sum(b["total_amount"] for b in bills)
    cash_received = sum(b["paid_amount"] for b in bills)
    credit_given = sum(b["balance_amount"] for b in bills)
    loan_collections = sum(p["amount"] for p in payments)
    total_purchases = sum(p["total_cost"] for p in purchases)
    total_expenses = sum(e["amount"] for e in expenses)

    cogs = 0
    for b in bills:
        for it in b["items"]:
            cogs += cost_by_id.get(it.get("product_id"), 0) * it["quantity"]
    gross_profit = total_sales - cogs
    net_profit = gross_profit - total_expenses

    cash_in = cash_received + loan_collections
    cash_out = total_purchases + total_expenses

    cat_map = {}
    for e in expenses:
        cat_map[e["category"]] = cat_map.get(e["category"], 0) + e["amount"]
    expenses_by_category = sorted(
        [{"category": k, "amount": v} for k, v in cat_map.items()],
        key=lambda x: x["amount"], reverse=True,
    )

    days = {}
    def ensure(d):
        if d not in days:
            days[d] = {"date": d, "sales": 0, "purchases": 0, "expenses": 0, "cash_in": 0, "cash_out": 0}
        return days[d]
    for b in bills:
        x = ensure(b["date"][:10]); x["sales"] += b["total_amount"]; x["cash_in"] += b["paid_amount"]
    for p in payments:
        ensure(p["payment_date"][:10])["cash_in"] += p["amount"]
    for p in purchases:
        x = ensure(p["date"][:10]); x["purchases"] += p["total_cost"]; x["cash_out"] += p["total_cost"]
    for e in expenses:
        x = ensure(e["date"][:10]); x["expenses"] += e["amount"]; x["cash_out"] += e["amount"]
    for x in days.values():
        x["net_cash"] = x["cash_in"] - x["cash_out"]
    daily = sorted(days.values(), key=lambda x: x["date"])

    return {
        "period": {"start": start_date, "end": end_date},
        "sales": {"total": total_sales, "count": len(bills), "cash_received": cash_received, "credit_given": credit_given},
        "purchases": {"total": total_purchases, "count": len(purchases)},
        "expenses": {"total": total_expenses, "count": len(expenses), "by_category": expenses_by_category},
        "loan_collections": loan_collections,
        "profit": {"revenue": total_sales, "cogs": cogs, "gross_profit": gross_profit, "net_profit": net_profit},
        "cash_flow": {"inflow": cash_in, "outflow": cash_out, "net": cash_in - cash_out},
        "daily": daily,
    }

# ==================== DAY SUMMARY / BUSINESS HEALTH ====================

@api_router.get("/reports/day-summary")
async def day_summary(date: Optional[str] = None):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    date = date or today
    ym = date[:7]
    y, m = int(ym[:4]), int(ym[5:7])
    pm_y, pm_m = (y, m - 1) if m > 1 else (y - 1, 12)
    prev_ym = f"{pm_y:04d}-{pm_m:02d}"

    bills_all = await db.bills.find({}, {"_id": 0}).to_list(10000)
    payments_all = await db.loan_payments.find({}, {"_id": 0}).to_list(10000)
    expenses_all = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    products = await db.products.find({}, {"_id": 0}).to_list(10000)

    day_bills = [b for b in bills_all if (b.get('date') or '')[:10] == date]
    day_payments = [p for p in payments_all if (p.get('payment_date') or '')[:10] == date]
    day_expenses = [e for e in expenses_all if (e.get('date') or '')[:10] == date]

    cash_from_bills = sum(b.get('cash_amount', 0) for b in day_bills)
    upi_from_bills = sum(b.get('upi_amount', 0) for b in day_bills)
    cash_from_loans = sum(p['amount'] for p in day_payments if p.get('method', 'cash') == 'cash')
    upi_from_loans = sum(p['amount'] for p in day_payments if p.get('method') == 'upi')
    total_cash = cash_from_bills + cash_from_loans
    total_upi = upi_from_bills + upi_from_loans

    hamali = sum(e['amount'] for e in day_expenses if any(w in e['category'].lower() for w in ['hamali', 'labor', 'labour']))
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
            d = (datetime.strptime(p['exp_date'][:10], "%Y-%m-%d").date() - todaydate).days
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

# ==================== GOVERNMENT SUBSIDY CSV SYNC ====================

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

async def _build_subsidy_preview(text):
    rows = _parse_subsidy_csv(text)
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    by_norm = {}
    for p in products:
        by_norm[_norm_name(p['name'])] = p
    result = []
    for row in rows:
        keys = {k.lower().strip(): k for k in row.keys()}
        name = None
        for nk in ['product name', 'product', 'name', 'item']:
            if nk in keys:
                name = row[keys[nk]]
                break
        if not name:
            continue
        sold_bags = None
        note = ""
        for cand in ['sold (bags)', 'sold bags', 'sold']:
            if cand in keys and row[keys[cand]] not in (None, ''):
                try:
                    sold_bags = float(row[keys[cand]])
                    break
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
                            note = f"{mt} MT ÷ {bag}kg = {sold_bags:.0f} bags"
                        else:
                            note = "No bag size set — cannot convert MT"
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

@api_router.post("/subsidy/preview")
async def subsidy_preview(payload: dict):
    return {"rows": await _build_subsidy_preview(payload.get("csv", ""))}

@api_router.post("/subsidy/apply")
async def subsidy_apply(payload: dict):
    rows = await _build_subsidy_preview(payload.get("csv", ""))
    applied = 0
    for r in rows:
        if r.get("matched") and r.get("sold_bags", 0) > 0:
            await db.products.update_one({"id": r["product_id"]}, {"$inc": {"quantity": -int(r["sold_bags"])}})
            applied += 1
    return {"applied": applied, "rows": rows}

# ==================== DASHBOARD ENDPOINTS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    # Total sales today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_bills = await db.bills.find(
        {"date": {"$regex": f"^{today}"}},
        {"_id": 0}
    ).to_list(1000)
    today_sales = sum(b['total_amount'] for b in today_bills)
    today_cash = sum(b['paid_amount'] for b in today_bills if b['payment_type'] == 'cash')
    today_credit = sum(b['total_amount'] - b['paid_amount'] for b in today_bills if b['payment_type'] == 'credit')
    
    # Total pending loans
    pending_bills = await db.bills.find({"balance_amount": {"$gt": 0}}, {"_id": 0}).to_list(1000)
    total_pending = sum(b['balance_amount'] for b in pending_bills)
    
    # Low stock items (quantity < 10)
    low_stock = await db.products.find({"quantity": {"$lt": 10}}, {"_id": 0}).to_list(100)
    
    # Total products
    total_products = await db.products.count_documents({})
    
    # Total customers
    total_customers = await db.customers.count_documents({})
    
    # Total bills today
    total_bills_today = len(today_bills)
    
    return {
        "today_sales": today_sales,
        "today_cash": today_cash,
        "today_credit": today_credit,
        "total_pending_loans": total_pending,
        "pending_loan_count": len(pending_bills),
        "low_stock_items": low_stock,
        "low_stock_count": len(low_stock),
        "total_products": total_products,
        "total_customers": total_customers,
        "total_bills_today": total_bills_today
    }

@api_router.get("/dashboard/recent-bills")
async def get_recent_bills():
    bills = await db.bills.find({}, {"_id": 0}).sort("date", -1).to_list(10)
    return bills

# ==================== REPORTS ENDPOINTS ====================

@api_router.get("/reports/daily")
async def get_daily_report(date: Optional[str] = None):
    """Daily sales record: who bought, which items, on a given date (YYYY-MM-DD)."""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    bills = await db.bills.find(
        {"date": {"$regex": f"^{date}"}}, {"_id": 0}
    ).sort("bill_no", 1).to_list(1000)

    total_sales = sum(b['total_amount'] for b in bills)
    total_paid = sum(b['paid_amount'] for b in bills)
    total_credit = sum(b['balance_amount'] for b in bills)
    cash_bills = sum(1 for b in bills if b['payment_type'] == 'cash')
    credit_bills = sum(1 for b in bills if b['payment_type'] == 'credit')

    # Aggregate items sold for the day
    item_map = {}
    for b in bills:
        for it in b['items']:
            key = it['product_name']
            if key not in item_map:
                item_map[key] = {"product_name": key, "unit": it.get('unit', ''), "quantity": 0, "amount": 0}
            item_map[key]['quantity'] += it['quantity']
            item_map[key]['amount'] += it['amount']
    items_summary = sorted(item_map.values(), key=lambda x: x['amount'], reverse=True)

    return {
        "date": date,
        "bills": bills,
        "summary": {
            "total_sales": total_sales,
            "total_paid": total_paid,
            "total_credit": total_credit,
            "bill_count": len(bills),
            "cash_bills": cash_bills,
            "credit_bills": credit_bills,
        },
        "items_summary": items_summary,
    }

# ==================== SHOP INFO ====================

@api_router.get("/shop-info")
async def get_shop_info():
    return {
        "name_english": "Swarna Deepika Fertilizers, Pesticides & Seeds",
        "name_telugu": "స్వర్ణదీపిక ఫర్టిలైజర్స్, పెస్టిసైడ్స్ & సీడ్స్",
        "address": "గ్రా॥ గంగారం, మం॥ కాటారం, జి॥ జయశంకర్ భూపాలపల్లి",
        "gstin": "36ASSPB9955F1Z8",
        "pl_no": "P/III/JSK/59/2023",
        "phone1": "9010067297",
        "phone2": "9347861548"
    }

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Swarna Deepika Billing API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
