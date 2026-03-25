import requests
import sys
from datetime import datetime

class GirogirotondoAPITester:
    def __init__(self, base_url="https://early-learning-hub-14.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_login(self, role, email, password):
        """Test login for different roles"""
        success, response = self.run_test(
            f"Login as {role}",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.tokens[role] = response['token']
            self.users[role] = response['user']
            return True
        return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n=== TESTING AUTHENTICATION ===")
        
        # Test login for all roles
        credentials = {
            'admin': ('admin@girogirotondo.it', 'admin123'),
            'teacher': ('giulia@girogirotondo.it', 'teacher123'),
            'parent': ('paolo@famiglia.it', 'parent123')
        }
        
        for role, (email, password) in credentials.items():
            if not self.test_login(role, email, password):
                return False
        
        # Test /auth/me endpoint
        for role in ['admin', 'teacher', 'parent']:
            if role in self.tokens:
                self.run_test(
                    f"Get current user ({role})",
                    "GET",
                    "auth/me",
                    200,
                    token=self.tokens[role]
                )
        
        return True

    def test_user_management(self):
        """Test user management endpoints (admin only)"""
        print("\n=== TESTING USER MANAGEMENT ===")
        
        if 'admin' not in self.tokens:
            print("❌ Admin token not available, skipping user management tests")
            return False
        
        admin_token = self.tokens['admin']
        
        # Get all users
        self.run_test("Get all users", "GET", "users", 200, token=admin_token)
        
        # Create a test user
        test_user_data = {
            "name": "Test User",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@test.it",
            "password": "test123",
            "role": "parent"
        }
        
        success, user_response = self.run_test(
            "Create new user",
            "POST",
            "users",
            200,
            data=test_user_data,
            token=admin_token
        )
        
        # Delete the test user if created
        if success and 'id' in user_response:
            self.run_test(
                "Delete test user",
                "DELETE",
                f"users/{user_response['id']}",
                200,
                token=admin_token
            )
        
        return True

    def test_classes_and_students(self):
        """Test classes and students endpoints"""
        print("\n=== TESTING CLASSES & STUDENTS ===")
        
        # Get classes (public endpoint)
        self.run_test("Get all classes", "GET", "classes", 200)
        
        # Get students (public endpoint)
        self.run_test("Get all students", "GET", "students", 200)
        
        # Test with class filter
        if 'teacher' in self.users and self.users['teacher'].get('class_id'):
            class_id = self.users['teacher']['class_id']
            self.run_test(
                "Get students by class",
                "GET",
                f"students?class_id={class_id}",
                200
            )
        
        return True

    def test_griglia_endpoints(self):
        """Test griglia (daily grid) endpoints"""
        print("\n=== TESTING GRIGLIA ENDPOINTS ===")
        
        # Get griglia data
        self.run_test("Get griglia data", "GET", "griglia", 200)
        
        # Test with filters
        today = datetime.now().strftime('%Y-%m-%d')
        self.run_test(
            "Get griglia by date",
            "GET",
            f"griglia?date={today}",
            200
        )
        
        if 'teacher' in self.users and self.users['teacher'].get('class_id'):
            class_id = self.users['teacher']['class_id']
            self.run_test(
                "Get griglia by class",
                "GET",
                f"griglia?class_id={class_id}",
                200
            )
        
        return True

    def test_content_endpoints(self):
        """Test diary, gallery, meals endpoints"""
        print("\n=== TESTING CONTENT ENDPOINTS ===")
        
        # Test diary
        self.run_test("Get diary entries", "GET", "diary", 200)
        
        # Test gallery
        self.run_test("Get gallery items", "GET", "gallery", 200)
        
        # Test meals
        self.run_test("Get meals", "GET", "meals", 200)
        
        return True

    def test_appointments(self):
        """Test appointment endpoints"""
        print("\n=== TESTING APPOINTMENTS ===")
        
        # Get appointments
        self.run_test("Get appointments", "GET", "appointments", 200)
        
        # Get appointment slots
        self.run_test("Get appointment slots", "GET", "appointment-slots", 200)
        
        # Test with date filter
        today = datetime.now().strftime('%Y-%m-%d')
        self.run_test(
            "Get appointment slots for date",
            "GET",
            f"appointment-slots?date={today}",
            200
        )
        
        return True

    def test_documents(self):
        """Test document and read receipt endpoints"""
        print("\n=== TESTING DOCUMENTS & READ RECEIPTS ===")
        
        # Get documents
        self.run_test("Get documents", "GET", "documents", 200)
        
        # Get read receipts
        self.run_test("Get read receipts", "GET", "read-receipts", 200)
        
        return True

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Girogirotondo API Tests")
        print(f"📍 Base URL: {self.base_url}")
        
        # Test basic connectivity
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            if response.status_code == 200:
                print("✅ API is accessible")
            else:
                print(f"❌ API connectivity issue: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Cannot connect to API: {e}")
            return False
        
        # Run test suites
        test_suites = [
            self.test_auth_endpoints,
            self.test_user_management,
            self.test_classes_and_students,
            self.test_griglia_endpoints,
            self.test_content_endpoints,
            self.test_appointments,
            self.test_documents
        ]
        
        for test_suite in test_suites:
            try:
                test_suite()
            except Exception as e:
                print(f"❌ Test suite failed: {e}")
        
        # Print results
        print(f"\n📊 FINAL RESULTS")
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for failure in self.failed_tests:
                print(f"   - {failure}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = GirogirotondoAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())