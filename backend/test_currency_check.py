"""
Check what currency Amadeus API returns
"""
import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.dirname(__file__))

from services.amadeus_service import AmadeusService

def check_currency():
    """Check currency from Amadeus API"""
    print("=" * 60)
    print("Amadeus API Currency Check")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    
    # Initialize service
    try:
        amadeus_service = AmadeusService()
        print("✓ AmadeusService initialized\n")
    except Exception as e:
        print(f"✗ Failed to initialize AmadeusService: {e}")
        return
    
    # Test with different routes to see currency variations
    test_cases = [
        {
            "name": "US Domestic (IAD -> LAX)",
            "origin": "IAD",
            "destination": "LAX",
        },
        {
            "name": "US to Europe (IAD -> IST)",
            "origin": "IAD",
            "destination": "IST",
        },
        {
            "name": "Europe Domestic (PAR -> BCN)",
            "origin": "PAR",
            "destination": "BCN",
        },
    ]
    
    departure_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    for test_case in test_cases:
        print(f"\n{'-' * 60}")
        print(f"Test: {test_case['name']}")
        print(f"Route: {test_case['origin']} -> {test_case['destination']}")
        print(f"Date: {departure_date}")
        print(f"{'-' * 60}")
        
        try:
            result = amadeus_service.search_flights(
                origin=test_case['origin'],
                destination=test_case['destination'],
                departure_date=departure_date,
                adults=1
            )
            
            if result.get('error'):
                print(f"✗ Error: {result['error']}")
                continue
            
            flights = result.get('flights', [])
            print(f"✓ Found {len(flights)} flights")
            
            if flights:
                # Check currency for first few flights
                currencies_found = {}
                for i, flight in enumerate(flights[:5]):
                    currency = flight.get('currency', 'UNKNOWN')
                    price = flight.get('price', 0)
                    
                    if currency not in currencies_found:
                        currencies_found[currency] = []
                    currencies_found[currency].append(price)
                    
                    print(f"  Flight {i+1}: {price} {currency}")
                
                print(f"\n  Currency Summary:")
                for currency, prices in currencies_found.items():
                    print(f"    {currency}: {len(prices)} flight(s), prices range: {min(prices)} - {max(prices)}")
            
        except Exception as e:
            print(f"✗ Exception: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("Currency check complete!")
    print("=" * 60)

if __name__ == "__main__":
    check_currency()

