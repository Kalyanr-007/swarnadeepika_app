import requests
import sys
import json
from datetime import datetime, timezone, timedelta

class SwarnaDeepikaBillingTester:
    def __init__(self, base_url="https://46a55a49-96d1-491d-ac40-eff159f18293.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_category_id = None
        self.test_product_id = None
        self.test_customer_id = None
        self.test_bill_id = None
        self.test_credit_bill_id = None
        self.initial_counts = {}
        self.backup_filename = None

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

    def test_health_and_auth(self):
        """Test 1: Health/auth endpoints"""
        print("\n🔐 Test 1: Health and Authentication")
        
        # Test login with correct credentials
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
        
        # Test login with wrong password
        self.run_test(
            "Login with wrong password returns 401",
            "POST",
            "auth/login",
            401,
            data={
                "username": "admin",
                "password": "wrongpassword"
            }
        )
        
        return True

    def test_products_with_bag_size(self):
        """Test 2: Products with bag_size_kg"""
        print("\n📦 Test 2: Products with bag_size_kg")
        
        # Create category first
        success, response = self.run_test(
            "Create Fertilizer category",
            "POST",
            "categories",
            200,
            data={
                "name": "Fertilizer",
                "description": "Test fertilizer category"
            }
        )
        
        if success:
            self.test_category_id = response.get('id')
        else:
            print("⚠️ Failed to create category, trying to get existing categories")
            success, response = self.run_test(
                "Get existing categories",
                "GET",
                "categories",
                200
            )
            if success and len(response) > 0:
                self.test_category_id = response[0]['id']
        
        if not self.test_category_id:
            print("⚠️ CRITICAL: No category available - cannot test products")
            return False
        
        # Create product with bag_size_kg
        product_data = {
            "name": "Urea (45kg)",
            "name_telugu": "యూరియా",
            "category_id": self.test_category_id,
            "batch_no": "BATCH2024001",
            "mfg_date": "2024-01-15",
            "exp_date": "2025-12-31",
            "purchase_price": 1200.0,
            "mrp": 1500.0,
            "selling_price": 1450.0,
            "quantity": 150,
            "unit": "bags",
            "bag_size_kg": 45
        }
        
        success, response = self.run_test(
            "Create product with bag_size_kg=45",
            "POST",
            "products",
            200,
            data=product_data,
            validate_fn=lambda r: (
                (r.get('bag_size_kg') == 45, f"Product should have bag_size_kg=45, got {r.get('bag_size_kg')}")
            )
        )
        
        if success:
            self.test_product_id = response.get('id')
        else:
            print("⚠️ CRITICAL: Failed to create product")
            return False
        
        # GET /api/products (public) - should NOT contain purchase_price
        success, response = self.run_test(
            "GET /api/products - should NOT contain purchase_price",
            "GET",
            "products",
            200,
            validate_fn=lambda r: (
                (all('purchase_price' not in p for p in r), "Public products should not have purchase_price")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # GET /api/products/admin - SHOULD contain purchase_price + bag_size_kg
        success, response = self.run_test(
            "GET /api/products/admin - should contain purchase_price + bag_size_kg",
            "GET",
            "products/admin",
            200,
            validate_fn=lambda r: (
                (any(p.get('id') == self.test_product_id and 'purchase_price' in p and p.get('bag_size_kg') == 45 for p in r),
                 "Admin products should have purchase_price and bag_size_kg")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # Update product with new bag_size_kg
        success, response = self.run_test(
            "PUT /api/products/{id} - update bag_size_kg to 50",
            "PUT",
            f"products/{self.test_product_id}",
            200,
            data={"bag_size_kg": 50},
            validate_fn=lambda r: (
                (r.get('bag_size_kg') == 50, f"Updated product should have bag_size_kg=50, got {r.get('bag_size_kg')}")
            )
        )
        
        # Reset back to 45 for subsidy tests
        self.run_test(
            "Reset bag_size_kg back to 45",
            "PUT",
            f"products/{self.test_product_id}",
            200,
            data={"bag_size_kg": 45}
        )
        
        return True

    def test_customers_with_aadhaar(self):
        """Test 3: Customers with 12-digit Aadhaar"""
        print("\n👥 Test 3: Customers with 12-digit Aadhaar")
        
        # Create customer with 12-digit Aadhaar
        customer_data = {
            "name": "Ravi Kumar",
            "village": "Gangaram",
            "phone": "9876543210",
            "aadhaar": "123456789012"
        }
        
        success, response = self.run_test(
            "Create customer with 12-digit Aadhaar",
            "POST",
            "customers",
            200,
            data=customer_data,
            validate_fn=lambda r: (
                (r.get('aadhaar') == "123456789012", f"Customer should have aadhaar=123456789012, got {r.get('aadhaar')}")
            )
        )
        
        if success:
            self.test_customer_id = response.get('id')
        else:
            print("⚠️ CRITICAL: Failed to create customer")
            return False
        
        # GET /api/customers - verify aadhaar is present
        success, response = self.run_test(
            "GET /api/customers - verify aadhaar field",
            "GET",
            "customers",
            200,
            validate_fn=lambda r: (
                (any(c.get('id') == self.test_customer_id and c.get('aadhaar') == "123456789012" for c in r),
                 "Customer list should contain customer with aadhaar=123456789012")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        # Update customer aadhaar
        success, response = self.run_test(
            "PUT /api/customers/{id} - update aadhaar",
            "PUT",
            f"customers/{self.test_customer_id}",
            200,
            data={"aadhaar": "987654321098"},
            validate_fn=lambda r: (
                (r.get('aadhaar') == "987654321098", f"Updated customer should have new aadhaar, got {r.get('aadhaar')}")
            )
        )
        
        return True

    def test_bill_with_split_payment(self):
        """Test 4: Bill with split Cash + UPI"""
        print("\n🧾 Test 4: Bill with split Cash + UPI payment")
        
        if not self.test_product_id or not self.test_customer_id:
            print("⚠️ CRITICAL: Missing product or customer - cannot test bills")
            return False
        
        # Get current product quantity
        success, response = self.run_test(
            "Get product before bill",
            "GET",
            f"products/admin",
            200
        )
        
        initial_quantity = None
        if success:
            for p in response:
                if p.get('id') == self.test_product_id:
                    initial_quantity = p.get('quantity')
                    break
        
        # Create bill with split payment (cash + UPI)
        bill_data = {
            "customer_id": self.test_customer_id,
            "customer_name": "Ravi Kumar",
            "village": "Gangaram",
            "items": [
                {
                    "product_id": self.test_product_id,
                    "product_name": "Urea (45kg)",
                    "batch_no": "BATCH2024001",
                    "mfg_date": "2024-01-15",
                    "exp_date": "2025-12-31",
                    "quantity": 2,
                    "unit": "bags",
                    "rate": 1450.0,
                    "amount": 2900.0
                }
            ],
            "total_amount": 2900.0,
            "payment_type": "cash",
            "paid_amount": 2900.0,
            "cash_amount": 1800.0,
            "upi_amount": 1100.0
        }
        
        success, response = self.run_test(
            "Create bill with cash_amount=1800 + upi_amount=1100",
            "POST",
            "bills",
            200,
            data=bill_data,
            validate_fn=lambda r: (
                (r.get('cash_amount') == 1800.0 and r.get('upi_amount') == 1100.0,
                 f"Bill should have cash_amount=1800 and upi_amount=1100, got cash={r.get('cash_amount')}, upi={r.get('upi_amount')}")
            )
        )
        
        if success:
            self.test_bill_id = response.get('id')
        else:
            print("⚠️ CRITICAL: Failed to create bill")
            return False
        
        # Verify bill retrieval has split payment
        success, response = self.run_test(
            "GET /api/bills/{id} - verify split payment persisted",
            "GET",
            f"bills/{self.test_bill_id}",
            200,
            validate_fn=lambda r: (
                (r.get('cash_amount') == 1800.0 and r.get('upi_amount') == 1100.0,
                 f"Retrieved bill should have cash_amount=1800 and upi_amount=1100")
            )
        )
        
        # Verify stock quantity decreased
        success, response = self.run_test(
            "Verify stock quantity decreased after bill",
            "GET",
            f"products/admin",
            200
        )
        
        if success and initial_quantity is not None:
            for p in response:
                if p.get('id') == self.test_product_id:
                    new_quantity = p.get('quantity')
                    if new_quantity == initial_quantity - 2:
                        print(f"✅ Stock decreased correctly: {initial_quantity} → {new_quantity}")
                    else:
                        print(f"❌ Stock not decreased correctly: {initial_quantity} → {new_quantity} (expected {initial_quantity - 2})")
                    break
        
        return True

    def test_loan_payment_with_method(self):
        """Test 5: Loan payment with method (cash/upi)"""
        print("\n💰 Test 5: Loan payment with method (cash/upi)")
        
        if not self.test_customer_id or not self.test_product_id:
            print("⚠️ CRITICAL: Missing customer or product - cannot test loan payment")
            return False
        
        # Create a credit bill first
        credit_bill_data = {
            "customer_id": self.test_customer_id,
            "customer_name": "Ravi Kumar",
            "village": "Gangaram",
            "items": [
                {
                    "product_id": self.test_product_id,
                    "product_name": "Urea (45kg)",
                    "batch_no": "BATCH2024001",
                    "mfg_date": "2024-01-15",
                    "exp_date": "2025-12-31",
                    "quantity": 1,
                    "unit": "bags",
                    "rate": 1450.0,
                    "amount": 1450.0
                }
            ],
            "total_amount": 1450.0,
            "payment_type": "credit",
            "paid_amount": 0.0,
            "cash_amount": 0.0,
            "upi_amount": 0.0
        }
        
        success, response = self.run_test(
            "Create credit bill (total=1450, paid=0)",
            "POST",
            "bills",
            200,
            data=credit_bill_data
        )
        
        if success:
            self.test_credit_bill_id = response.get('id')
        else:
            print("⚠️ CRITICAL: Failed to create credit bill")
            return False
        
        # Make a loan payment with method=upi
        payment_data = {
            "bill_id": self.test_credit_bill_id,
            "amount": 500.0,
            "method": "upi",
            "notes": "Partial payment via UPI"
        }
        
        success, response = self.run_test(
            "POST /api/loans/payment with method=upi",
            "POST",
            "loans/payment",
            200,
            data=payment_data
        )
        
        if not success:
            print("⚠️ CRITICAL: Failed to create loan payment")
            return False
        
        # Get loan payments for this bill
        success, response = self.run_test(
            "GET /api/loans/payments/{bill_id} - verify method=upi",
            "GET",
            f"loans/payments/{self.test_credit_bill_id}",
            200,
            validate_fn=lambda r: (
                (any(p.get('method') == 'upi' and p.get('amount') == 500.0 for p in r),
                 "Payment list should contain payment with method=upi and amount=500")
                if isinstance(r, list) else (False, "Response should be a list")
            )
        )
        
        return True

    def test_day_summary(self):
        """Test 6: Day Summary endpoint structure"""
        print("\n📊 Test 6: Day Summary - GET /api/reports/day-summary")
        
        # Create an expense with category "Hamali" for testing
        expense_data = {
            "amount": 500.0,
            "category": "Hamali",
            "note": "Labor payment for loading"
        }
        
        self.run_test(
            "Create Hamali expense",
            "POST",
            "expenses",
            200,
            data=expense_data
        )
        
        # Get day summary
        success, response = self.run_test(
            "GET /api/reports/day-summary - verify structure",
            "GET",
            "reports/day-summary",
            200,
            validate_fn=lambda r: self.validate_day_summary_structure(r)
        )
        
        return success

    def validate_day_summary_structure(self, data):
        """Validate day summary response structure"""
        required_keys = ['date', 'cash_flow', 'top_items', 'khata', 'growth', 'alerts']
        
        for key in required_keys:
            if key not in data:
                return (False, f"Missing required key: {key}")
        
        # Validate cash_flow structure
        cash_flow_keys = ['cash_collected', 'upi_collected', 'hamali_payouts', 'expected_drawer_cash', 'total_collected']
        for key in cash_flow_keys:
            if key not in data['cash_flow']:
                return (False, f"Missing cash_flow key: {key}")
        
        # Validate khata structure
        if 'issued_today' not in data['khata'] or 'recovered_today' not in data['khata']:
            return (False, "Missing khata keys")
        
        # Validate growth structure
        growth_keys = ['mom_growth_pct', 'this_month_sales', 'prev_month_sales', 'outstanding_market_credit']
        for key in growth_keys:
            if key not in data['growth']:
                return (False, f"Missing growth key: {key}")
        
        # Validate alerts structure
        alerts_keys = ['expiring', 'low_stock', 'expiring_count', 'low_stock_count']
        for key in alerts_keys:
            if key not in data['alerts']:
                return (False, f"Missing alerts key: {key}")
        
        # Check if hamali_payouts reflects the expense we created
        if data['cash_flow']['hamali_payouts'] < 500.0:
            return (False, f"hamali_payouts should be at least 500, got {data['cash_flow']['hamali_payouts']}")
        
        # Check if top_items contains our product
        if self.test_product_id:
            found_product = any('Urea' in item.get('product_name', '') for item in data['top_items'])
            if not found_product:
                return (False, "top_items should contain Urea product")
        
        return (True, "Day summary structure is valid")

    def test_subsidy_csv_sync(self):
        """Test 7: Government subsidy CSV sync"""
        print("\n📄 Test 7: Government subsidy CSV sync")
        
        # Test with Sold (Bags) format
        csv_bags = """Product Name,Supplier,Opening (Bags),Received (Bags),Sold (Bags),Closing (Bags)
Urea (45kg),IFFCO,120,50,5,165"""
        
        success, response = self.run_test(
            "POST /api/subsidy/preview with Sold (Bags)",
            "POST",
            "subsidy/preview",
            200,
            data={"csv": csv_bags},
            validate_fn=lambda r: (
                (len(r.get('rows', [])) > 0 and r['rows'][0].get('sold_bags') == 5,
                 f"Preview should show sold_bags=5, got {r.get('rows', [{}])[0].get('sold_bags')}")
            )
        )
        
        if not success:
            print("⚠️ Failed to preview CSV with bags format")
        
        # Test with Sold (MT) format
        csv_mt = """Product Name,Sold (MT)
Urea (45kg),0.225"""
        
        success, response = self.run_test(
            "POST /api/subsidy/preview with Sold (MT) - should convert to bags",
            "POST",
            "subsidy/preview",
            200,
            data={"csv": csv_mt},
            validate_fn=lambda r: (
                (len(r.get('rows', [])) > 0 and r['rows'][0].get('sold_bags') == 5,
                 f"Preview should convert 0.225 MT to 5 bags (0.225*1000/45), got {r.get('rows', [{}])[0].get('sold_bags')}")
            )
        )
        
        if not success:
            print("⚠️ Failed to preview CSV with MT format")
        
        # Get current product quantity before applying
        success, response = self.run_test(
            "Get product quantity before subsidy apply",
            "GET",
            f"products/admin",
            200
        )
        
        initial_quantity = None
        if success:
            for p in response:
                if p.get('id') == self.test_product_id:
                    initial_quantity = p.get('quantity')
                    break
        
        # Apply subsidy CSV
        success, response = self.run_test(
            "POST /api/subsidy/apply - should decrease stock",
            "POST",
            "subsidy/apply",
            200,
            data={"csv": csv_bags},
            validate_fn=lambda r: (
                (r.get('applied', 0) >= 1, f"Should apply at least 1 row, got {r.get('applied')}")
            )
        )
        
        if success and initial_quantity is not None:
            # Verify stock decreased
            success, response = self.run_test(
                "Verify stock decreased after subsidy apply",
                "GET",
                f"products/admin",
                200
            )
            
            if success:
                for p in response:
                    if p.get('id') == self.test_product_id:
                        new_quantity = p.get('quantity')
                        if new_quantity == initial_quantity - 5:
                            print(f"✅ Stock decreased correctly after subsidy: {initial_quantity} → {new_quantity}")
                        else:
                            print(f"⚠️ Stock change unexpected: {initial_quantity} → {new_quantity} (expected {initial_quantity - 5})")
                        break
        
        return True

    def test_regression_endpoints(self):
        """Test 8: Regression - existing endpoints"""
        print("\n🔄 Test 8: Regression - existing endpoints")
        
        self.run_test(
            "GET /api/dashboard/stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        self.run_test(
            "GET /api/reports/daily",
            "GET",
            "reports/daily",
            200
        )
        
        self.run_test(
            "GET /api/reports/summary",
            "GET",
            "reports/summary",
            200,
            validate_fn=lambda r: (
                ('profit' in r and 'cash_flow' in r and 'expenses' in r,
                 "Summary should have profit, cash_flow, and expenses")
            )
        )
        
        self.run_test(
            "GET /api/purchases",
            "GET",
            "purchases",
            200
        )
        
        self.run_test(
            "GET /api/expenses",
            "GET",
            "expenses",
            200
        )
        
        self.run_test(
            "GET /api/shop-info",
            "GET",
            "shop-info",
            200
        )
        
        return True

    def test_data_management_info(self):
        """Test 9: Data Management - GET /api/data/info"""
        print("\n📊 Test 9: Data Management - GET /api/data/info")
        
        success, response = self.run_test(
            "GET /api/data/info - verify structure",
            "GET",
            "data/info",
            200,
            validate_fn=lambda r: self.validate_data_info_structure(r)
        )
        
        # Store counts for later comparison after reset-auth
        if success:
            self.initial_counts = response.get('counts', {})
        
        return success

    def validate_data_info_structure(self, data):
        """Validate data/info response structure"""
        required_keys = ['backend', 'mongo_url', 'db_name', 'backup_dir', 'counts', 'recent_backups']
        
        for key in required_keys:
            if key not in data:
                return (False, f"Missing required key: {key}")
        
        # Validate backend type
        if data['backend'] != 'mongodb':
            return (False, f"backend should be 'mongodb', got {data['backend']}")
        
        # Validate db_name
        if data['db_name'] != 'swarna_deepika_db':
            return (False, f"db_name should be 'swarna_deepika_db', got {data['db_name']}")
        
        # Validate backup_dir
        if data['backup_dir'] != '/app/backend/data/backups':
            return (False, f"backup_dir should be '/app/backend/data/backups', got {data['backup_dir']}")
        
        # Validate counts structure
        expected_collections = ['products', 'categories', 'customers', 'bills', 'loan_payments', 'expenses', 'purchases', 'users']
        for collection in expected_collections:
            if collection not in data['counts']:
                return (False, f"Missing count for collection: {collection}")
        
        # Validate recent_backups is a list
        if not isinstance(data['recent_backups'], list):
            return (False, "recent_backups should be a list")
        
        return (True, "Data info structure is valid")

    def test_data_export(self):
        """Test 10: Data Management - GET /api/data/export"""
        print("\n📦 Test 10: Data Management - GET /api/data/export")
        
        url = f"{self.base_url}/api/data/export"
        
        try:
            response = requests.get(url, timeout=60)
            
            if response.status_code != 200:
                self.log_test("GET /api/data/export - status code", False, f"Expected 200, got {response.status_code}")
                return False
            
            self.log_test("GET /api/data/export - status code 200", True)
            
            # Check Content-Type
            content_type = response.headers.get('Content-Type', '')
            if 'application/zip' not in content_type:
                self.log_test("Content-Type is application/zip", False, f"Expected application/zip, got {content_type}")
                return False
            
            self.log_test("Content-Type is application/zip", True)
            
            # Check Content-Disposition
            content_disposition = response.headers.get('Content-Disposition', '')
            if 'attachment' not in content_disposition or 'swarna_deepika_export_' not in content_disposition:
                self.log_test("Content-Disposition has attachment and filename", False, f"Got: {content_disposition}")
                return False
            
            self.log_test("Content-Disposition has attachment and filename", True)
            
            # Validate ZIP content
            import zipfile
            import io
            
            zip_buffer = io.BytesIO(response.content)
            
            try:
                with zipfile.ZipFile(zip_buffer, 'r') as zf:
                    file_list = zf.namelist()
                    
                    # Check required files
                    required_files = ['products.csv', 'categories.csv', 'customers.csv', 'bills.csv', 
                                      'loan_payments.csv', 'expenses.csv', 'purchases.csv', 'users.csv', '_metadata.json']
                    
                    for required_file in required_files:
                        if required_file not in file_list:
                            self.log_test(f"ZIP contains {required_file}", False, f"Missing file: {required_file}")
                            return False
                    
                    self.log_test("ZIP contains all required CSV files", True)
                    
                    # Check users.csv does NOT contain password_hash column
                    users_csv = zf.read('users.csv').decode('utf-8')
                    if 'password_hash' in users_csv:
                        self.log_test("users.csv does NOT contain password_hash", False, "Found password_hash column in users.csv")
                        return False
                    
                    self.log_test("users.csv does NOT contain password_hash", True)
                    
                    # Validate _metadata.json
                    metadata_json = zf.read('_metadata.json').decode('utf-8')
                    metadata = json.loads(metadata_json)
                    
                    if 'exported_at' not in metadata or 'collections' not in metadata or 'db_name' not in metadata:
                        self.log_test("_metadata.json has required keys", False, f"Missing keys in metadata: {metadata.keys()}")
                        return False
                    
                    self.log_test("_metadata.json is valid JSON with required keys", True)
                    
            except zipfile.BadZipFile:
                self.log_test("Response is a valid ZIP file", False, "Invalid ZIP file")
                return False
            
            return True
            
        except Exception as e:
            self.log_test("GET /api/data/export", False, f"Exception: {str(e)}")
            return False

    def test_data_reset_auth(self):
        """Test 11: Data Management - POST /api/data/reset-auth"""
        print("\n🔐 Test 11: Data Management - POST /api/data/reset-auth")
        
        # First, get current data counts
        success, info_response = self.run_test(
            "Get data info before reset-auth",
            "GET",
            "data/info",
            200
        )
        
        if not success:
            print("⚠️ Failed to get data info before reset")
            return False
        
        initial_counts = info_response.get('counts', {})
        print(f"  Initial counts: products={initial_counts.get('products')}, customers={initial_counts.get('customers')}, bills={initial_counts.get('bills')}")
        
        # Test negative case: wrong confirm_phrase
        success, response = self.run_test(
            "POST /api/data/reset-auth with wrong confirm_phrase",
            "POST",
            "data/reset-auth",
            400,
            data={
                "confirm_phrase": "reset",
                "admin_username": "admin",
                "admin_password": "swarna123"
            }
        )
        
        # Test negative case: wrong admin password
        success, response = self.run_test(
            "POST /api/data/reset-auth with wrong password",
            "POST",
            "data/reset-auth",
            401,
            data={
                "confirm_phrase": "RESET AUTH",
                "admin_username": "admin",
                "admin_password": "wrongpassword"
            }
        )
        
        # Test positive case: correct reset-auth
        success, response = self.run_test(
            "POST /api/data/reset-auth with correct credentials",
            "POST",
            "data/reset-auth",
            200,
            data={
                "confirm_phrase": "RESET AUTH",
                "admin_username": "admin",
                "admin_password": "swarna123"
            },
            validate_fn=lambda r: self.validate_reset_auth_response(r)
        )
        
        if not success:
            print("⚠️ CRITICAL: reset-auth failed")
            return False
        
        # Store backup filename for later download test
        self.backup_filename = response.get('backup_filename')
        backup_file = response.get('backup_file')
        backup_size = response.get('backup_size_bytes')
        
        print(f"  Backup created: {self.backup_filename} ({backup_size} bytes)")
        print(f"  Backup path: {backup_file}")
        
        # Test that admin/swarna123 login works after reset
        success, login_response = self.run_test(
            "Login with admin/swarna123 after reset-auth",
            "POST",
            "auth/login",
            200,
            data={
                "username": "admin",
                "password": "swarna123"
            },
            validate_fn=lambda r: (
                (r.get('success') == True, "Login should succeed after reset-auth")
            )
        )
        
        if not success:
            print("⚠️ CRITICAL: Admin login failed after reset-auth")
            return False
        
        # Verify business data is UNCHANGED
        success, info_after = self.run_test(
            "Get data info after reset-auth",
            "GET",
            "data/info",
            200
        )
        
        if success:
            final_counts = info_after.get('counts', {})
            print(f"  Final counts: products={final_counts.get('products')}, customers={final_counts.get('customers')}, bills={final_counts.get('bills')}")
            
            # Check business collections are unchanged
            business_collections = ['products', 'categories', 'customers', 'bills', 'loan_payments', 'expenses', 'purchases']
            
            all_unchanged = True
            for collection in business_collections:
                if initial_counts.get(collection) != final_counts.get(collection):
                    print(f"  ❌ {collection} count changed: {initial_counts.get(collection)} → {final_counts.get(collection)}")
                    all_unchanged = False
            
            if all_unchanged:
                self.log_test("Business data counts UNCHANGED after reset-auth", True)
            else:
                self.log_test("Business data counts UNCHANGED after reset-auth", False, "Some business data counts changed")
            
            # Check users count is now 1 (only admin)
            if final_counts.get('users') == 1:
                self.log_test("Users count is 1 after reset-auth", True)
            else:
                self.log_test("Users count is 1 after reset-auth", False, f"Expected 1 user, got {final_counts.get('users')}")
        
        return True

    def validate_reset_auth_response(self, data):
        """Validate reset-auth response structure"""
        required_keys = ['success', 'backup_file', 'backup_filename', 'backup_size_bytes', 'users_deleted', 'reseeded_admin', 'message']
        
        for key in required_keys:
            if key not in data:
                return (False, f"Missing required key: {key}")
        
        # Validate success is true
        if data['success'] != True:
            return (False, f"success should be true, got {data['success']}")
        
        # Validate backup_file is absolute path
        if not data['backup_file'].startswith('/app/backend/data/backups/backup_'):
            return (False, f"backup_file should start with /app/backend/data/backups/backup_, got {data['backup_file']}")
        
        if not data['backup_file'].endswith('.zip'):
            return (False, f"backup_file should end with .zip, got {data['backup_file']}")
        
        # Validate backup_size_bytes > 0
        if data['backup_size_bytes'] <= 0:
            return (False, f"backup_size_bytes should be > 0, got {data['backup_size_bytes']}")
        
        # Validate users_deleted >= 1
        if data['users_deleted'] < 1:
            return (False, f"users_deleted should be >= 1, got {data['users_deleted']}")
        
        # Validate reseeded_admin
        if data['reseeded_admin'].get('username') != 'admin':
            return (False, f"reseeded_admin.username should be 'admin', got {data['reseeded_admin'].get('username')}")
        
        if data['reseeded_admin'].get('password') != 'swarna123':
            return (False, f"reseeded_admin.password should be 'swarna123', got {data['reseeded_admin'].get('password')}")
        
        # Validate message contains backup path
        if data['backup_file'] not in data['message']:
            return (False, "message should contain backup_file path")
        
        return (True, "Reset-auth response is valid")

    def test_backup_download(self):
        """Test 12: Data Management - GET /api/data/backup/download/{name}"""
        print("\n💾 Test 12: Data Management - GET /api/data/backup/download/{name}")
        
        if not hasattr(self, 'backup_filename') or not self.backup_filename:
            print("⚠️ No backup filename available from reset-auth test")
            return False
        
        # Test positive case: download valid backup
        url = f"{self.base_url}/api/data/backup/download/{self.backup_filename}"
        
        try:
            response = requests.get(url, timeout=60)
            
            if response.status_code != 200:
                self.log_test(f"GET /api/data/backup/download/{self.backup_filename}", False, f"Expected 200, got {response.status_code}")
                return False
            
            self.log_test(f"GET /api/data/backup/download/{self.backup_filename} - status 200", True)
            
            # Check Content-Type
            content_type = response.headers.get('Content-Type', '')
            if 'application/zip' not in content_type:
                self.log_test("Backup download Content-Type is application/zip", False, f"Expected application/zip, got {content_type}")
            else:
                self.log_test("Backup download Content-Type is application/zip", True)
            
            # Validate ZIP content
            import zipfile
            import io
            
            zip_buffer = io.BytesIO(response.content)
            
            try:
                with zipfile.ZipFile(zip_buffer, 'r') as zf:
                    file_list = zf.namelist()
                    
                    # Check required files
                    required_files = ['products.csv', 'categories.csv', 'customers.csv', 'bills.csv', 
                                      'loan_payments.csv', 'expenses.csv', 'purchases.csv', 'users.csv', '_metadata.json']
                    
                    all_present = all(f in file_list for f in required_files)
                    
                    if all_present:
                        self.log_test("Backup ZIP contains all required files", True)
                    else:
                        self.log_test("Backup ZIP contains all required files", False, f"Missing files in backup")
                    
            except zipfile.BadZipFile:
                self.log_test("Backup download is a valid ZIP file", False, "Invalid ZIP file")
                return False
            
        except Exception as e:
            self.log_test(f"GET /api/data/backup/download/{self.backup_filename}", False, f"Exception: {str(e)}")
            return False
        
        # Test negative case: invalid filename (path traversal)
        success, response = self.run_test(
            "GET /api/data/backup/download with path traversal",
            "GET",
            "data/backup/download/../etc/passwd",
            400
        )
        
        # Test negative case: nonexistent but well-formed filename
        success, response = self.run_test(
            "GET /api/data/backup/download with nonexistent file",
            "GET",
            "data/backup/download/backup_19700101_000000.zip",
            404
        )
        
        return True

    def test_sanity_after_reset(self):
        """Test 13: Sanity check - business operations still work after reset-auth"""
        print("\n✅ Test 13: Sanity check - business operations after reset-auth")
        
        # Try to create a new product
        if not self.test_category_id:
            print("⚠️ No category available for sanity test")
            return False
        
        product_data = {
            "name": "DAP (50kg)",
            "name_telugu": "డిఏపి",
            "category_id": self.test_category_id,
            "batch_no": "BATCH2024999",
            "mfg_date": "2024-01-01",
            "exp_date": "2025-12-31",
            "purchase_price": 1500.0,
            "mrp": 1800.0,
            "selling_price": 1750.0,
            "quantity": 100,
            "unit": "bags",
            "bag_size_kg": 50
        }
        
        success, response = self.run_test(
            "Create product after reset-auth",
            "POST",
            "products",
            200,
            data=product_data
        )
        
        if not success:
            print("⚠️ Failed to create product after reset-auth")
            return False
        
        # Try to create a new customer
        customer_data = {
            "name": "Lakshmi Devi",
            "village": "Gangaram",
            "phone": "9123456789",
            "aadhaar": "999888777666"
        }
        
        success, response = self.run_test(
            "Create customer after reset-auth",
            "POST",
            "customers",
            200,
            data=customer_data
        )
        
        if not success:
            print("⚠️ Failed to create customer after reset-auth")
            return False
        
        new_customer_id = response.get('id')
        new_product_id = None
        
        # Get the product we just created
        success, products = self.run_test(
            "Get products after reset-auth",
            "GET",
            "products/admin",
            200
        )
        
        if success:
            for p in products:
                if p.get('name') == 'DAP (50kg)':
                    new_product_id = p.get('id')
                    break
        
        if not new_product_id:
            print("⚠️ Could not find newly created product")
            return False
        
        # Try to create a bill
        bill_data = {
            "customer_id": new_customer_id,
            "customer_name": "Lakshmi Devi",
            "village": "Gangaram",
            "items": [
                {
                    "product_id": new_product_id,
                    "product_name": "DAP (50kg)",
                    "batch_no": "BATCH2024999",
                    "mfg_date": "2024-01-01",
                    "exp_date": "2025-12-31",
                    "quantity": 1,
                    "unit": "bags",
                    "rate": 1750.0,
                    "amount": 1750.0
                }
            ],
            "total_amount": 1750.0,
            "payment_type": "cash",
            "paid_amount": 1750.0,
            "cash_amount": 1750.0,
            "upi_amount": 0.0
        }
        
        success, response = self.run_test(
            "Create bill after reset-auth",
            "POST",
            "bills",
            200,
            data=bill_data
        )
        
        if not success:
            print("⚠️ Failed to create bill after reset-auth")
            return False
        
        print("✅ All business operations working correctly after reset-auth")
        return True

    def run_all_tests(self):
        """Run all API tests in priority order"""
        print("🚀 Starting Swarna Deepika Backend API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 80)
        
        try:
            # Run tests in priority order
            if not self.test_health_and_auth():
                print("\n⚠️ CRITICAL: Auth tests failed - stopping test suite")
                return False
            
            self.test_products_with_bag_size()
            self.test_customers_with_aadhaar()
            self.test_bill_with_split_payment()
            self.test_loan_payment_with_method()
            self.test_day_summary()
            self.test_subsidy_csv_sync()
            self.test_regression_endpoints()
            
            # NEW DATA MANAGEMENT TESTS
            self.test_data_management_info()
            self.test_data_export()
            self.test_data_reset_auth()
            self.test_backup_download()
            self.test_sanity_after_reset()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with exception: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Print summary
        print("\n" + "=" * 80)
        print(f"📊 TEST SUMMARY")
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
    tester = SwarnaDeepikaBillingTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
