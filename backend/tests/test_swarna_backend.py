"""
Backend regression tests for Swarna Deepika Billing App.
Covers: auth (login, change-password, setup-recovery, recovery-status, reset-password),
expenses CRUD, purchases CRUD (with stock sync), reports/summary + reports/daily,
plus regression sanity for products/customers/bills.

IMPORTANT: leaves admin password back to 'swarna123' at the end.
"""

import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Frontend .env fallback for tests running from CI
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1]
                break
BASE_URL = (BASE_URL or "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PW = "swarna123"
SEC_ANSWER = "Gangaram"


@pytest.fixture(scope="session")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ---------- AUTH ----------

class TestAuth:
    def test_login_success(self, s):
        r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PW})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["user"]["username"] == ADMIN_USER

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": "wrongpw"})
        assert r.status_code == 401

    def test_change_password_wrong_current_rejected(self, s):
        r = s.post(f"{API}/auth/change-password", json={
            "username": ADMIN_USER,
            "current_password": "definitely-wrong",
            "new_password": "abcd1234",
        })
        assert r.status_code == 401

    def test_change_password_roundtrip(self, s):
        new_pw = "temp_pw_1234"
        # change
        r = s.post(f"{API}/auth/change-password", json={
            "username": ADMIN_USER, "current_password": ADMIN_PW, "new_password": new_pw,
        })
        assert r.status_code == 200, r.text
        # login with new
        r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": new_pw})
        assert r.status_code == 200
        # revert
        r = s.post(f"{API}/auth/change-password", json={
            "username": ADMIN_USER, "current_password": new_pw, "new_password": ADMIN_PW,
        })
        assert r.status_code == 200
        # login with original
        r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PW})
        assert r.status_code == 200

    def test_setup_recovery_and_status(self, s):
        r = s.post(f"{API}/auth/setup-recovery", json={
            "username": ADMIN_USER,
            "current_password": ADMIN_PW,
            "security_question": "Village name?",
            "security_answer": SEC_ANSWER,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["recovery_code"].startswith("SD-")
        # status endpoint reflects recovery configured
        r = s.get(f"{API}/auth/recovery-status", params={"username": ADMIN_USER})
        assert r.status_code == 200
        assert r.json()["has_recovery"] is True
        assert r.json()["security_question"] == "Village name?"

    def test_reset_password_with_answer_and_revert(self, s):
        new_pw = "reset_pw_5678"
        # reset using security answer (case-insensitive)
        r = s.post(f"{API}/auth/reset-password", json={
            "username": ADMIN_USER,
            "new_password": new_pw,
            "security_answer": SEC_ANSWER.lower(),
        })
        assert r.status_code == 200, r.text
        # login with new
        r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": new_pw})
        assert r.status_code == 200
        # revert via change-password so env stays clean
        r = s.post(f"{API}/auth/change-password", json={
            "username": ADMIN_USER, "current_password": new_pw, "new_password": ADMIN_PW,
        })
        assert r.status_code == 200

    def test_reset_password_wrong_answer_rejected(self, s):
        r = s.post(f"{API}/auth/reset-password", json={
            "username": ADMIN_USER,
            "new_password": "shouldnotwork1",
            "security_answer": "wrong-answer-xyz",
        })
        assert r.status_code == 401
        # ensure admin can still log in with original pw
        r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PW})
        assert r.status_code == 200


# ---------- EXPENSES ----------

