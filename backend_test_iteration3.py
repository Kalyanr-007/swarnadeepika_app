import requests
import sys
import json
import zipfile
import io
from datetime import datetime, timezone

class Iteration3Tester:
    def __init__(self, base_url="https://farm-app-repair.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_category_id = None
        self.test_product_id = None
        self.supplier_id = None
        self.purchase_id_new_product = None
        self.purchase_id_existing_product = None
        self.purchase_id_not_declared = None
        self.purchase_id_declared = None
        self.created_product_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, validate_fn=None):
        """Run a single API test with optional validation function"""
        url = f"{self.base_url}/api/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=30)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            # Additional validation if provided
            if success and validate_fn:
                validation_result = validate_fn(response_data)
                if not validation_result[0]:
                    success = False
                    self.log_test(name, False, f"Validation failed: {validation_result[1]}")
                    return False, response_data

            if success:
                self.log_test(name, True)
                return True, response_data
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}: {response.text[:200]}")
                return False, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_auth(self):
        """Test 0: Login with admin credentials"""
        print("\n🔐 Test 0: Authentication")
        
        success, response = self.run_test(
            "Login with admin/swarna123",
            "POST",
            "auth/login",
            200,
            data={
                "username": "admin",
                "password": "swarna123"
            },
            validate_fn=lambda r: (
                (r.get('success') == True and 'user' in r, "Response should have success=true and user object")
                if r.get('success') == True else (False, f"Login failed: {r}")
            )
        )
        
        if not success:
            print("⚠️ CRITICAL: Admin login failed - cannot proceed with tests")
            return False
        
        return True

    def setup_test_data(self):
        """Setup: Create category and product for testing"""
        print("\n🔧 Setup: Creating test category and product")
        
        # Get existing categories
        success, response = self.run_test(
            "Get existing categories",
            "GET",
            "categories",
            200
        )
        
        if success and len(response) > 0:
            self.test_category_id = response[0]['id']
            print(f"  Using existing category: {response[0].get('name')} (id: {self.test_category_id})")
        else:
            # Create category
            success, response = self.run_test(
                "Create test category",
                "POST",
                "categories",
                200,
                data={
                    "name": "Test Category",
                    "description": "For iteration 3 testing"
                }
            )
            if success:
                self.test_category_id = response.get('id')
        
        if not self.test_category_id:
            print("⚠️ CRITICAL: No category available")
            return False
        
        # Create a product for existing product path testing
        product_data = {
            "name": "Test Product for Restock",
            "name_telugu": "టెస్ట్",
            "category_id": self.test_category_id,
            "batch_no": "BATCH001",
            "mfg_date": "2024-01-01",
            "exp_date": "2027-12-31",
            "purchase_price": 100.0,
            "mrp": 120.0,
            "selling_price": 110.0,
            "quantity": 50,
            "unit": "piece",
            "bag_size_kg": 1.0
        }
        
        success, response = self.run_test(
            "Create test product for restock testing",
            "POST",
            "products",
            200,
            data=product_data
        )
        
        if success:
            self.test_product_id = response.get('id')
            print(f"  Created test product: {response.get('name')} (id: {self.test_product_id})")
        else:
            print("⚠️ CRITICAL: Failed to create test product")
            return False
        
        return True

    def test_suppliers_crud(self):
        """Test A: Suppliers CRUD"""
        print("\n📋 Test A: Suppliers CRUD")
        
        # A1: POST /api/suppliers
        supplier_data = {
            "name": "AgroChem Ltd",
            "phone": "9111111111",
            "address": "Vijayawada",
            "items_supplied": ["Fertilizers", "Pesticides"],
            "notes": "Bulk"
        }
        
        success, response = self.run_test(
            "A1: POST /api/suppliers - create supplier",
            "POST",
            "suppliers",
            200,
            data=supplier_data,
            validate_fn=lambda r: (
                ('id' in r and r.get('name') == 'AgroChem Ltd' and r.get('phone') == '9111111111',
                 f"Response should have id and all fields, got: {r}")
            )
        )
        
        if success:
            self.supplier_id = response.get('id')
        else:
            print("⚠️ CRITICAL: Failed to create supplier")
            return False
        
        # A2: GET /api/suppliers - list contains new supplier
        success, response = self.run_test(
            "A2: GET /api/suppliers - list contains new supplier",
            "GET",
            "suppliers",
            200,
            validate_fn=lambda r: (
                (any(s.get('id') == self.supplier_id for s in r),
                 f"Supplier list should contain newly created supplier")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # A3: GET /api/suppliers?q=agro - filter by name substring
        success, response = self.run_test(
            "A3: GET /api/suppliers?q=agro - filter by name substring",
            "GET",
            "suppliers?q=agro",
            200,
            validate_fn=lambda r: (
                (any('agro' in s.get('name', '').lower() for s in r),
                 f"Filtered list should contain suppliers with 'agro' in name")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # A4: GET /api/suppliers?q=911 - filter by phone
        success, response = self.run_test(
            "A4: GET /api/suppliers?q=911 - filter by phone",
            "GET",
            "suppliers?q=911",
            200,
            validate_fn=lambda r: (
                (any('911' in s.get('phone', '') for s in r),
                 f"Filtered list should contain suppliers with '911' in phone")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # A5: GET /api/suppliers/{id} - get single supplier
        success, response = self.run_test(
            "A5: GET /api/suppliers/{id} - get single supplier",
            "GET",
            f"suppliers/{self.supplier_id}",
            200,
            validate_fn=lambda r: (
                (r.get('id') == self.supplier_id and r.get('name') == 'AgroChem Ltd',
                 f"Should return correct supplier")
            )
        )
        
        # A5b: GET /api/suppliers/{wrong_id} - 404
        success, response = self.run_test(
            "A5b: GET /api/suppliers/{wrong_id} - returns 404",
            "GET",
            "suppliers/nonexistent-id-12345",
            404
        )
        
        # A6: PUT /api/suppliers/{id} - update notes
        success, response = self.run_test(
            "A6: PUT /api/suppliers/{id} - update notes",
            "PUT",
            f"suppliers/{self.supplier_id}",
            200,
            data={"notes": "Updated"},
            validate_fn=lambda r: (
                (r.get('notes') == 'Updated',
                 f"Notes should be updated to 'Updated', got: {r.get('notes')}")
            )
        )
        
        # A6b: PUT /api/suppliers/{id} with empty body - 400
        success, response = self.run_test(
            "A6b: PUT /api/suppliers/{id} with empty body - returns 400",
            "PUT",
            f"suppliers/{self.supplier_id}",
            400,
            data={}
        )
        
        # A7: DELETE /api/suppliers/{id}
        # First create a temporary supplier to delete
        success, temp_response = self.run_test(
            "Create temporary supplier for deletion test",
            "POST",
            "suppliers",
            200,
            data={
                "name": "Temp Supplier",
                "phone": "9999999999"
            }
        )
        
        if success:
            temp_id = temp_response.get('id')
            
            # Delete it
            success, response = self.run_test(
                "A7: DELETE /api/suppliers/{id} - first delete",
                "DELETE",
                f"suppliers/{temp_id}",
                200,
                validate_fn=lambda r: (
                    (r.get('success') == True, "Should return success=true")
                )
            )
            
            # Try to delete again - should return 404
            success, response = self.run_test(
                "A7b: DELETE /api/suppliers/{id} - second delete returns 404",
                "DELETE",
                f"suppliers/{temp_id}",
                404
            )
        
        return True

    def test_purchase_with_payment_method(self):
        """Test B: Purchase with payment method (does NOT touch stock)"""
        print("\n💳 Test B: Purchase with payment method (no stock update)")
        
        # B1: POST /api/purchases with UPI payment
        purchase_data = {
            "supplier": "BrandNewSupplier",
            "supplier_phone": "9222222222",
            "product_name": "Test Fungicide 500ml",
            "quantity": 20,
            "unit": "bottle",
            "purchase_price": 150,
            "payment_method": "upi",
            "reference_number": "UPI-TEST-123"
        }
        
        success, response = self.run_test(
            "B1: POST /api/purchases with UPI payment",
            "POST",
            "purchases",
            200,
            data=purchase_data,
            validate_fn=lambda r: (
                (r.get('declared_in_stock') == False and 
                 r.get('balance_amount') == 0 and 
                 r.get('paid_amount') == 3000,
                 f"Should have declared_in_stock=false, balance_amount=0, paid_amount=3000, got: declared={r.get('declared_in_stock')}, balance={r.get('balance_amount')}, paid={r.get('paid_amount')}")
            )
        )
        
        if success:
            self.purchase_id_new_product = response.get('id')
        else:
            print("⚠️ CRITICAL: Failed to create purchase")
            return False
        
        # B2: Verify purchase is in GET /api/purchases
        success, response = self.run_test(
            "B2: GET /api/purchases - verify purchase exists",
            "GET",
            "purchases",
            200,
            validate_fn=lambda r: (
                (any(p.get('id') == self.purchase_id_new_product for p in r),
                 f"Purchase list should contain newly created purchase")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # B3: Verify BrandNewSupplier now appears in GET /api/suppliers with auto-created notes
        success, response = self.run_test(
            "B3: GET /api/suppliers - verify auto-created supplier",
            "GET",
            "suppliers",
            200,
            validate_fn=lambda r: (
                (any(s.get('name') == 'BrandNewSupplier' and 'auto-created' in s.get('notes', '').lower() for s in r),
                 f"Supplier list should contain BrandNewSupplier with auto-created notes")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # B4: Verify /api/products does NOT contain "Test Fungicide 500ml" yet
        success, response = self.run_test(
            "B4: GET /api/products/admin - verify product NOT in stock yet",
            "GET",
            "products/admin",
            200,
            validate_fn=lambda r: (
                (not any('Test Fungicide 500ml' in p.get('name', '') for p in r),
                 f"Product list should NOT contain 'Test Fungicide 500ml' yet")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        return True

    def test_purchase_with_credit(self):
        """Test C: Purchase with credit payment"""
        print("\n💰 Test C: Purchase with credit payment")
        
        # C1: POST /api/purchases with credit (no paid_amount)
        purchase_data = {
            "supplier": "AgroChem Ltd",
            "product_name": "Test Product Credit",
            "quantity": 10,
            "unit": "bag",
            "purchase_price": 500,
            "payment_method": "credit"
        }
        
        success, response = self.run_test(
            "C1: POST /api/purchases with credit (no paid_amount)",
            "POST",
            "purchases",
            200,
            data=purchase_data,
            validate_fn=lambda r: (
                (r.get('paid_amount') == 0 and r.get('balance_amount') == 5000,
                 f"Should have paid_amount=0, balance_amount=5000, got: paid={r.get('paid_amount')}, balance={r.get('balance_amount')}")
            )
        )
        
        # C2: POST /api/purchases with credit and partial payment
        purchase_data_partial = {
            "supplier": "AgroChem Ltd",
            "product_name": "Test Product Credit Partial",
            "quantity": 10,
            "unit": "bag",
            "purchase_price": 500,
            "payment_method": "credit",
            "paid_amount": 2000
        }
        
        success, response = self.run_test(
            "C2: POST /api/purchases with credit and paid_amount=2000",
            "POST",
            "purchases",
            200,
            data=purchase_data_partial,
            validate_fn=lambda r: (
                (r.get('paid_amount') == 2000 and r.get('balance_amount') == 3000,
                 f"Should have paid_amount=2000, balance_amount=3000, got: paid={r.get('paid_amount')}, balance={r.get('balance_amount')}")
            )
        )
        
        return True

    def test_declare_in_stock_new_product(self):
        """Test D: Declare in Stock - NEW product path"""
        print("\n📦 Test D: Declare in Stock - NEW product path")
        
        if not self.purchase_id_new_product:
            print("⚠️ CRITICAL: No purchase_id_new_product available")
            return False
        
        # D1: POST declare-in-stock with NO body - should return 400 (category required)
        success, response = self.run_test(
            "D1: POST declare-in-stock with NO body - returns 400",
            "POST",
            f"purchases/{self.purchase_id_new_product}/declare-in-stock",
            400,
            data={}
        )
        
        # D2: POST declare-in-stock with category_id and other fields
        declare_data = {
            "category_id": self.test_category_id,
            "mrp": 180,
            "selling_price": 170,
            "exp_date": "2027-01-01",
            "bag_size_kg": 0.5
        }
        
        success, response = self.run_test(
            "D2: POST declare-in-stock with category_id - returns 200",
            "POST",
            f"purchases/{self.purchase_id_new_product}/declare-in-stock",
            200,
            data=declare_data,
            validate_fn=lambda r: (
                (r.get('success') == True and 'product_id' in r,
                 f"Should return success=true and product_id, got: {r}")
            )
        )
        
        if success:
            self.created_product_id = response.get('product_id')
        else:
            print("⚠️ CRITICAL: Failed to declare in stock")
            return False
        
        # D3: GET /api/products/admin - verify product now exists with quantity=20 and purchase_price=150
        success, response = self.run_test(
            "D3: GET /api/products/admin - verify product created with correct quantity and price",
            "GET",
            "products/admin",
            200,
            validate_fn=lambda r: (
                (any(p.get('id') == self.created_product_id and 
                     p.get('name') == 'Test Fungicide 500ml' and
                     p.get('quantity') == 20 and 
                     p.get('purchase_price') == 150 for p in r),
                 f"Product list should contain 'Test Fungicide 500ml' with quantity=20 and purchase_price=150")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # D4: POST declare again on same purchase - should return 400 (already declared)
        success, response = self.run_test(
            "D4: POST declare-in-stock again - returns 400 (already declared)",
            "POST",
            f"purchases/{self.purchase_id_new_product}/declare-in-stock",
            400,
            data=declare_data
        )
        
        # D5: GET /api/purchases - verify purchase now shows declared_in_stock=true
        success, response = self.run_test(
            "D5: GET /api/purchases - verify declared_in_stock=true",
            "GET",
            "purchases",
            200,
            validate_fn=lambda r: (
                (any(p.get('id') == self.purchase_id_new_product and p.get('declared_in_stock') == True for p in r),
                 f"Purchase should have declared_in_stock=true")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        return True

    def test_declare_in_stock_existing_product(self):
        """Test E: Declare in Stock - EXISTING product path"""
        print("\n📦 Test E: Declare in Stock - EXISTING product path")
        
        if not self.test_product_id:
            print("⚠️ CRITICAL: No test_product_id available")
            return False
        
        # E1: Get current product quantity
        success, response = self.run_test(
            "E1: GET product quantity before restock",
            "GET",
            "products/admin",
            200
        )
        
        initial_quantity = None
        if success:
            for p in response:
                if p.get('id') == self.test_product_id:
                    initial_quantity = p.get('quantity')
                    print(f"  Initial quantity: {initial_quantity}")
                    break
        
        if initial_quantity is None:
            print("⚠️ CRITICAL: Could not find test product")
            return False
        
        # E2: POST /api/purchases with product_id
        purchase_data = {
            "product_id": self.test_product_id,
            "product_name": "restock item",
            "quantity": 5,
            "unit": "bag",
            "purchase_price": 100,
            "payment_method": "cash"
        }
        
        success, response = self.run_test(
            "E2: POST /api/purchases with product_id",
            "POST",
            "purchases",
            200,
            data=purchase_data
        )
        
        if success:
            self.purchase_id_existing_product = response.get('id')
        else:
            print("⚠️ CRITICAL: Failed to create purchase")
            return False
        
        # E3: POST declare-in-stock with EMPTY body - should work (category not required)
        success, response = self.run_test(
            "E3: POST declare-in-stock with EMPTY body - returns 200",
            "POST",
            f"purchases/{self.purchase_id_existing_product}/declare-in-stock",
            200,
            data={},
            validate_fn=lambda r: (
                (r.get('success') == True, f"Should return success=true, got: {r}")
            )
        )
        
        # E4: Verify product quantity increased by 5
        success, response = self.run_test(
            "E4: GET product quantity after restock - should increase by 5",
            "GET",
            "products/admin",
            200
        )
        
        if success:
            for p in response:
                if p.get('id') == self.test_product_id:
                    new_quantity = p.get('quantity')
                    expected_quantity = initial_quantity + 5
                    if new_quantity == expected_quantity:
                        self.log_test("E4: Product quantity increased by 5", True)
                        print(f"  Quantity: {initial_quantity} → {new_quantity}")
                    else:
                        self.log_test("E4: Product quantity increased by 5", False, 
                                     f"Expected {expected_quantity}, got {new_quantity}")
                    break
        
        # E5: DELETE purchase - verify quantity decreased back by 5
        success, response = self.run_test(
            "E5: DELETE purchase - returns 200",
            "DELETE",
            f"purchases/{self.purchase_id_existing_product}",
            200,
            validate_fn=lambda r: (
                (r.get('success') == True, f"Should return success=true, got: {r}")
            )
        )
        
        # E5b: Verify quantity decreased back
        success, response = self.run_test(
            "E5b: GET product quantity after delete - should decrease by 5",
            "GET",
            "products/admin",
            200
        )
        
        if success:
            for p in response:
                if p.get('id') == self.test_product_id:
                    final_quantity = p.get('quantity')
                    if final_quantity == initial_quantity:
                        self.log_test("E5b: Product quantity decreased back to initial", True)
                        print(f"  Quantity restored: {final_quantity}")
                    else:
                        self.log_test("E5b: Product quantity decreased back to initial", False,
                                     f"Expected {initial_quantity}, got {final_quantity}")
                    break
        
        return True

    def test_delete_purchase_stock_reversal(self):
        """Test F: DELETE purchase - stock reversal only if declared"""
        print("\n🗑️ Test F: DELETE purchase - stock reversal")
        
        # F1: Create purchase (do NOT declare) → DELETE it → verify stock unchanged
        purchase_data = {
            "product_id": self.test_product_id,
            "product_name": "test not declared",
            "quantity": 3,
            "unit": "piece",
            "purchase_price": 50,
            "payment_method": "cash"
        }
        
        # Get current quantity
        success, response = self.run_test(
            "F1: Get product quantity before test",
            "GET",
            "products/admin",
            200
        )
        
        initial_quantity = None
        if success:
            for p in response:
                if p.get('id') == self.test_product_id:
                    initial_quantity = p.get('quantity')
                    break
        
        # Create purchase
        success, response = self.run_test(
            "F1: Create purchase (not declared)",
            "POST",
            "purchases",
            200,
            data=purchase_data
        )
        
        if success:
            self.purchase_id_not_declared = response.get('id')
        
        # Delete it
        success, response = self.run_test(
            "F1: DELETE purchase (not declared)",
            "DELETE",
            f"purchases/{self.purchase_id_not_declared}",
            200
        )
        
        # Verify stock unchanged
        success, response = self.run_test(
            "F1: GET product quantity - should be unchanged",
            "GET",
            "products/admin",
            200
        )
        
        if success and initial_quantity is not None:
            for p in response:
                if p.get('id') == self.test_product_id:
                    current_quantity = p.get('quantity')
                    if current_quantity == initial_quantity:
                        self.log_test("F1: Stock unchanged after deleting undeclared purchase", True)
                    else:
                        self.log_test("F1: Stock unchanged after deleting undeclared purchase", False,
                                     f"Expected {initial_quantity}, got {current_quantity}")
                    break
        
        # F2: Create purchase → declare it → DELETE it → verify stock decremented
        purchase_data2 = {
            "product_id": self.test_product_id,
            "product_name": "test declared",
            "quantity": 7,
            "unit": "piece",
            "purchase_price": 50,
            "payment_method": "cash"
        }
        
        # Get current quantity
        success, response = self.run_test(
            "F2: Get product quantity before test",
            "GET",
            "products/admin",
            200
        )
        
        initial_quantity2 = None
        if success:
            for p in response:
                if p.get('id') == self.test_product_id:
                    initial_quantity2 = p.get('quantity')
                    break
        
        # Create purchase
        success, response = self.run_test(
            "F2: Create purchase",
            "POST",
            "purchases",
            200,
            data=purchase_data2
        )
        
        if success:
            self.purchase_id_declared = response.get('id')
        
        # Declare it
        success, response = self.run_test(
            "F2: Declare purchase in stock",
            "POST",
            f"purchases/{self.purchase_id_declared}/declare-in-stock",
            200,
            data={}
        )
        
        # Verify stock increased
        success, response = self.run_test(
            "F2: GET product quantity after declare - should increase by 7",
            "GET",
            "products/admin",
            200
        )
        
        quantity_after_declare = None
        if success and initial_quantity2 is not None:
            for p in response:
                if p.get('id') == self.test_product_id:
                    quantity_after_declare = p.get('quantity')
                    expected = initial_quantity2 + 7
                    if quantity_after_declare == expected:
                        self.log_test("F2: Stock increased by 7 after declare", True)
                    else:
                        self.log_test("F2: Stock increased by 7 after declare", False,
                                     f"Expected {expected}, got {quantity_after_declare}")
                    break
        
        # Delete it
        success, response = self.run_test(
            "F2: DELETE declared purchase",
            "DELETE",
            f"purchases/{self.purchase_id_declared}",
            200
        )
        
        # Verify stock decreased back
        success, response = self.run_test(
            "F2: GET product quantity after delete - should decrease by 7",
            "GET",
            "products/admin",
            200
        )
        
        if success and initial_quantity2 is not None:
            for p in response:
                if p.get('id') == self.test_product_id:
                    final_quantity = p.get('quantity')
                    if final_quantity == initial_quantity2:
                        self.log_test("F2: Stock decreased by 7 after deleting declared purchase", True)
                    else:
                        self.log_test("F2: Stock decreased by 7 after deleting declared purchase", False,
                                     f"Expected {initial_quantity2}, got {final_quantity}")
                    break
        
        return True

    def test_accounts_segregated(self):
        """Test G: GET /api/reports/accounts-segregated"""
        print("\n📊 Test G: Segregated Accounts endpoint")
        
        # Get today's date
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        success, response = self.run_test(
            "G1: GET /api/reports/accounts-segregated",
            "GET",
            f"reports/accounts-segregated?start_date={today}&end_date={today}",
            200,
            validate_fn=lambda r: self.validate_accounts_segregated(r)
        )
        
        return success

    def validate_accounts_segregated(self, data):
        """Validate accounts-segregated response structure"""
        required_keys = ['start_date', 'end_date', 'farmer_side', 'my_side', 'overall']
        
        for key in required_keys:
            if key not in data:
                return (False, f"Missing required key: {key}")
        
        # Validate farmer_side
        farmer_keys = ['sales', 'bill_count', 'cash_in', 'upi_in', 'credit_given', 'credit_recovered']
        for key in farmer_keys:
            if key not in data['farmer_side']:
                return (False, f"Missing farmer_side key: {key}")
        
        # Validate my_side
        my_side_keys = ['purchases_total', 'purchase_count', 'purchases_by_method', 'credit_taken', 'expenses', 'expense_count']
        for key in my_side_keys:
            if key not in data['my_side']:
                return (False, f"Missing my_side key: {key}")
        
        # Validate purchases_by_method is a dict
        if not isinstance(data['my_side']['purchases_by_method'], dict):
            return (False, "purchases_by_method should be a dict")
        
        # Check if UPI purchase from test B is reflected
        if 'upi' in data['my_side']['purchases_by_method']:
            upi_amount = data['my_side']['purchases_by_method']['upi']
            if upi_amount >= 3000:
                print(f"  ✅ UPI purchase reflected in accounts: ₹{upi_amount}")
            else:
                print(f"  ⚠️ UPI amount seems low: ₹{upi_amount} (expected at least ₹3000)")
        
        # Validate overall
        overall_keys = ['money_in', 'money_out', 'net']
        for key in overall_keys:
            if key not in data['overall']:
                return (False, f"Missing overall key: {key}")
        
        return (True, "Accounts segregated structure is valid")

    def test_data_export_suppliers(self):
        """Test H: GET /api/data/export includes suppliers.csv"""
        print("\n📦 Test H: Data export includes suppliers.csv")
        
        url = f"{self.base_url}/api/data/export"
        
        try:
            response = requests.get(url, timeout=60)
            
            if response.status_code != 200:
                self.log_test("H1: GET /api/data/export - status code", False, 
                             f"Expected 200, got {response.status_code}")
                return False
            
            self.log_test("H1: GET /api/data/export - status code 200", True)
            
            # Validate ZIP content
            zip_buffer = io.BytesIO(response.content)
            
            try:
                with zipfile.ZipFile(zip_buffer, 'r') as zf:
                    file_list = zf.namelist()
                    
                    # Check if suppliers.csv is present
                    if 'suppliers.csv' in file_list:
                        self.log_test("H2: ZIP contains suppliers.csv", True)
                        
                        # Read suppliers.csv and verify it has content
                        suppliers_csv = zf.read('suppliers.csv').decode('utf-8')
                        lines = suppliers_csv.strip().split('\n')
                        
                        if len(lines) > 1:  # Header + at least one row
                            self.log_test("H3: suppliers.csv has data", True)
                            print(f"  Suppliers CSV has {len(lines)-1} rows")
                        else:
                            self.log_test("H3: suppliers.csv has data", False, 
                                         "suppliers.csv is empty or has only header")
                    else:
                        self.log_test("H2: ZIP contains suppliers.csv", False, 
                                     f"suppliers.csv not found in ZIP. Files: {file_list}")
                        return False
                    
                    # Verify all expected files are present (9 CSVs now)
                    expected_files = ['products.csv', 'categories.csv', 'customers.csv', 'bills.csv',
                                     'loan_payments.csv', 'expenses.csv', 'purchases.csv', 
                                     'suppliers.csv', 'users.csv', '_metadata.json']
                    
                    missing_files = [f for f in expected_files if f not in file_list]
                    
                    if not missing_files:
                        self.log_test("H4: ZIP contains all 9 expected files", True)
                    else:
                        self.log_test("H4: ZIP contains all 9 expected files", False,
                                     f"Missing files: {missing_files}")
                    
            except zipfile.BadZipFile:
                self.log_test("Response is a valid ZIP file", False, "Invalid ZIP file")
                return False
            
            return True
            
        except Exception as e:
            self.log_test("GET /api/data/export", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all Iteration-3 tests"""
        print("🚀 Starting Iteration-3 Backend API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 80)
        
        try:
            # Auth
            if not self.test_auth():
                print("\n⚠️ CRITICAL: Auth failed - stopping test suite")
                return False
            
            # Setup
            if not self.setup_test_data():
                print("\n⚠️ CRITICAL: Setup failed - stopping test suite")
                return False
            
            # Run all tests
            self.test_suppliers_crud()
            self.test_purchase_with_payment_method()
            self.test_purchase_with_credit()
            self.test_declare_in_stock_new_product()
            self.test_declare_in_stock_existing_product()
            self.test_delete_purchase_stock_reversal()
            self.test_accounts_segregated()
            self.test_data_export_suppliers()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with exception: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Print summary
        print("\n" + "=" * 80)
        print(f"📊 ITERATION-3 TEST SUMMARY")
        print("=" * 80)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "0%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  • {test['test']}")
                if test['details']:
                    print(f"    └─ {test['details']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return self.tests_passed == self.tests_run

def main():
    tester = Iteration3Tester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
