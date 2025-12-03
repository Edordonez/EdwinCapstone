import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/globals.css';
import '../../styles/site.css';
import { Header } from '../../itienary/components/Header';
import { ItinerarySummary } from '../../itienary/components/ItinerarySummary';
import { FlightsSection } from '../../itienary/components/FlightsSection';
import { HotelsSection } from '../../itienary/components/HotelsSection';
import { ActivitiesSection } from '../../itienary/components/ActivitiesSection';
import { CostSidebar } from '../../itienary/components/CostSidebar';
import { Button } from '../../itienary/components/ui/button';
import { Plus, Plane, Hotel, Calendar } from 'lucide-react';
import { transformFlightsToItinerary, transformHotelsToItinerary, transformActivitiesToItinerary, calculateCosts } from '../utils/itineraryTransform';
import { loadTripState } from '../utils/tripState';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export default function ItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [activities, setActivities] = useState([]);
  const [itineraryData, setItineraryData] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    tripLength: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddFlight, setShowAddFlight] = useState(false);
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  // Load initial data from location state or tripState
  useEffect(() => {
    const state = location.state || {};
    const tripState = loadTripState();
    
    // Get route information - handle both state.route and state.routeInfo
    const route = state.route || state.routeInfo || tripState.route || {};
    const departureDate = route.date || route.departure_display || route.departureDate;
    const returnDate = route.returnDate || route.return_display || route.returnDate;
    const destination = route.destination || route.destinationCode || 'Unknown';
    
    // Calculate trip length
    let tripLength = 0;
    if (departureDate && returnDate) {
      try {
        const start = new Date(departureDate);
        const end = new Date(returnDate);
        const diffTime = Math.abs(end - start);
        tripLength = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      } catch (e) {
        tripLength = 7; // Default
      }
    } else {
      tripLength = 7; // Default
    }
    
    setItineraryData({
      destination,
      startDate: departureDate ? new Date(departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      endDate: returnDate ? new Date(returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      tripLength,
    });
    
    // Transform and set flights if available
    const flightData = state.flights || state.dashboardData || {};
    const outboundFlights = state.outboundFlights || flightData.outboundFlights || [];
    const returnFlights = state.returnFlights || flightData.returnFlights || [];
    
    if (outboundFlights.length > 0 || returnFlights.length > 0) {
      const transformedOutbound = outboundFlights.length > 0 
        ? transformFlightsToItinerary(outboundFlights, route, true)
        : [];
      const transformedReturn = returnFlights.length > 0
        ? transformFlightsToItinerary(returnFlights, route, false)
        : [];
      setFlights([...transformedOutbound, ...transformedReturn]);
    }
    
    // Transform and set hotels if available
    const hotelData = state.hotels || state.dashboardData?.hotels || [];
    if (Array.isArray(hotelData) && hotelData.length > 0) {
      const transformed = transformHotelsToItinerary(hotelData, departureDate, returnDate);
      setHotels(transformed);
    }
    
    // Transform and set activities if available
    const activityData = state.activities || state.dashboardData?.activities || [];
    if (Array.isArray(activityData) && activityData.length > 0) {
      const transformed = transformActivitiesToItinerary(activityData, departureDate, returnDate);
      setActivities(transformed);
    }
  }, [location.state]);

  // Fetch hotels from API using chat endpoint
  const fetchHotels = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const tripState = loadTripState();
      const route = tripState.route || {};
      const destination = route.destination || route.destinationCode || '';
      const checkIn = route.date || new Date().toISOString().split('T')[0];
      const checkOut = route.returnDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (!destination) {
        throw new Error('Destination is required');
      }
      
      // Use chat API to search for hotels (it will call Amadeus internally)
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Find hotels in ${destination} from ${checkIn} to ${checkOut}`,
            },
          ],
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch hotels');
      }
      
      const data = await response.json();
      
      // Extract hotels from the response
      if (data.amadeus_data?.hotels && Array.isArray(data.amadeus_data.hotels) && data.amadeus_data.hotels.length > 0) {
        const transformed = transformHotelsToItinerary(data.amadeus_data.hotels, checkIn, checkOut);
        // Avoid duplicates
        const existingIds = new Set(hotels.map(h => h.id));
        const newHotels = transformed.filter(h => !existingIds.has(h.id));
        setHotels(prev => [...prev, ...newHotels]);
        setShowAddHotel(false);
      } else {
        throw new Error('No hotels found. Try asking in the chat: "Find hotels in [destination]"');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching hotels:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch activities from API
  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const tripState = loadTripState();
      const route = tripState.route || {};
      const destination = route.destination || route.destinationCode || '';
      
      if (!destination) {
        throw new Error('Destination is required');
      }
      
      // First, get location coordinates for the destination
      // For now, we'll use a chat API call to get activities
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Find activities and things to do in ${destination}`,
            },
          ],
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      
      const data = await response.json();
      
      // Extract activities from the response
      if (data.amadeus_data?.activities && Array.isArray(data.amadeus_data.activities)) {
        const activityData = data.amadeus_data.activities;
        const departureDate = route.date || new Date().toISOString().split('T')[0];
        const returnDate = route.returnDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const transformed = transformActivitiesToItinerary(activityData, departureDate, returnDate);
        setActivities(prev => {
          // Merge with existing activities, avoiding duplicates
          const existingIds = new Set(prev.flatMap(day => day.activities.map(a => a.id)));
          const newActivities = transformed.flatMap(day => day.activities.filter(a => !existingIds.has(a.id)));
          
          if (newActivities.length === 0) {
            return prev;
          }
          
          // Add new activities to existing days or create new days
          const daysMap = new Map(prev.map(day => [day.day, day]));
          transformed.forEach(day => {
            if (daysMap.has(day.day)) {
              daysMap.get(day.day).activities.push(...day.activities);
            } else {
              daysMap.set(day.day, day);
            }
          });
          
          return Array.from(daysMap.values()).sort((a, b) => a.day - b.day);
        });
        setShowAddActivity(false);
      } else {
        throw new Error('No activities found');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const costs = calculateCosts(flights, hotels, activities);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-primary">Your Optimized Itinerary</h1>
          <Button
            variant="outline"
            onClick={() => navigate('/chat')}
          >
            Back to Chat
          </Button>
        </div>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}
        
        <ItinerarySummary
          destination={itineraryData.destination}
          startDate={itineraryData.startDate}
          endDate={itineraryData.endDate}
          tripLength={itineraryData.tripLength}
        />

        <div className="mt-8 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Flights Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Plane className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-primary">Flights</h2>
                </div>
                {flights.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/chat', { state: { message: 'Find flights for my trip' } })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Flights
                  </Button>
                )}
              </div>
              {flights.length > 0 ? (
                <FlightsSection flights={flights} />
              ) : (
                <div className="p-8 text-center border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground">No flights added yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/chat', { state: { message: 'Find flights for my trip' } })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Search Flights
                  </Button>
                </div>
              )}
            </div>

            {/* Hotels Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Hotel className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-primary">Accommodations</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHotels}
                  disabled={loading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {loading ? 'Loading...' : 'Add from API'}
                </Button>
              </div>
              {hotels.length > 0 ? (
                <HotelsSection hotels={hotels} />
              ) : (
                <div className="p-8 text-center border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground">No hotels added yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={fetchHotels}
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {loading ? 'Loading...' : 'Find Hotels from API'}
                  </Button>
                </div>
              )}
            </div>

            {/* Activities Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-primary">Daily Activities</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchActivities}
                  disabled={loading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {loading ? 'Loading...' : 'Add from API'}
                </Button>
              </div>
              {activities.length > 0 ? (
                <ActivitiesSection days={activities} />
              ) : (
                <div className="p-8 text-center border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground">No activities added yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={fetchActivities}
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {loading ? 'Loading...' : 'Find Activities from API'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <CostSidebar costs={costs} />
          </div>
        </div>
      </main>
    </div>
  );
}

