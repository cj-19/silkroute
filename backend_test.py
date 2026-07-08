import requests
import sys
import json
from datetime import datetime

class SilkRouteAPITester:
    def __init__(self, base_url="https://bilingual-builder-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.member_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, auth_token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if auth_token:
            test_headers['Authorization'] = f'Bearer {auth_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)

            # Handle multiple expected status codes
            if isinstance(expected_status, list):
                success = response.status_code in expected_status
            else:
                success = response.status_code == expected_status
                
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                expected_str = str(expected_status) if not isinstance(expected_status, list) else f"one of {expected_status}"
                print(f"❌ Failed - Expected {expected_str}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@silkroute.com", "password": "password123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_member_login(self):
        """Test member login"""
        success, response = self.run_test(
            "Member Login",
            "POST",
            "auth/login",
            200,
            data={"email": "test@silkroute.com", "password": "password123"}
        )
        if success and 'access_token' in response:
            self.member_token = response['access_token']
            print(f"   Member token obtained: {self.member_token[:20]}...")
            return True
        return False

    def test_register_new_user(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_email = f"test_user_{timestamp}@silkroute.com"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!",
                "name": f"Test User {timestamp}",
                "phone": "+22500000000",
                "location": "Abidjan, Côte d'Ivoire",
                "language": "fr"
            }
        )
        return success

    def test_get_groupages(self):
        """Test getting all groupages"""
        return self.run_test("Get All Groupages", "GET", "groupages", 200)

    def test_get_single_groupage(self):
        """Test getting a single groupage"""
        # First get all groupages to find an ID
        success, groupages = self.run_test("Get Groupages for ID", "GET", "groupages", 200)
        if success and groupages and len(groupages) > 0:
            groupage_id = groupages[0]['groupage_id']
            return self.run_test(f"Get Single Groupage ({groupage_id})", "GET", f"groupages/{groupage_id}", 200)
        else:
            print("❌ No groupages found to test single groupage endpoint")
            return False

    def test_get_groupage_pricing(self):
        """Test getting groupage pricing with quantity parameter"""
        # First get all groupages to find an ID
        success, groupages = self.run_test("Get Groupages for Pricing", "GET", "groupages", 200)
        if success and groupages and len(groupages) > 0:
            groupage_id = groupages[0]['groupage_id']
            # Test with quantity=10 as specified in requirements
            success, pricing_data = self.run_test(f"Get Groupage Pricing ({groupage_id}) with quantity=10", "GET", f"groupages/{groupage_id}/pricing?quantity=10", 200)
            
            if success and pricing_data:
                # Verify the pricing structure contains required fields
                required_fields = ['solo_price', 'groupage_price', 'local_price', 'savings']
                missing_fields = [field for field in required_fields if field not in pricing_data]
                if missing_fields:
                    print(f"❌ Missing pricing fields: {missing_fields}")
                    return False
                
                # Check if savings are present
                if 'savings' in pricing_data and 'vs_solo_fcfa' in pricing_data['savings']:
                    savings_amount = pricing_data['savings']['vs_solo_fcfa']
                    print(f"   💰 Savings vs Solo: {savings_amount} FCFA")
                
                print(f"   ✅ Pricing structure validated")
                return True
            return success
        else:
            print("❌ No groupages found to test pricing endpoint")
            return False

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        if not self.admin_token:
            print("❌ Admin token required for stats test")
            return False
        
        return self.run_test("Admin Stats", "GET", "admin/stats", 200, auth_token=self.admin_token)

    def test_admin_warnings(self):
        """Test admin warnings endpoint"""
        if not self.admin_token:
            print("❌ Admin token required for warnings test")
            return False
        
        return self.run_test("Admin Warnings", "GET", "admin/warnings", 200, auth_token=self.admin_token)

    def test_unauthorized_admin_access(self):
        """Test that non-admin users can't access admin endpoints"""
        if not self.member_token:
            print("❌ Member token required for unauthorized access test")
            return False
        
        return self.run_test("Unauthorized Admin Access", "GET", "admin/stats", 403, auth_token=self.member_token)

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        return self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrongpassword"}
        )

    def test_categories_endpoint(self):
        """Test categories endpoint"""
        success, categories = self.run_test("Get Categories", "GET", "categories", 200)
        if success:
            print(f"   📂 Found {len(categories) if categories else 0} categories")
        return success

    def test_buyer_profiles_endpoint(self):
        """Test buyer profiles endpoint"""
        success, profiles = self.run_test("Get Buyer Profiles", "GET", "buyer-profiles", 200)
        if success:
            print(f"   👤 Found {len(profiles) if profiles else 0} buyer profiles")
        return success

    def test_create_proposal_auth_required(self):
        """Test that creating proposals requires authentication"""
        if not self.member_token:
            print("❌ Member token required for proposal test")
            return False
        
        proposal_data = {
            "product_url": "https://www.alibaba.com/product-detail/test",
            "title": "Test Product Proposal",
            "description": "Test description",
            "estimated_unit_price_cny": 50.0
        }
        
        return self.run_test("Create Product Proposal", "POST", "proposals", 200, 
                           data=proposal_data, auth_token=self.member_token)

    def test_get_groupage_documents_auth_required(self):
        """Test that getting groupage documents requires authentication"""
        # First get all groupages to find an ID
        success, groupages = self.run_test("Get Groupages for Documents", "GET", "groupages", 200)
        if success and groupages and len(groupages) > 0:
            groupage_id = groupages[0]['groupage_id']
            
            # Test without auth - should fail
            no_auth_success, _ = self.run_test(f"Get Groupage Documents No Auth ({groupage_id})", "GET", f"groupages/{groupage_id}/documents", 401)
            
            # Test with member auth - might fail if not a member (403) or succeed if member
            if self.member_token:
                auth_success, _ = self.run_test(f"Get Groupage Documents With Auth ({groupage_id})", "GET", f"groupages/{groupage_id}/documents", [200, 403], auth_token=self.member_token)
                return no_auth_success and auth_success
            
            return no_auth_success
        else:
            print("❌ No groupages found to test documents endpoint")
            return False

    def test_get_transitaires(self):
        """Test getting all transitaires - should return 5 transitaires from 5 cities"""
        success, transitaires = self.run_test("Get All Transitaires", "GET", "transitaires", 200)
        if success and transitaires:
            print(f"   🚚 Found {len(transitaires)} transitaires")
            
            # Check if we have 5 transitaires as expected
            if len(transitaires) == 5:
                print("   ✅ Correct number of transitaires (5)")
                
                # Check cities mentioned in requirements: Douala, Lagos, Abidjan, Dakar
                cities = [t.get('city', '') for t in transitaires]
                expected_cities = ['Douala', 'Lagos', 'Abidjan', 'Dakar']
                found_cities = [city for city in expected_cities if any(city in c for c in cities)]
                print(f"   🏙️ Cities found: {cities}")
                print(f"   ✅ Expected cities found: {found_cities}")
                
                return True
            else:
                print(f"   ❌ Expected 5 transitaires, found {len(transitaires)}")
                return False
        return success

    def test_simulate_pricing(self):
        """Test simulation API with unit_price_cny, unit_weight_kg, quantity"""
        simulation_data = {
            "unit_price_cny": 950.0,
            "unit_weight_kg": 0.5,
            "quantity": 10
        }
        
        success, result = self.run_test("Simulate Pricing", "POST", "simulate", 200, data=simulation_data)
        
        if success and result:
            # Check required fields in response
            required_fields = ['solo_price', 'groupage_price_estimate', 'savings']
            missing_fields = [field for field in required_fields if field not in result]
            
            if missing_fields:
                print(f"   ❌ Missing simulation fields: {missing_fields}")
                return False
            
            # Check if savings > 0 as required
            if 'savings' in result and 'amount_fcfa' in result['savings']:
                savings_amount = result['savings']['amount_fcfa']
                print(f"   💰 Savings amount: {savings_amount} FCFA")
                
                if savings_amount > 0:
                    print("   ✅ Savings > 0 as expected")
                    return True
                else:
                    print("   ❌ Savings should be > 0")
                    return False
            else:
                print("   ❌ Savings amount not found in response")
                return False
        
        return success

    def test_create_transitaire_admin_only(self):
        """Test creating transitaire - admin only"""
        if not self.admin_token:
            print("❌ Admin token required for transitaire creation test")
            return False
        
        transitaire_data = {
            "name": "Test Transitaire Ltd",
            "city": "Test City",
            "country": "Test Country",
            "license_number": "TEST123456",
            "contact_phone": "+22500000000",
            "contact_email": "test@transitaire.com",
            "shipping_price_per_kg_cny": 45.0,
            "estimated_days": 15,
            "is_active": True
        }
        
        success, response = self.run_test("Create Transitaire (Admin)", "POST", "admin/transitaires", 200, 
                                        data=transitaire_data, auth_token=self.admin_token)
        
        if success and response:
            print(f"   ✅ Transitaire created with ID: {response.get('transitaire_id', 'N/A')}")
            return True
        
        return success

    def test_create_transitaire_member_forbidden(self):
        """Test that members cannot create transitaires"""
        if not self.member_token:
            print("❌ Member token required for forbidden access test")
            return False
        
        transitaire_data = {
            "name": "Unauthorized Transitaire",
            "city": "Test City",
            "country": "Test Country",
            "license_number": "UNAUTH123",
            "shipping_price_per_kg_cny": 45.0,
            "estimated_days": 15
        }
        
        return self.run_test("Create Transitaire (Member - Should Fail)", "POST", "admin/transitaires", 403, 
                           data=transitaire_data, auth_token=self.member_token)

