#!/usr/bin/env python3
"""
Test script to verify the new table format with flight codes and booking links
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.dirname(__file__))

from services.amadeus_service import AmadeusService
from services.flight_formatter import format_flight_for_dashboard

async def test_table_format():
    """Test the new table format with flight codes and booking links"""
    
    print("🧪 Testing New Table Format with Flight Codes and Booking Links")
    print("=" * 70)
    
    # Load environment variables
    load_dotenv()
    
    try:
        # Initialize Amadeus service
        amadeus_service = AmadeusService()
        print("✅ Amadeus service initialized")
        
        # Test flight search
        future_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        print(f"📅 Searching for flights on {future_date}")
        
        amadeus_data = amadeus_service.search_flights(
            origin="JFK",
            destination="CDG", 
            departure_date=future_date,
            adults=1
        )
        
        if amadeus_data and not amadeus_data.get('error'):
            print(f"✅ Found {amadeus_data.get('count', 0)} flights")
            
            # Format for dashboard
            dashboard_data = format_flight_for_dashboard(
                flight_data=amadeus_data,
                origin_city="New York",
                dest_city="Paris",
                origin_code="JFK",
                dest_code="CDG",
                departure_date=future_date
            )
            
            print(f"✅ Formatted {len(dashboard_data.get('outboundFlights', []))} outbound flights")
            
            # Test table generation
            from main import _generate_booking_link
            
            print("\n📊 Sample Table Format:")
            print("=" * 70)
            print("| Airline | Flight Code | Price | Duration | Stops | Departure | Book Now |")
            print("|---------|-------------|-------|----------|-------|-----------|----------|")
            
            for flight in dashboard_data.get('outboundFlights', [])[:3]:
                flight_code = flight.get('flightNumber', '').replace(' ', '')
                booking_link = _generate_booking_link(flight.get('airline', ''), flight_code)
                stops = flight.get('stops', 0)
                stops_display = "Non-stop" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"
                
                print(f"| {flight['airline']} | {flight_code} | ${flight['price']} | {flight['duration']} | {stops_display} | {flight['departure']} | [Book Now]({booking_link}) |")
            
            print("\n🔗 Sample Booking Links:")
            for flight in dashboard_data.get('outboundFlights', [])[:3]:
                flight_code = flight.get('flightNumber', '').replace(' ', '')
                booking_link = _generate_booking_link(flight.get('airline', ''), flight_code)
                print(f"  {flight['airline']} {flight_code}: {booking_link}")
            
            print(f"\n✅ Table format test completed successfully!")
            
        else:
            print(f"❌ No flight data found: {amadeus_data.get('error', 'Unknown error')}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_table_format())
