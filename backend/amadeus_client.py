"""
Amadeus API Client for Smart Travel Assistant
Provides flight and hotel search functionality using Amadeus API
"""

import os
from amadeus import Client, ResponseError
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import pytz

class AmadeusClient:
    def __init__(self):
        api_key = os.getenv("AMADEUS_API_KEY")
        api_secret = os.getenv("AMADEUS_API_SECRET")
        
        if not api_key or not api_secret:
            raise RuntimeError("AMADEUS_API_KEY and AMADEUS_API_SECRET must be set in environment variables")
        
        # Initialize Amadeus client
        self.amadeus = Client(
            client_id=api_key,
            client_secret=api_secret,
            hostname='production'  # Use 'test' for testing environment, 'production' for live
        )
    
    def search_flights(self, origin: str, destination: str, departure_date: str, 
                      return_date: Optional[str] = None, adults: int = 1, 
                      children: int = 0, infants: int = 0) -> Dict:
        """
        Search for flights using Amadeus API
        
        Args:
            origin: IATA code for departure airport (e.g., 'NYC', 'LAX')
            destination: IATA code for arrival airport (e.g., 'LON', 'PAR')
            departure_date: Departure date in YYYY-MM-DD format
            return_date: Return date in YYYY-MM-DD format (optional for one-way)
            adults: Number of adult passengers
            children: Number of child passengers
            infants: Number of infant passengers
            
        Returns:
            Dict containing flight search results
        """
        try:
            # Build search parameters
            search_params = {
                'originLocationCode': origin,
                'destinationLocationCode': destination,
                'departureDate': departure_date,
                'adults': adults,
                'children': children,
                'infants': infants,
                'max': 10  # Limit results to 10 flights
            }
            
            if return_date:
                search_params['returnDate'] = return_date
            
            # Perform flight search
            response = self.amadeus.shopping.flight_offers_search.get(**search_params)
            
            return {
                'success': True,
                'data': response.data,
                'meta': response.meta,
                'dictionaries': response.dictionaries if hasattr(response, 'dictionaries') else {}
            }
            
        except ResponseError as error:
            return {
                'success': False,
                'error': str(error),
                'error_code': error.code if hasattr(error, 'code') else None
            }
    
    def search_hotels(self, city_code: str, check_in_date: str, check_out_date: str,
                     adults: int = 1, rooms: int = 1) -> Dict:
        """
        Search for hotels using Amadeus API
        
        Args:
            city_code: IATA city code (e.g., 'NYC', 'LON')
            check_in_date: Check-in date in YYYY-MM-DD format
            check_out_date: Check-out date in YYYY-MM-DD format
            adults: Number of adult guests
            rooms: Number of rooms
            
        Returns:
            Dict containing hotel search results
        """
        try:
            # First, search for hotels in the specified city
            hotel_list = self.amadeus.shopping.hotel_offers.get(
                cityCode=city_code,
                checkInDate=check_in_date,
                checkOutDate=check_out_date,
                adults=adults,
                roomQuantity=rooms
            )
            
            return {
                'success': True,
                'data': hotel_list.data,
                'meta': hotel_list.meta
            }
            
        except ResponseError as error:
            return {
                'success': False,
                'error': str(error),
                'error_code': error.code if hasattr(error, 'code') else None
            }
    
    def get_airport_code(self, city_name: str) -> Optional[str]:
        """
        Get IATA airport code for a city name
        
        Args:
            city_name: Name of the city (e.g., 'New York', 'London')
            
        Returns:
            IATA airport code or None if not found
        """
        try:
            response = self.amadeus.reference_data.locations.get(
                keyword=city_name,
                subType='AIRPORT,CITY'
            )
            
            if response.data and len(response.data) > 0:
                # Return the first airport code found
                for location in response.data:
                    if location.get('subType') == 'AIRPORT':
                        return location.get('iataCode')
            
            return None
            
        except ResponseError:
            return None
    
    def format_flight_results(self, flight_data: Dict) -> List[Dict]:
        """
        Format flight search results for easier consumption
        
        Args:
            flight_data: Raw flight data from Amadeus API
            
        Returns:
            List of formatted flight information
        """
        if not flight_data.get('success') or not flight_data.get('data'):
            return []
        
        formatted_flights = []
        
        for offer in flight_data['data']:
            flight_info = {
                'id': offer.get('id'),
                'price': offer.get('price', {}).get('total'),
                'currency': offer.get('price', {}).get('currency'),
                'itineraries': []
            }
            
            for itinerary in offer.get('itineraries', []):
                itinerary_info = {
                    'duration': itinerary.get('duration'),
                    'segments': []
                }
                
                for segment in itinerary.get('segments', []):
                    segment_info = {
                        'departure': {
                            'airport': segment.get('departure', {}).get('iataCode'),
                            'time': segment.get('departure', {}).get('at')
                        },
                        'arrival': {
                            'airport': segment.get('arrival', {}).get('iataCode'),
                            'time': segment.get('arrival', {}).get('at')
                        },
                        'airline': segment.get('carrierCode'),
                        'flight_number': segment.get('number'),
                        'aircraft': segment.get('aircraft', {}).get('code')
                    }
                    itinerary_info['segments'].append(segment_info)
                
                flight_info['itineraries'].append(itinerary_info)
            
            formatted_flights.append(flight_info)
        
        return formatted_flights
    
    def format_hotel_results(self, hotel_data: Dict) -> List[Dict]:
        """
        Format hotel search results for easier consumption
        
        Args:
            hotel_data: Raw hotel data from Amadeus API
            
        Returns:
            List of formatted hotel information
        """
        if not hotel_data.get('success') or not hotel_data.get('data'):
            return []
        
        formatted_hotels = []
        
        for hotel in hotel_data['data']:
            hotel_info = {
                'hotel_id': hotel.get('hotel', {}).get('hotelId'),
                'name': hotel.get('hotel', {}).get('name'),
                'rating': hotel.get('hotel', {}).get('rating'),
                'description': hotel.get('hotel', {}).get('description', {}).get('text'),
                'offers': []
            }
            
            for offer in hotel.get('offers', []):
                offer_info = {
                    'id': offer.get('id'),
                    'price': offer.get('price', {}).get('total'),
                    'currency': offer.get('price', {}).get('currency'),
                    'room_type': offer.get('room', {}).get('type'),
                    'room_description': offer.get('room', {}).get('description', {}).get('text')
                }
                hotel_info['offers'].append(offer_info)
            
            formatted_hotels.append(hotel_info)
        
        return formatted_hotels