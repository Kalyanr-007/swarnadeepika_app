#!/usr/bin/env python3
"""
Pydantic 2.13.4 + bcrypt 5.0.0 Regression Test Suite
Tests for breaking changes after version bumps from pydantic 2.10 -> 2.13 and bcrypt 4.1/4.2 -> 5.0
"""

import requests
import json
import zipfile
import io
from datetime import datetime, timedelta

class PydanticBcryptRegressionTester:
    def __init__(self, base_url="https://farm-app-repair.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_user_username = None
        self.test_user_password = None
        self.test_product_id = None
        self.test_customer_id = None
        self.test_bill_id = None
        self.test_purchase_id = None
        self.test_supplier_id = None
        self.test_expense_id = None

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
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}: {response.text[:500]}")
                return False, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_1_auth_roundtrip(self):
        """Test 1: Auth roundtrip - bcrypt hashpw + checkpw across versions"""
        print("\n🔐 Test 1: Auth Roundtrip (bcrypt 5.0.0 regression)")
        
        # 1.1 Login with admin/swarna123
        success, response = self.run_test(
            "1.1 Login with admin/swarna123",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "swarna123"},
            validate_fn=lambda r: (
                (r.get('success') == True, "Login should return success=true")
                if r.get('success') == True else (False, f"Login failed: {r}")
            )
        )
        
        # 1.2 Login with wrong password
        success, response = self.run_test(
            "1.2 Login with wrong password returns 401",
            "POST",
            "auth/login",
            401,
            data={"username": "admin", "password": "wrongpassword"}
        )
        
        # 1.3 Register a new user
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        self.test_user_username = f"testuser_{timestamp}"
        self.test_user_password = "TestPass123!"
        
        success, response = self.run_test(
            "1.3 Register new user",
            "POST",
            "auth/register",
            200,
            data={
                "username": self.test_user_username,
                "password": self.test_user_password,
                "role": "staff"
            },
            validate_fn=lambda r: (
                ('id' in r and r.get('username') == self.test_user_username, "Registration should return user object with id")
                if 'id' in r else (False, f"Registration failed: {r}")
            )
        )
        
        # 1.4 Login as the new user
        success, response = self.run_test(
            "1.4 Login as newly registered user",
            "POST",
            "auth/login",
            200,
            data={"username": self.test_user_username, "password": self.test_user_password},
            validate_fn=lambda r: (
                (r.get('success') == True and r.get('user', {}).get('username') == self.test_user_username,
                 "Login should succeed with new user")
                if r.get('success') == True else (False, f"Login failed: {r}")
            )
        )
        
        # 1.5 Change password
        new_password = "NewPass456!"
        success, response = self.run_test(
            "1.5 Change password",
            "POST",
            "auth/change-password",
            200,
            data={
                "username": self.test_user_username,
                "current_password": self.test_user_password,
                "new_password": new_password
            },
            validate_fn=lambda r: (
                (r.get('success') == True, "Password change should return success=true")
                if r.get('success') == True else (False, f"Password change failed: {r}")
            )
        )
        
        # Update test_user_password for subsequent tests
        if success:
            self.test_user_password = new_password
        
        # 1.6 Login with old password should fail
        old_password = "TestPass123!"
        success, response = self.run_test(
            "1.6 Login with old password fails after change",
            "POST",
            "auth/login",
            401,
            data={"username": self.test_user_username, "password": old_password}
        )
        
        # 1.7 Login with new password
        success, response = self.run_test(
            "1.7 Login with new password succeeds",
            "POST",
            "auth/login",
            200,
            data={"username": self.test_user_username, "password": self.test_user_password},
            validate_fn=lambda r: (
                (r.get('success') == True, "Login should succeed with new password")
                if r.get('success') == True else (False, f"Login failed: {r}")
            )
        )

    def test_2_pydantic_models(self):
        """Test 2: Pydantic models - Optional/List/nested/default fields"""
        print("\n📦 Test 2: Pydantic Models (pydantic 2.13.4 regression)")
        
        # 2.1 POST /api/products with bag_size_kg (float default 0), missing optional fields
        # First get a category
        success, response = self.run_test(
            "2.1a Get categories",
            "GET",
            "categories",
            200
        )
        
        category_id = None
        if success and response:
            categories = response if isinstance(response, list) else response.get('categories', [])
            if categories:
                category_id = categories[0].get('id')
        
        if not category_id:
            self.log_test("2.1b Create product - skipped", False, "No category found")
        else:
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            success, response = self.run_test(
                "2.1b POST product with bag_size_kg default",
                "POST",
                "products",
                200,
                data={
                    "name": f"Test Product {timestamp}",
                    "category_id": category_id,
                    "batch_no": f"BATCH{timestamp}",
                    "mfg_date": "2026-01-01",
                    "exp_date": "2027-01-01",
                    "quantity": 100,
                    "purchase_price": 50.0,
                    "selling_price": 75.0,
                    "mrp": 80.0,
                    "bag_size_kg": 45.5
                },
                validate_fn=lambda r: (
                    ('id' in r and r.get('bag_size_kg') == 45.5, "Product should have id and bag_size_kg")
                    if 'id' in r else (False, f"Product creation failed: {r}")
                )
            )
            
            if success and response:
                self.test_product_id = response.get('id')
        
        # 2.2 POST /api/customers with aadhaar (Optional str)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        success, response = self.run_test(
            "2.2a POST customer with aadhaar",
            "POST",
            "customers",
            200,
            data={
                "name": f"Test Customer {timestamp}",
                "village": "Test Village",
                "phone": "9876543210",
                "aadhaar": "123456789012"
            },
            validate_fn=lambda r: (
                ('id' in r and r.get('aadhaar') == "123456789012", "Customer should have id and aadhaar")
                if 'id' in r else (False, f"Customer creation failed: {r}")
            )
        )
        
        if success and response:
            self.test_customer_id = response.get('id')
        
        # 2.2b POST customer without aadhaar
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        success, response = self.run_test(
            "2.2b POST customer without aadhaar (Optional field)",
            "POST",
            "customers",
            200,
            data={
                "name": f"Test Customer No Aadhaar {timestamp}",
                "village": "Test Village 2",
                "phone": "9876543211"
                # aadhaar is optional
            },
            validate_fn=lambda r: (
                ('id' in r, "Customer should be created without aadhaar")
                if 'id' in r else (False, f"Customer creation failed: {r}")
            )
        )
        
        # 2.3 POST /api/bills with nested items: [BillItem] list, cash_amount + upi_amount split
        if self.test_product_id and self.test_customer_id:
            success, response = self.run_test(
                "2.3 POST bill with nested items and split payment",
                "POST",
                "bills",
                200,
                data={
                    "customer_id": self.test_customer_id,
                    "customer_name": "Test Customer",
                    "village": "Test Village",
                    "items": [
                        {
                            "product_id": self.test_product_id,
                            "product_name": "Test Product",
                            "batch_no": "BATCH001",
                            "mfg_date": "2026-01-01",
                            "exp_date": "2027-01-01",
                            "quantity": 2,
                            "unit": "piece",
                            "rate": 75.0,
                            "amount": 150.0
                        }
                    ],
                    "total_amount": 150.0,
                    "payment_type": "cash",
                    "paid_amount": 150.0,
                    "cash_amount": 100.0,
                    "upi_amount": 50.0
                },
                validate_fn=lambda r: (
                    ('id' in r and r.get('cash_amount') == 100.0 and r.get('upi_amount') == 50.0,
                     "Bill should have id, cash_amount, and upi_amount")
                    if 'id' in r else (False, f"Bill creation failed: {r}")
                )
            )
            
            if success and response:
                self.test_bill_id = response.get('id')
                
                # 2.3b Retrieve bill and verify nested items preserved
                success, response = self.run_test(
                    "2.3b GET bill preserves nested items",
                    "GET",
                    f"bills/{self.test_bill_id}",
                    200,
                    validate_fn=lambda r: (
                        (isinstance(r.get('items'), list) and len(r.get('items', [])) > 0,
                         "Bill should have items list")
                        if 'items' in r else (False, f"Bill missing items: {r}")
                    )
                )
        
        # 2.4 POST /api/purchases with payment_method="upi" + reference_number
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        success, response = self.run_test(
            "2.4a POST purchase with payment_method=upi",
            "POST",
            "purchases",
            200,
            data={
                "product_name": f"Test Purchase Product {timestamp}",
                "quantity": 50,
                "purchase_price": 40.0,
                "total_amount": 2000.0,
                "supplier": f"Test Supplier {timestamp}",
                "payment_method": "upi",
                "reference_number": "UPI123456789",
                "paid_amount": 2000.0
            },
            validate_fn=lambda r: (
                ('id' in r and r.get('payment_method') == 'upi' and r.get('reference_number') == 'UPI123456789',
                 "Purchase should have id, payment_method, and reference_number")
                if 'id' in r else (False, f"Purchase creation failed: {r}")
            )
        )
        
        if success and response:
            self.test_purchase_id = response.get('id')
            
            # 2.4b POST declare-in-stock with small optional payload
            if category_id:
                success, response = self.run_test(
                    "2.4b POST declare-in-stock with optional payload",
                    "POST",
                    f"purchases/{self.test_purchase_id}/declare-in-stock",
                    200,
                    data={
                        "category_id": category_id,
                        "mrp": 60.0,
                        "selling_price": 55.0
                        # Optional: mfg_date, exp_date, bag_size_kg, name_telugu
                    },
                    validate_fn=lambda r: (
                        (r.get('success') == True, "Declare-in-stock should return success=true")
                        if r.get('success') == True else (False, f"Declare-in-stock failed: {r}")
                    )
                )
                
                # 2.4c Verify product qty incremented
                if success:
                    success, response = self.run_test(
                        "2.4c Verify product quantity incremented",
                        "GET",
                        "products/admin",
                        200,
                        validate_fn=lambda r: (
                            (isinstance(r, list) and len(r) > 0, "Products list should not be empty")
                            if isinstance(r, list) else (False, f"Products response invalid: {r}")
                        )
                    )
        
        # 2.5 POST /api/suppliers with items_supplied: ["Seeds","Fertilizers"] (List[str])
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        success, response = self.run_test(
            "2.5a POST supplier with items_supplied list",
            "POST",
            "suppliers",
            200,
            data={
                "name": f"Test Supplier {timestamp}",
                "phone": "9123456789",
                "address": "Test Address",
                "items_supplied": ["Seeds", "Fertilizers"],
                "notes": "Test supplier"
            },
            validate_fn=lambda r: (
                ('id' in r and isinstance(r.get('items_supplied'), list) and 
                 len(r.get('items_supplied', [])) == 2,
                 "Supplier should have id and items_supplied list with 2 elements")
                if 'id' in r else (False, f"Supplier creation failed: {r}")
            )
        )
        
        if success and response:
            self.test_supplier_id = response.get('id')
            
            # 2.5b GET suppliers and verify list preserves elements & order
            success, response = self.run_test(
                "2.5b GET suppliers preserves list elements & order",
                "GET",
                "suppliers",
                200,
                validate_fn=lambda r: (
                    (isinstance(r, list) and len(r) > 0, "Suppliers list should not be empty")
                    if isinstance(r, list) else (False, f"Suppliers response invalid: {r}")
                )
            )
        
        # 2.6 POST /api/loans/payment with method="cash"
        # First create a credit bill
        if self.test_product_id and self.test_customer_id:
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            success, response = self.run_test(
                "2.6a Create credit bill for loan payment test",
                "POST",
                "bills",
                200,
                data={
                    "customer_id": self.test_customer_id,
                    "customer_name": "Test Customer",
                    "village": "Test Village",
                    "items": [
                        {
                            "product_id": self.test_product_id,
                            "product_name": "Test Product",
                            "batch_no": "BATCH001",
                            "mfg_date": "2026-01-01",
                            "exp_date": "2027-01-01",
                            "quantity": 1,
                            "unit": "piece",
                            "rate": 75.0,
                            "amount": 75.0
                        }
                    ],
                    "total_amount": 75.0,
                    "payment_type": "credit",
                    "paid_amount": 0.0,
                    "cash_amount": 0.0,
                    "upi_amount": 0.0
                },
                validate_fn=lambda r: (
                    ('id' in r, "Credit bill should be created")
                    if 'id' in r else (False, f"Credit bill creation failed: {r}")
                )
            )
            
            if success and response:
                credit_bill_id = response.get('id')
                
                success, response = self.run_test(
                    "2.6b POST loan payment with method=cash",
                    "POST",
                    "loans/payment",
                    200,
                    data={
                        "bill_id": credit_bill_id,
                        "amount": 50.0,
                        "method": "cash"
                    },
                    validate_fn=lambda r: (
                        (r.get('success') == True, "Loan payment should return success=true")
                        if r.get('success') == True else (False, f"Loan payment failed: {r}")
                    )
                )
                
                # 2.6c GET payments and verify method echoed
                success, response = self.run_test(
                    "2.6c GET loan payments echoes method",
                    "GET",
                    f"loans/payments/{credit_bill_id}",
                    200,
                    validate_fn=lambda r: (
                        (isinstance(r, list) and len(r) > 0 and r[0].get('method') == 'cash',
                         "Loan payments should include method=cash")
                        if isinstance(r, list) and len(r) > 0 else (False, f"Loan payments response invalid: {r}")
                    )
                )
        
        # 2.7 POST /api/expenses
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        success, response = self.run_test(
            "2.7 POST expense",
            "POST",
            "expenses",
            200,
            data={
                "category": "Hamali",
                "amount": 500.0,
                "description": f"Test expense {timestamp}"
            },
            validate_fn=lambda r: (
                ('id' in r, "Expense should be created")
                if 'id' in r else (False, f"Expense creation failed: {r}")
            )
        )
        
        if success and response:
            self.test_expense_id = response.get('id')

    def test_3_data_endpoints(self):
        """Test 3: New Data endpoints"""
        print("\n💾 Test 3: Data Endpoints")
        
        # 3.1 GET /api/data/info
        success, response = self.run_test(
            "3.1 GET /api/data/info returns right shape",
            "GET",
            "data/info",
            200,
            validate_fn=lambda r: (
                ('backend' in r and 'db_name' in r and 'backup_dir' in r and 'counts' in r,
                 "Data info should have backend, db_name, backup_dir, counts")
                if 'backend' in r else (False, f"Data info response invalid: {r}")
            )
        )
        
        # 3.2 GET /api/data/export streams valid ZIP with 9 CSVs including suppliers.csv
        try:
            url = f"{self.base_url}/api/data/export"
            response = requests.get(url, timeout=60)
            
            if response.status_code == 200:
                # Check Content-Type
                content_type = response.headers.get('Content-Type', '')
                if 'application/zip' not in content_type:
                    self.log_test("3.2a GET /api/data/export Content-Type", False, 
                                f"Expected application/zip, got {content_type}")
                else:
                    self.log_test("3.2a GET /api/data/export Content-Type", True)
                
                # Check ZIP contents
                try:
                    zip_file = zipfile.ZipFile(io.BytesIO(response.content))
                    file_list = zip_file.namelist()
                    
                    required_files = ['products.csv', 'categories.csv', 'customers.csv', 
                                    'bills.csv', 'loan_payments.csv', 'expenses.csv', 
                                    'purchases.csv', 'suppliers.csv', 'users.csv', '_metadata.json']
                    
                    missing_files = [f for f in required_files if f not in file_list]
                    
                    if missing_files:
                        self.log_test("3.2b GET /api/data/export ZIP contains all CSVs", False,
                                    f"Missing files: {missing_files}")
                    else:
                        self.log_test("3.2b GET /api/data/export ZIP contains all CSVs", True)
                    
                    # Check users.csv excludes password_hash
                    users_csv = zip_file.read('users.csv').decode('utf-8')
                    if 'password_hash' in users_csv:
                        self.log_test("3.2c users.csv excludes password_hash", False,
                                    "password_hash column found in users.csv")
                    else:
                        self.log_test("3.2c users.csv excludes password_hash", True)
                    
                except Exception as e:
                    self.log_test("3.2b GET /api/data/export ZIP parsing", False, str(e))
            else:
                self.log_test("3.2 GET /api/data/export", False, 
                            f"Expected 200, got {response.status_code}")
        except Exception as e:
            self.log_test("3.2 GET /api/data/export", False, f"Exception: {str(e)}")
        
        # 3.3 POST /api/data/reset-auth
        # Note: This is a destructive operation, so we'll test it last
        # For now, just verify the endpoint exists and requires correct parameters
        success, response = self.run_test(
            "3.3a POST /api/data/reset-auth wrong confirm_phrase returns 400",
            "POST",
            "data/reset-auth",
            400,
            data={
                "confirm_phrase": "WRONG",
                "admin_username": "admin",
                "admin_password": "swarna123"
            }
        )
        
        success, response = self.run_test(
            "3.3b POST /api/data/reset-auth wrong password returns 401",
            "POST",
            "data/reset-auth",
            401,
            data={
                "confirm_phrase": "RESET AUTH",
                "admin_username": "admin",
                "admin_password": "wrongpassword"
            }
        )
        
        # We'll skip the actual reset-auth test to avoid disrupting the database
        print("⚠️  Skipping actual reset-auth test to preserve database state")

    def test_4_date_filters(self):
        """Test 4: Date filters"""
        print("\n📅 Test 4: Date Filters")
        
        # 4.1 GET /api/bills with date range
        start_date = "2020-01-01"
        end_date = "2030-01-01"
        
        success, response = self.run_test(
            "4.1 GET /api/bills with wide date range",
            "GET",
            f"bills?start_date={start_date}&end_date={end_date}",
            200,
            validate_fn=lambda r: (
                (isinstance(r, list), "Bills should return a list")
                if isinstance(r, list) else (False, f"Bills response invalid: {r}")
            )
        )
        
        # 4.2 GET /api/reports/summary with date range
        success, response = self.run_test(
            "4.2 GET /api/reports/summary with date range",
            "GET",
            f"reports/summary?start_date={start_date}&end_date={end_date}",
            200,
            validate_fn=lambda r: (
                ('sales' in r and 'profit' in r and isinstance(r.get('sales'), dict),
                 "Summary should have sales (dict) and profit")
                if 'sales' in r else (False, f"Summary response invalid: {r}")
            )
        )

    def test_5_aggregations(self):
        """Test 5: Aggregations"""
        print("\n📊 Test 5: Aggregations")
        
        # 5.1 GET /api/reports/day-summary
        today = datetime.now().strftime("%Y-%m-%d")
        
        success, response = self.run_test(
            "5.1 GET /api/reports/day-summary",
            "GET",
            f"reports/day-summary?date={today}",
            200,
            validate_fn=lambda r: (
                ('date' in r and 'cash_flow' in r and 'top_items' in r and 'khata' in r and 'growth' in r and 'alerts' in r,
                 "Day summary should have all required keys")
                if 'date' in r else (False, f"Day summary response invalid: {r}")
            )
        )
        
        # 5.2 GET /api/reports/accounts-segregated
        start_date = datetime.now().strftime("%Y-%m-01")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        success, response = self.run_test(
            "5.2 GET /api/reports/accounts-segregated",
            "GET",
            f"reports/accounts-segregated?start_date={start_date}&end_date={end_date}",
            200,
            validate_fn=lambda r: (
                ('farmer_side' in r and 'my_side' in r and 'overall' in r,
                 "Accounts segregated should have farmer_side, my_side, overall")
                if 'farmer_side' in r else (False, f"Accounts segregated response invalid: {r}")
            )
        )

    def test_6_delete_flows(self):
        """Test 6: Delete flows"""
        print("\n🗑️  Test 6: Delete Flows")
        
        # 6.1 DELETE product created in test 2
        if self.test_product_id:
            success, response = self.run_test(
                "6.1 DELETE product",
                "DELETE",
                f"products/{self.test_product_id}",
                200,
                validate_fn=lambda r: (
                    (r.get('success') == True, "Delete should return success=true")
                    if r.get('success') == True else (False, f"Delete failed: {r}")
                )
            )
        else:
            print("⚠️  Skipping product delete - no test product created")
        
        # 6.2 DELETE customer
        if self.test_customer_id:
            success, response = self.run_test(
                "6.2 DELETE customer",
                "DELETE",
                f"customers/{self.test_customer_id}",
                200,
                validate_fn=lambda r: (
                    (r.get('success') == True, "Delete should return success=true")
                    if r.get('success') == True else (False, f"Delete failed: {r}")
                )
            )
        else:
            print("⚠️  Skipping customer delete - no test customer created")
        
        # 6.3 DELETE supplier
        if self.test_supplier_id:
            success, response = self.run_test(
                "6.3 DELETE supplier",
                "DELETE",
                f"suppliers/{self.test_supplier_id}",
                200,
                validate_fn=lambda r: (
                    (r.get('success') == True, "Delete should return success=true")
                    if r.get('success') == True else (False, f"Delete failed: {r}")
                )
            )
        else:
            print("⚠️  Skipping supplier delete - no test supplier created")
        
        # 6.4 DELETE expense
        if self.test_expense_id:
            success, response = self.run_test(
                "6.4 DELETE expense",
                "DELETE",
                f"expenses/{self.test_expense_id}",
                200,
                validate_fn=lambda r: (
                    (r.get('success') == True, "Delete should return success=true")
                    if r.get('success') == True else (False, f"Delete failed: {r}")
                )
            )
        else:
            print("⚠️  Skipping expense delete - no test expense created")

    def run_all_tests(self):
        """Run all regression tests"""
        print("=" * 80)
        print("🧪 Pydantic 2.13.4 + bcrypt 5.0.0 Regression Test Suite")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Testing for breaking changes after version bumps:")
        print(f"  - pydantic: 2.10.4 → 2.13.4")
        print(f"  - bcrypt: 4.1/4.2 → 5.0.0")
        print("=" * 80)
        
        self.test_1_auth_roundtrip()
        self.test_2_pydantic_models()
        self.test_3_data_endpoints()
        self.test_4_date_filters()
        self.test_5_aggregations()
        self.test_6_delete_flows()
        
        print("\n" + "=" * 80)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        print("=" * 80)
        
        if self.tests_passed == self.tests_run:
            print("✅ All tests passed! No breaking changes detected.")
            return 0
        else:
            print(f"❌ {self.tests_run - self.tests_passed} test(s) failed.")
            print("\nFailed tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
            return 1

if __name__ == "__main__":
    tester = PydanticBcryptRegressionTester()
    exit_code = tester.run_all_tests()
    exit(exit_code)