class TestExpenses:
    def test_expense_crud_and_filter(self, s):
        tag = f"TEST_{uuid.uuid4().hex[:8]}"
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        payload = {"amount": 555.5, "category": tag, "note": "unit-test", "date": f"{today}T12:00:00Z"}
        r = s.post(f"{API}/expenses", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["amount"] == 555.5
        assert created["category"] == tag
        eid = created["id"]

        # GET with range including today
        r = s.get(f"{API}/expenses", params={"start_date": today, "end_date": today})
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert eid in ids

        # GET with range excluding today (past window)
        r = s.get(f"{API}/expenses", params={"start_date": "2000-01-01", "end_date": "2000-01-02"})
        assert r.status_code == 200
        assert eid not in [e["id"] for e in r.json()]

        # DELETE
        r = s.delete(f"{API}/expenses/{eid}")
        assert r.status_code == 200
        r = s.get(f"{API}/expenses", params={"start_date": today, "end_date": today})
        assert eid not in [e["id"] for e in r.json()]

    def test_delete_missing_expense_404(self, s):
        r = s.delete(f"{API}/expenses/does-not-exist-xyz")
        assert r.status_code == 404


# ---------- PURCHASES (with stock sync) ----------

@pytest.fixture
def temp_category(s):
    r = s.post(f"{API}/categories", json={"name": f"TEST_cat_{uuid.uuid4().hex[:6]}"})
    assert r.status_code == 200, r.text
    cat = r.json()
    yield cat
    s.delete(f"{API}/categories/{cat['id']}")


@pytest.fixture
def temp_product(s, temp_category):
    payload = {
        "name": f"TEST_prod_{uuid.uuid4().hex[:6]}",
        "name_telugu": "పరీక్ష",
        "category_id": temp_category["id"],
        "batch_no": "B1",
        "mfg_date": "2025-01-01",
        "exp_date": "2027-01-01",
        "purchase_price": 100.0,
        "mrp": 150.0,
        "selling_price": 140.0,
        "quantity": 20,
        "unit": "bag",
    }
    r = s.post(f"{API}/products", json=payload)
    assert r.status_code == 200, r.text
    prod = r.json()
    yield prod
    s.delete(f"{API}/products/{prod['id']}")


class TestPurchases:
    def test_purchase_with_product_updates_stock(self, s, temp_product):
        pid = temp_product["id"]
        # Get initial qty via admin endpoint
        r = s.get(f"{API}/products/admin")
        assert r.status_code == 200
        initial = next(p for p in r.json() if p["id"] == pid)
        initial_qty = initial["quantity"]

        r = s.post(f"{API}/purchases", json={
            "supplier": "TestSupplier",
            "product_id": pid,
            "product_name": temp_product["name"],
            "quantity": 5,
            "unit": "bag",
            "purchase_price": 110.0,
            "batch_no": "B2",
        })
        assert r.status_code == 200, r.text
        purchase = r.json()
        assert purchase["total_cost"] == 5 * 110.0

        # Stock incremented
        r = s.get(f"{API}/products/admin")
        after = next(p for p in r.json() if p["id"] == pid)
        assert after["quantity"] == initial_qty + 5
        # purchase_price also updated on product
        assert after["purchase_price"] == 110.0

        # Delete purchase -> stock reversed
        r = s.delete(f"{API}/purchases/{purchase['id']}")
        assert r.status_code == 200
        r = s.get(f"{API}/products/admin")
        rev = next(p for p in r.json() if p["id"] == pid)
        assert rev["quantity"] == initial_qty

    def test_purchase_freetext_does_not_touch_stock(self, s, temp_product):
        pid = temp_product["id"]
        r = s.get(f"{API}/products/admin")
        initial_qty = next(p for p in r.json() if p["id"] == pid)["quantity"]

        r = s.post(f"{API}/purchases", json={
            "supplier": "TestSupplier",
            "product_id": None,
            "product_name": "TEST_freetext_item",
            "quantity": 7,
            "unit": "kg",
            "purchase_price": 50.0,
        })
        assert r.status_code == 200, r.text
        purchase = r.json()

        # Stock of temp_product unchanged
        r = s.get(f"{API}/products/admin")
        same = next(p for p in r.json() if p["id"] == pid)["quantity"]
        assert same == initial_qty

        # cleanup
        s.delete(f"{API}/purchases/{purchase['id']}")

    def test_delete_missing_purchase_404(self, s):
        r = s.delete(f"{API}/purchases/does-not-exist-xyz")
        assert r.status_code == 404


# ---------- REPORTS ----------

class TestReports:
    def test_summary_shape(self, s):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = s.get(f"{API}/reports/summary", params={"start_date": today, "end_date": today})
        assert r.status_code == 200
        d = r.json()
        for key in ("period", "sales", "purchases", "expenses", "profit", "cash_flow", "daily"):
            assert key in d
        for key in ("revenue", "cogs", "gross_profit", "net_profit"):
            assert key in d["profit"]
        for key in ("inflow", "outflow", "net"):
            assert key in d["cash_flow"]
        assert "by_category" in d["expenses"]

    def test_daily_report(self, s):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = s.get(f"{API}/reports/daily", params={"date": today})
        assert r.status_code == 200
        d = r.json()
        assert d["date"] == today
        assert "summary" in d and "bills" in d and "items_summary" in d


# ---------- REGRESSION: BILLS / STOCK / CUSTOMERS ----------

class TestRegression:
    def test_shop_info_and_dashboard(self, s):
        r = s.get(f"{API}/shop-info")
        assert r.status_code == 200
        assert "Swarna Deepika" in r.json()["name_english"]

        r = s.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        for key in ("today_sales", "total_pending_loans", "total_products", "total_customers"):
            assert key in r.json()

    def test_bill_creation_decrements_stock(self, s, temp_product):
        pid = temp_product["id"]
        # Get initial qty
        r = s.get(f"{API}/products/admin")
        initial_qty = next(p for p in r.json() if p["id"] == pid)["quantity"]

        item = {
            "product_id": pid,
            "product_name": temp_product["name"],
            "batch_no": temp_product["batch_no"],
            "mfg_date": temp_product["mfg_date"],
            "exp_date": temp_product["exp_date"],
            "quantity": 2,
            "unit": temp_product["unit"],
            "rate": 140.0,
            "amount": 280.0,
        }
        bill_payload = {
            "customer_name": "TEST_customer",
            "village": "TEST_village",
            "items": [item],
            "total_amount": 280.0,
            "payment_type": "cash",
            "paid_amount": 280.0,
        }
        r = s.post(f"{API}/bills", json=bill_payload)
        assert r.status_code == 200, r.text
        bill = r.json()
        assert bill["balance_amount"] == 0
        assert bill["bill_no"] > 0

        # Stock decreased
        r = s.get(f"{API}/products/admin")
        after = next(p for p in r.json() if p["id"] == pid)["quantity"]
        assert after == initial_qty - 2
