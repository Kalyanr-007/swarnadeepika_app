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
    created_at: str

# Customer Models
class CustomerCreate(BaseModel):
    name: str
    village: str
    phone: Optional[str] = ""
    address: Optional[str] = ""

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    village: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    village: str
    phone: str = ""
    address: str = ""
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
    
    # Calculate balance
    balance = bill.total_amount - bill.paid_amount
    
    bill_obj = Bill(
        bill_no=next_bill_no,
        customer_id=bill.customer_id,
        customer_name=bill.customer_name,
        village=bill.village,
        items=[item.model_dump() for item in bill.items],
        total_amount=bill.total_amount,
        payment_type=bill.payment_type,
        paid_amount=bill.paid_amount,
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
