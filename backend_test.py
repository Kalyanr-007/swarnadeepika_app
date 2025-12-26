import requests
import sys
import json
from datetime import datetime, timezone

class SwarnaDeepikaBillingTester:
    def __init__(self, base_url="https://harvest-receipt-app.preview.emergentagent.com"):
        self.base_url = base_url
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_user_id = None
        self.test_category_id = None
        self.test_product_id = None
        self.test_customer_id = None
        self.test_bill_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if success:
                self.log_test(name, True)
                return True, response_data
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}: {response.text}")
                return False, response_data

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test user registration
        test_username = f"testuser_{datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "username": test_username,
                "password": "testpass123",
                "role": "admin"
            }
        )
        
        if success:
            self.test_user_id = response.get('id')
        
        # Test user login
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data={
                "username": test_username,
                "password": "testpass123"
            }
        )
        
        if success and response.get('success'):
            print(f"✅ Login successful for user: {response.get('user', {}).get('username')}")
        
        # Test invalid login
        self.run_test(
            "Invalid Login",
            "POST",
            "auth/login", 
            401,
            data={
                "username": "invalid_user",
                "password": "wrong_password"
            }
        )

    def test_category_endpoints(self):
        """Test category management endpoints"""
        print("\n📂 Testing Category Endpoints...")
        
        # Create category
        success, response = self.run_test(
            "Create Category",
            "POST",
            "categories",
            200,
            data={
                "name": "Test Fertilizers",
                "description": "Test category for fertilizers"
            }
        )
        
        if success:
            self.test_category_id = response.get('id')
        
        # Get categories
        self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )

    def test_product_endpoints(self):
        """Test product management endpoints"""
        print("\n📦 Testing Product Endpoints...")
        
        if not self.test_category_id:
            print("⚠️ Skipping product tests - no category ID available")
            return
        
        # Create product
        success, response = self.run_test(
            "Create Product",
            "POST",
            "products",
            200,
            data={
                "name": "Test Urea",
                "name_telugu": "టెస్ట్ యూరియా",
                "category_id": self.test_category_id,
                "batch_no": "BATCH001",
                "mfg_date": "2024-01-01",
                "exp_date": "2025-12-31",
                "purchase_price": 500.0,
                "mrp": 600.0,
                "selling_price": 580.0,
                "quantity": 100,
                "unit": "kg"
            }
        )
        
        if success:
            self.test_product_id = response.get('id')
        
        # Get products (public view)
        self.run_test(
            "Get Products (Public)",
            "GET",
            "products",
            200
        )
        
        # Get products (admin view)
        self.run_test(
            "Get Products (Admin)",
            "GET",
            "products/admin",
            200
        )
        
        # Get single product
        if self.test_product_id:
            self.run_test(
                "Get Single Product",
                "GET",
                f"products/{self.test_product_id}",
                200
            )

    def test_customer_endpoints(self):
        """Test customer management endpoints"""
        print("\n👥 Testing Customer Endpoints...")
        
        # Create customer
        success, response = self.run_test(
            "Create Customer",
            "POST",
            "customers",
            200,
            data={
                "name": "Test Customer",
                "village": "Test Village",
                "phone": "9876543210",
                "address": "Test Address"
            }
        )
        
        if success:
            self.test_customer_id = response.get('id')
        
        # Get customers
        self.run_test(
            "Get Customers",
            "GET",
            "customers",
            200
        )
        
        # Search customers
        self.run_test(
            "Search Customers",
            "GET",
            "customers?search=Test",
            200
        )
        
        # Get single customer
        if self.test_customer_id:
            self.run_test(
                "Get Single Customer",
                "GET",
                f"customers/{self.test_customer_id}",
                200
            )

    def test_bill_endpoints(self):
        """Test billing endpoints"""
        print("\n🧾 Testing Bill Endpoints...")
        
        if not self.test_product_id or not self.test_customer_id:
            print("⚠️ Skipping bill tests - missing product or customer ID")
            return
        
        # Create cash bill
        success, response = self.run_test(
            "Create Cash Bill",
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
                        "product_name": "Test Urea",
                        "batch_no": "BATCH001",
                        "mfg_date": "2024-01-01",
                        "exp_date": "2025-12-31",
                        "quantity": 2,
                        "unit": "kg",
                        "rate": 580.0,
                        "amount": 1160.0
                    }
                ],
                "total_amount": 1160.0,
                "payment_type": "cash",
                "paid_amount": 1160.0
            }
        )
        
        if success:
            self.test_bill_id = response.get('id')
        
        # Create credit bill
        self.run_test(
            "Create Credit Bill",
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
                        "product_name": "Test Urea",
                        "batch_no": "BATCH001",
                        "mfg_date": "2024-01-01",
                        "exp_date": "2025-12-31",
                        "quantity": 1,
                        "unit": "kg",
                        "rate": 580.0,
                        "amount": 580.0
                    }
                ],
                "total_amount": 580.0,
                "payment_type": "credit",
                "paid_amount": 0.0
            }
        )
        
        # Get bills
        self.run_test(
            "Get All Bills",
            "GET",
            "bills",
            200
        )
        
        # Get single bill
        if self.test_bill_id:
            self.run_test(
                "Get Single Bill",
                "GET",
                f"bills/{self.test_bill_id}",
                200
            )

    def test_loan_endpoints(self):
        """Test loan/credit management endpoints"""
        print("\n💰 Testing Loan/Credit Endpoints...")
        
        # Get pending loans
        success, response = self.run_test(
            "Get Pending Loans",
            "GET",
            "loans/pending",
            200
        )
        
        # Test loan payment if there are pending loans
        if success and response and len(response) > 0:
            bill_with_balance = None
            for bill in response:
                if bill.get('balance_amount', 0) > 0:
                    bill_with_balance = bill
                    break
            
            if bill_with_balance:
                self.run_test(
                    "Record Loan Payment",
                    "POST",
                    "loans/payment",
                    200,
                    data={
                        "bill_id": bill_with_balance['id'],
                        "amount": min(100.0, bill_with_balance['balance_amount']),
                        "notes": "Test payment"
                    }
                )

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n📊 Testing Dashboard Endpoints...")
        
        # Get dashboard stats
        self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        # Get recent bills
        self.run_test(
            "Get Recent Bills",
            "GET",
            "dashboard/recent-bills",
            200
        )
        
        # Get shop info
        self.run_test(
            "Get Shop Info",
            "GET",
            "shop-info",
            200
        )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Swarna Deepika Billing API Tests...")
        print(f"Base URL: {self.base_url}")
        
        try:
            self.test_auth_endpoints()
            self.test_category_endpoints()
            self.test_product_endpoints()
            self.test_customer_endpoints()
            self.test_bill_endpoints()
            self.test_loan_endpoints()
            self.test_dashboard_endpoints()
            
        except Exception as e:
            print(f"❌ Test suite failed with exception: {str(e)}")
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "0%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SwarnaDeepikaBillingTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())