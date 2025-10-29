#!/usr/bin/env python3
"""
Test script to verify date parsing fixes
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.dirname(__file__))

from services.intent_detector import IntentDetector

async def test_date_parsing():
    """Test date parsing for various date formats"""
    
    print("🧪 Testing Date Parsing Fixes")
    print("=" * 50)
    
    # Load environment variables
    load_dotenv()
    
    try:
        # Initialize intent detector
        intent_detector = IntentDetector()
        print("✅ Intent detector initialized")
        
        # Test cases
        test_cases = [
            "flights from JFK to CDG December 10-17",
            "flights from JFK to CDG December 10 to December 17",
            "flights from JFK to CDG December 10, 2024 to December 17, 2024",
            "flights from JFK to CDG December 10, 2025 to December 17, 2025",
        ]
        
        # Create context similar to what main.py provides
        from datetime import datetime
        now = datetime.now()
        context = {
            'now_iso': now.isoformat(),
            'user_tz': 'America/New_York',
            'user_location': {
                'city': 'Washington',
                'country': 'United States'
            }
        }
        
        for i, message in enumerate(test_cases, 1):
            print(f"\n📝 Test {i}: {message}")
            
            intent = await intent_detector.analyze_message(message, context=context)
            
            print(f"   Intent: {intent['type']} (confidence: {intent['confidence']:.2f})")
            print(f"   Has required params: {intent['has_required_params']}")
            
            if intent['params']:
                departure_date = intent['params'].get('departure_date', 'N/A')
                return_date = intent['params'].get('return_date', 'N/A')
                
                print(f"   Departure date: {departure_date}")
                print(f"   Return date: {return_date}")
                
                # Check if dates are in the future
                try:
                    dep_dt = datetime.strptime(departure_date, "%Y-%m-%d")
                    ret_dt = datetime.strptime(return_date, "%Y-%m-%d") if return_date != 'N/A' else None
                    
                    now = datetime.now()
                    if dep_dt < now:
                        print(f"   ❌ Departure date is in the past!")
                    else:
                        print(f"   ✅ Departure date is in the future")
                    
                    if ret_dt and ret_dt < now:
                        print(f"   ❌ Return date is in the past!")
                    elif ret_dt:
                        print(f"   ✅ Return date is in the future")
                        
                except ValueError as e:
                    print(f"   ❌ Date parsing error: {e}")
        
        print(f"\n🎉 Date parsing test completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_date_parsing())
