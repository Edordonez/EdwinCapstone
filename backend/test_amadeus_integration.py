"""
Comprehensive test suite for Amadeus API integration
Tests multiple travel scenarios and API endpoints
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.dirname(__file__))

from services.amadeus_service import AmadeusService
from services.intent_detector import IntentDetector
from services.cache_manager import CacheManager


class AmadeusIntegrationTester:
    """Test suite for Amadeus API integration"""
    
    def __init__(self):
        # Load environment variables
        load_dotenv()
        
        # Initialize services
        self.amadeus_service = AmadeusService()
        self.intent_detector = IntentDetector()
        self.cache_manager = CacheManager()
        
        self.test_results = []
    
    async def run_all_tests(self):
        """Run all test scenarios"""
        print("Starting Amadeus API Integration Tests")
        print("=" * 60)
        
        # Test 1: Flight Search
        await self.test_flight_search()
        
        # Test 2: Hotel Search  
        await self.test_hotel_search()
        
        # Test 3: Activity Search
        await self.test_activity_search()
        
        # Test 4: Flight Inspiration
        await self.test_flight_inspiration()
        
        # Test 5: Location Search
        await self.test_location_search()
        
        # Test 6: Intent Detection
        await self.test_intent_detection()
        
        # Test 7: Cache Functionality
        await self.test_cache_functionality()
        
        # Test 8: Error Handling
        await self.test_error_handling()
        
        # Print summary
        self.print_summary()
    
    async def test_flight_search(self):
        """Test 1: Flight search functionality"""
        print("\nTest 1: Flight Search")
        print("-" * 30)
        
        try:
            # Test parameters
            origin = "PAR"  # Paris
            destination = "NYC"  # New York
            departure_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
            return_date = (datetime.now() + timedelta(days=37)).strftime("%Y-%m-%d")
            
            print(f"Searching flights: {origin} to {destination}")
            print(f"Departure: {departure_date}, Return: {return_date}")
            
            # Call Amadeus API
            result = self.amadeus_service.search_flights(
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                return_date=return_date,
                adults=1,
                max_price=800
            )
            
            if result.get('error'):
                print(f"[ERROR] API Error: {result['error']}")
                self.test_results.append(("Flight Search", False, result['error']))
            else:
                flights = result.get('flights', [])
                print(f"[OK] Found {len(flights)} flights")
                
                if flights:
                    # Show first flight details
                    first_flight = flights[0]
                    print(f"   Sample flight: {first_flight.get('price', 'N/A')} {first_flight.get('currency', 'USD')}")
                    print(f"   Itineraries: {len(first_flight.get('itineraries', []))}")
                
                self.test_results.append(("Flight Search", True, f"Found {len(flights)} flights"))
                
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Flight Search", False, str(e)))
    
    async def test_hotel_search(self):
        """Test 2: Hotel search functionality"""
        print("\nTest 2: Hotel Search")
        print("-" * 30)
        
        try:
            # Test parameters
            city_code = "PAR"  # Paris
            check_in = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
            check_out = (datetime.now() + timedelta(days=18)).strftime("%Y-%m-%d")
            
            print(f"Searching hotels in: {city_code}")
            print(f"Check-in: {check_in}, Check-out: {check_out}")
            
            # Call Amadeus API
            result = self.amadeus_service.search_hotels(
                city_code=city_code,
                check_in=check_in,
                check_out=check_out,
                adults=2,
                radius=50
            )
            
            if result.get('error'):
                print(f"[ERROR] API Error: {result['error']}")
                self.test_results.append(("Hotel Search", False, result['error']))
            else:
                hotels = result.get('hotels', [])
                print(f"[OK] Found {len(hotels)} hotels")
                
                if hotels:
                    # Show first hotel details
                    first_hotel = hotels[0]
                    print(f"   Sample hotel: {first_hotel.get('name', 'N/A')}")
                    print(f"   Price: {first_hotel.get('price', 'N/A')} {first_hotel.get('currency', 'USD')}")
                
                self.test_results.append(("Hotel Search", True, f"Found {len(hotels)} hotels"))
                
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Hotel Search", False, str(e)))
    
    async def test_activity_search(self):
        """Test 3: Activity search functionality"""
        print("\nTest 3: Activity Search")
        print("-" * 30)
        
        try:
            # Test parameters (Paris coordinates)
            latitude = 48.8566
            longitude = 2.3522
            radius = 20
            
            print(f"Searching activities near: {latitude}, {longitude}")
            print(f"Radius: {radius} km")
            
            # Call Amadeus API
            result = self.amadeus_service.search_activities(
                latitude=latitude,
                longitude=longitude,
                radius=radius
            )
            
            if result.get('error'):
                print(f"[ERROR] API Error: {result['error']}")
                self.test_results.append(("Activity Search", False, result['error']))
            else:
                activities = result.get('activities', [])
                print(f"[OK] Found {len(activities)} activities")
                
                if activities:
                    # Show first activity details
                    first_activity = activities[0]
                    print(f"   Sample activity: {first_activity.get('name', 'N/A')}")
                    print(f"   Price: {first_activity.get('price', 'N/A')} {first_activity.get('currency', 'USD')}")
                
                self.test_results.append(("Activity Search", True, f"Found {len(activities)} activities"))
                
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Activity Search", False, str(e)))
    
    async def test_flight_inspiration(self):
        """Test 4: Flight inspiration functionality"""
        print("\nTest 4: Flight Inspiration")
        print("-" * 30)
        
        try:
            # Test parameters
            origin = "NYC"  # New York
            max_price = 500
            departure_date = (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d")
            
            print(f"Finding destinations from: {origin}")
            print(f"Max price: ${max_price}, Departure: {departure_date}")
            
            # Call Amadeus API
            result = self.amadeus_service.get_flight_inspiration(
                origin=origin,
                max_price=max_price,
                departure_date=departure_date
            )
            
            if result.get('error'):
                print(f"[ERROR] API Error: {result['error']}")
                self.test_results.append(("Flight Inspiration", False, result['error']))
            else:
                destinations = result.get('destinations', [])
                print(f"[OK] Found {len(destinations)} destinations")
                
                if destinations:
                    # Show first few destinations
                    for i, dest in enumerate(destinations[:3], 1):
                        print(f"   {i}. {dest.get('destination', 'N/A')} - {dest.get('price', 'N/A')} {dest.get('currency', 'USD')}")
                
                self.test_results.append(("Flight Inspiration", True, f"Found {len(destinations)} destinations"))
                
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Flight Inspiration", False, str(e)))
    
    async def test_location_search(self):
        """Test 5: Location search functionality"""
        print("\nTest 5: Location Search")
        print("-" * 30)
        
        try:
            # Test parameters
            keyword = "Paris"
            
            print(f"Searching locations for: {keyword}")
            
            # Call Amadeus API
            result = self.amadeus_service.get_airport_city_search(keyword=keyword)
            
            if result.get('error'):
                print(f"[ERROR] API Error: {result['error']}")
                self.test_results.append(("Location Search", False, result['error']))
            else:
                locations = result.get('locations', [])
                print(f"[OK] Found {len(locations)} locations")
                
                if locations:
                    # Show first few locations
                    for i, loc in enumerate(locations[:3], 1):
                        print(f"   {i}. {loc.get('name', 'N/A')} ({loc.get('code', 'N/A')}) - {loc.get('type', 'N/A')}")
                
                self.test_results.append(("Location Search", True, f"Found {len(locations)} locations"))
                
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Location Search", False, str(e)))
    
    async def test_intent_detection(self):
        """Test 6: Intent detection functionality"""
        print("\nTest 6: Intent Detection")
        print("-" * 30)
        
        test_messages = [
            "Find flights from Paris to Tokyo under $800 in December",
            "Show me hotels in Barcelona for 3 nights starting March 15",
            "What can I do in London?",
            "Where can I go from NYC for $500?",
            "Search for airports in Paris",
            "Hello, how are you?"
        ]
        
        try:
            for i, message in enumerate(test_messages, 1):
                print(f"\n   Test {i}: {message}")
                
                intent = await self.intent_detector.analyze_message(message)
                
                print(f"   Intent: {intent['type']} (confidence: {intent['confidence']:.2f})")
                print(f"   Has required params: {intent['has_required_params']}")
                
                if intent['params']:
                    print(f"   Params: {intent['params']}")
            
            self.test_results.append(("Intent Detection", True, f"Tested {len(test_messages)} messages"))
            
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Intent Detection", False, str(e)))
    
    async def test_cache_functionality(self):
        """Test 7: Cache functionality"""
        print("\nTest 7: Cache Functionality")
        print("-" * 30)
        
        try:
            session_id = "test_session_123"
            api_type = "flight_search"
            params = {"origin": "PAR", "destination": "NYC", "departure_date": "2024-12-01"}
            
            # Test data
            test_data = {"flights": [{"price": "500", "currency": "USD"}]}
            
            print("Testing cache operations...")
            
            # Test set
            self.cache_manager.set(session_id, api_type, params, test_data)
            print("[OK] Data cached successfully")
            
            # Test get
            cached_data = self.cache_manager.get(session_id, api_type, params)
            if cached_data:
                print("[OK] Data retrieved from cache")
                print(f"   Cached data: {cached_data}")
            else:
                print("[ERROR] Failed to retrieve cached data")
                self.test_results.append(("Cache Functionality", False, "Failed to retrieve cached data"))
                return
            
            # Test clear session
            self.cache_manager.clear_session(session_id)
            cached_data_after_clear = self.cache_manager.get(session_id, api_type, params)
            if not cached_data_after_clear:
                print("[OK] Session cleared successfully")
            else:
                print("[ERROR] Failed to clear session")
                self.test_results.append(("Cache Functionality", False, "Failed to clear session"))
                return
            
            self.test_results.append(("Cache Functionality", True, "All cache operations successful"))
            
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Cache Functionality", False, str(e)))
    
    async def test_error_handling(self):
        """Test 8: Error handling"""
        print("\nTest 8: Error Handling")
        print("-" * 30)
        
        try:
            # Test with invalid parameters
            print("Testing with invalid flight search...")
            result = self.amadeus_service.search_flights(
                origin="INVALID",
                destination="INVALID", 
                departure_date="invalid-date",
                adults=1
            )
            
            if result.get('error'):
                print(f"[OK] Error handled gracefully: {result['error']}")
                self.test_results.append(("Error Handling", True, "Errors handled gracefully"))
            else:
                print("❌ Expected error but got success")
                self.test_results.append(("Error Handling", False, "Expected error but got success"))
                
        except Exception as e:
            print(f"[ERROR] Test failed: {e}")
            self.test_results.append(("Error Handling", False, str(e)))
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for _, success, _ in self.test_results if success)
        total = len(self.test_results)
        
        print(f"Total tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success rate: {(passed/total)*100:.1f}%")
        
        print("\nDetailed Results:")
        for test_name, success, message in self.test_results:
            status = "[PASS]" if success else "[FAIL]"
            print(f"  {status} - {test_name}: {message}")
        
        print("\n" + "=" * 60)
        
        if passed == total:
            print("[SUCCESS] All tests passed! Amadeus integration is working correctly.")
        else:
            print("[WARNING] Some tests failed. Check the details above.")


async def main():
    """Main test runner"""
    tester = AmadeusIntegrationTester()
    await tester.run_all_tests()
    
    # Clean up
    tester.amadeus_service.close()


if __name__ == "__main__":
    asyncio.run(main())