def main():
    print("🚀 Starting SilkRoute API Tests")
    print("=" * 50)
    
    tester = SilkRouteAPITester()
    
    # Test sequence
    tests = [
        ("Root API Endpoint", tester.test_root_endpoint),
        ("Admin Login", tester.test_admin_login),
        ("Member Login", tester.test_member_login),
        ("User Registration", tester.test_register_new_user),
        ("Get All Groupages", tester.test_get_groupages),
        ("Get Single Groupage", tester.test_get_single_groupage),
        ("Get Groupage Pricing", tester.test_get_groupage_pricing),
        ("Get Categories", tester.test_categories_endpoint),
        ("Get Buyer Profiles", tester.test_buyer_profiles_endpoint),
        ("Create Product Proposal", tester.test_create_proposal_auth_required),
        ("Get Groupage Documents", tester.test_get_groupage_documents_auth_required),
        ("Get All Transitaires", tester.test_get_transitaires),
        ("Simulate Pricing", tester.test_simulate_pricing),
        ("Create Transitaire (Admin Only)", tester.test_create_transitaire_admin_only),
        ("Create Transitaire (Member Forbidden)", tester.test_create_transitaire_member_forbidden),
        ("Admin Stats", tester.test_admin_stats),
        ("Admin Warnings", tester.test_admin_warnings),
        ("Unauthorized Admin Access", tester.test_unauthorized_admin_access),
        ("Invalid Login", tester.test_invalid_login),
    ]
    
    print(f"\nRunning {len(tests)} test categories...")
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test category failed with exception: {e}")
            tester.failed_tests.append({
                'name': test_name,
                'error': str(e)
            })
    
    # Print results
    print(f"\n{'='*50}")
    print(f"📊 Test Results:")
    print(f"   Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "   No tests run")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"   {i}. {failure['name']}")
            if 'expected' in failure:
                print(f"      Expected: {failure['expected']}, Got: {failure['actual']}")
            if 'error' in failure:
                print(f"      Error: {failure['error']}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())