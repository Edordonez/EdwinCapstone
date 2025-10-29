"""
Amadeus API Service for travel data integration
"""
import os
import httpx
import requests
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)


class AmadeusService:
    """
    Service class for Amadeus API integration
    Handles OAuth2 authentication and API calls
    """
    
    def __init__(self):
        self.api_key = os.getenv("AMADEUS_API_KEY")
        self.api_secret = os.getenv("AMADEUS_API_SECRET")
        
        # Default to production if not specified, but allow override
        self.base_url = os.getenv("AMADEUS_API_BASE", "https://api.amadeus.com")
        
        if not self.api_key or not self.api_secret:
            raise ValueError("AMADEUS_API_KEY and AMADEUS_API_SECRET must be set")
        
        logger.info(f"[AMADEUS] Initialized with base URL: {self.base_url}")
        
        self._access_token = None
        self._token_expires_at = None
        self._client = None  # Initialize lazily to avoid event loop issues
    
    def _get_access_token(self) -> str:
        """Get or refresh OAuth2 access token"""
        if self._access_token and self._token_expires_at and datetime.now() < self._token_expires_at:
            return self._access_token
        
        try:
            response = requests.post(
                f"{self.base_url}/v1/security/oauth2/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.api_key,
                    "client_secret": self.api_secret
                },
                timeout=30
            )
            response.raise_for_status()
            
            token_data = response.json()
            self._access_token = token_data["access_token"]
            # Set expiration 5 minutes before actual expiry for safety
            expires_in = token_data.get("expires_in", 1800) - 300
            self._token_expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            logger.info("Amadeus access token refreshed successfully")
            return self._access_token
            
        except Exception as e:
            logger.error(f"Failed to get Amadeus access token: {e}")
            raise Exception(f"Amadeus authentication failed: {e}")
    
    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make authenticated request to Amadeus API"""
        token = self._get_access_token()
        
        try:
            response = requests.get(
                f"{self.base_url}{endpoint}",
                headers={"Authorization": f"Bearer {token}"},
                params=params or {},
                timeout=30
            )
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            logger.error(f"Amadeus API error {e.response.status_code}: {e.response.text}")
            if e.response.status_code == 401:
                # Token might be expired, try to refresh
                self._access_token = None
                return self._make_request(endpoint, params)
            # include body to help diagnose
            raise Exception(f"Amadeus API error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            logger.error(f"Amadeus API request failed: {e}")
            raise Exception(f"Amadeus API request failed: {e}")
    
    def search_flights(self, origin: str, destination: str, departure_date: str, 
                           return_date: str = None, adults: int = 1, max_price: int = None) -> Dict[str, Any]:
        """Search for flight offers"""
        params = {
            "originLocationCode": origin,
            "destinationLocationCode": destination,
            "departureDate": departure_date,
            "adults": adults
        }
        
        if return_date:
            params["returnDate"] = return_date
        
        if max_price:
            params["maxPrice"] = max_price
        
        try:
            response = self._make_request("/v2/shopping/flight-offers", params)
            return self._format_flight_response(response)
        except Exception as e:
            logger.error(f"Flight search failed: {e}")
            return {"error": str(e), "flights": []}
    
    def get_flight_inspiration(self, origin: str, max_price: int = None, 
                                    departure_date: str = None) -> Dict[str, Any]:
        """Get flight inspiration destinations"""
        params = {"origin": origin}
        
        if max_price:
            params["maxPrice"] = max_price
        if departure_date:
            params["departureDate"] = departure_date
        
        try:
            response = self._make_request("/v1/shopping/flight-destinations", params)
            return self._format_inspiration_response(response)
        except Exception as e:
            logger.error(f"Flight inspiration failed: {e}")
            return {"error": str(e), "destinations": []}
    
    def search_hotels(self, city_code: str, check_in: str, check_out: str, 
                           adults: int = 1, radius: int = 50, price_range: str = None) -> Dict[str, Any]:
        """Search for hotel offers"""
        params = {
            "cityCode": city_code,
            "checkInDate": check_in,
            "checkOutDate": check_out,
            "adults": adults,
            "radius": radius
        }
        
        if price_range:
            params["priceRange"] = price_range
        
        try:
            response = self._make_request("/v2/shopping/hotel-offers", params)
            return self._format_hotel_response(response)
        except Exception as e:
            logger.error(f"Hotel search failed: {e}")
            return {"error": str(e), "hotels": []}
    
    def search_activities(self, latitude: float, longitude: float, radius: int = 20) -> Dict[str, Any]:
        """Search for activities near coordinates"""
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "radius": radius
        }
        
        try:
            response = self._make_request("/v1/shopping/activities", params)
            return self._format_activity_response(response)
        except Exception as e:
            logger.error(f"Activity search failed: {e}")
            return {"error": str(e), "activities": []}
    
    def get_airport_city_search(self, keyword: str) -> Dict[str, Any]:
        """Search for airports and cities"""
        params = {"keyword": keyword, "subType": "AIRPORT,CITY"}
        
        try:
            response = self._make_request("/v1/reference-data/locations", params)
            return self._format_location_response(response)
        except Exception as e:
            logger.error(f"Location search failed: {e}")
            return {"error": str(e), "locations": []}
    
    def get_cheapest_dates(self, origin: str, destination: str, 
                               departure_date_range: str) -> Dict[str, Any]:
        """Get cheapest flight dates"""
        params = {
            "origin": origin,
            "destination": destination,
            "departureDate": departure_date_range
        }
        
        try:
            response = self._make_request("/v1/shopping/flight-dates", params)
            return self._format_cheapest_dates_response(response)
        except Exception as e:
            logger.error(f"Cheapest dates search failed: {e}")
            return {"error": str(e), "dates": []}
    
    def _format_flight_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format flight search response"""
        logger.info(f"[AMADEUS] Raw API response received: {len(response.get('data', []))} offers")
        
        # Validate response structure
        if not response.get("data"):
            logger.warning("[AMADEUS] No 'data' field in response")
            return {"flights": [], "count": 0, "error": "No flight data in response"}
        
        # Log first offer structure for debugging
        if response.get("data"):
            first_offer = response["data"][0]
            logger.info(f"[AMADEUS] First offer structure: {json.dumps(first_offer, indent=2, default=str)}")
            
            # Validate required fields
            if not first_offer.get("price", {}).get("total"):
                logger.warning("[AMADEUS] Missing price information in first offer")
            if not first_offer.get("itineraries"):
                logger.warning("[AMADEUS] Missing itineraries in first offer")
        
        flights = []
        for i, offer in enumerate(response.get("data", [])):
            logger.info(f"[AMADEUS] Processing offer {i+1}: ID={offer.get('id')}, Price={offer.get('price', {}).get('total')}")
            
            flight_info = {
                "id": offer.get("id"),
                "price": offer.get("price", {}).get("total"),
                "currency": offer.get("price", {}).get("currency"),
                "itineraries": []
            }
            
            for j, itinerary in enumerate(offer.get("itineraries", [])):
                logger.info(f"[AMADEUS] Processing itinerary {j+1}: Duration={itinerary.get('duration')}, Segments={len(itinerary.get('segments', []))}")
                
                segments = []
                for k, segment in enumerate(itinerary.get("segments", [])):
                    # Extract flight number and carrier code correctly
                    carrier_code = segment.get("carrierCode", "")
                    flight_number = segment.get("number", "")
                    
                    segment_info = {
                        "departure": {
                            "airport": segment.get("departure", {}).get("iataCode"),
                            "time": segment.get("departure", {}).get("at")
                        },
                        "arrival": {
                            "airport": segment.get("arrival", {}).get("iataCode"),
                            "time": segment.get("arrival", {}).get("at")
                        },
                        "airline": carrier_code,
                        "flight_number": flight_number,
                        "duration": segment.get("duration")
                    }
                    
                    logger.info(f"[AMADEUS] Segment {k+1}: {segment_info['departure']['airport']} {segment_info['departure']['time']} -> {segment_info['arrival']['airport']} {segment_info['arrival']['time']} ({carrier_code} {flight_number})")
                    segments.append(segment_info)
                
                flight_info["itineraries"].append({
                    "duration": itinerary.get("duration"),
                    "segments": segments
                })
            
            flights.append(flight_info)
            logger.info(f"[AMADEUS] Formatted flight {i+1}: Price={flight_info['price']}, Itineraries={len(flight_info['itineraries'])}")
        
        result = {"flights": flights, "count": len(flights)}
        logger.info(f"[AMADEUS] Final formatted result: {len(flights)} flights")
        return result
    
    def _format_inspiration_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format flight inspiration response"""
        destinations = []
        for dest in response.get("data", []):
            destinations.append({
                "destination": dest.get("destination"),
                "price": dest.get("price", {}).get("total"),
                "currency": dest.get("price", {}).get("currency"),
                "departure_date": dest.get("departureDate"),
                "return_date": dest.get("returnDate")
            })
        
        return {"destinations": destinations, "count": len(destinations)}
    
    def _format_hotel_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format hotel search response"""
        hotels = []
        for offer in response.get("data", []):
            hotel_info = {
                "hotel_id": offer.get("hotel", {}).get("hotelId"),
                "name": offer.get("hotel", {}).get("name"),
                "rating": offer.get("hotel", {}).get("rating"),
                "price": offer.get("offers", [{}])[0].get("price", {}).get("total"),
                "currency": offer.get("offers", [{}])[0].get("price", {}).get("currency"),
                "check_in": offer.get("offers", [{}])[0].get("checkInDate"),
                "check_out": offer.get("offers", [{}])[0].get("checkOutDate")
            }
            hotels.append(hotel_info)
        
        return {"hotels": hotels, "count": len(hotels)}
    
    def _format_activity_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format activity search response"""
        activities = []
        for activity in response.get("data", []):
            activities.append({
                "id": activity.get("id"),
                "name": activity.get("name"),
                "description": activity.get("shortDescription"),
                "price": activity.get("price", {}).get("amount"),
                "currency": activity.get("price", {}).get("currencyCode"),
                "rating": activity.get("rating"),
                "pictures": [pic.get("url") for pic in activity.get("pictures", [])]
            })
        
        return {"activities": activities, "count": len(activities)}
    
    def _format_location_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format location search response"""
        locations = []
        for location in response.get("data", []):
            locations.append({
                "code": location.get("iataCode"),
                "name": location.get("name"),
                "type": location.get("subType"),
                "city": location.get("address", {}).get("cityName"),
                "country": location.get("address", {}).get("countryName")
            })
        
        return {"locations": locations, "count": len(locations)}
    
    def _format_cheapest_dates_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format cheapest dates response"""
        dates = []
        for date_info in response.get("data", []):
            dates.append({
                "date": date_info.get("date"),
                "price": date_info.get("price", {}).get("total"),
                "currency": date_info.get("price", {}).get("currency")
            })
        
        return {"dates": dates, "count": len(dates)}
    
    def close(self):
        """Close HTTP client"""
        if self._client:
            self._client.close()
