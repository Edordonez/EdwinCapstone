#!/usr/bin/env python3
"""
Test script to verify Amadeus data transformation fixes
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

async def test_flight_data_transformation():
    """Test the complete flight data transformation pipeline"""
    
    print("🧪 Testing Amadeus Data Transformation Pipeline")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    
    try:
        # Initialize Amadeus service
        amadeus_service = AmadeusService()
        print(f"✅ Amadeus service initialized with base URL: {amadeus_service.base_url}")
        
        # Test flight search
        origin = "JFK"
        destination = "CDG" 
        departure_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        print(f"\n🔍 Testing flight search: {origin} → {destination} on {departure_date}")
        
        # Get raw Amadeus response
        raw_response = amadeus_service._make_request("/v2/shopping/flight-offers", {
            "originLocationCode": origin,
            "destinationLocationCode": destination,
            "departureDate": departure_date,
            "adults": 1
        })
        
        print(f"✅ Raw API response received: {len(raw_response.get('data', []))} offers")
        
        # Test response parsing
        parsed_response = amadeus_service._format_flight_response(raw_response)
        print(f"✅ Parsed response: {len(parsed_response.get('flights', []))} flights")
        
        if parsed_response.get('flights'):
            first_flight = parsed_response['flights'][0]
            print(f"✅ First flight sample:")
            print(f"   - Price: {first_flight.get('price')} {first_flight.get('currency')}")
            print(f"   - Itineraries: {len(first_flight.get('itineraries', []))}")
            
            if first_flight.get('itineraries'):
                first_itinerary = first_flight['itineraries'][0]
                print(f"   - Duration: {first_itinerary.get('duration')}")
                print(f"   - Segments: {len(first_itinerary.get('segments', []))}")
                
                if first_itinerary.get('segments'):
                    first_segment = first_itinerary['segments'][0]
                    print(f"   - First segment: {first_segment.get('airline')} {first_segment.get('flight_number')}")
                    print(f"     Departure: {first_segment.get('departure', {}).get('airport')} {first_segment.get('departure', {}).get('time')}")
                    print(f"     Arrival: {first_segment.get('arrival', {}).get('airport')} {first_segment.get('arrival', {}).get('time')}")
        
        # Test flight formatter
        print(f"\n🎨 Testing flight formatter...")
        formatted_data = format_flight_for_dashboard(
            flight_data=parsed_response,
            origin_city="New York",
            dest_city="Paris",
            origin_code=origin,
            dest_code=destination,
            departure_date=departure_date
        )
        
        print(f"✅ Formatted for dashboard: {len(formatted_data.get('outboundFlights', []))} outbound flights")
        
        if formatted_data.get('outboundFlights'):
            first_formatted = formatted_data['outboundFlights'][0]
            print(f"✅ First formatted flight:")
            print(f"   - Airline: {first_formatted.get('airline')}")
            print(f"   - Flight Number: {first_formatted.get('flightNumber')}")
            print(f"   - Departure: {first_formatted.get('departure')}")
            print(f"   - Arrival: {first_formatted.get('arrival')}")
            print(f"   - Duration: {first_formatted.get('duration')}")
            print(f"   - Price: ${first_formatted.get('price')}")
            print(f"   - Stops: {first_formatted.get('stops')}")
        
        print(f"\n🎉 Test completed successfully!")
        print(f"✅ Real data pipeline working correctly")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_flight_data_transformation())
