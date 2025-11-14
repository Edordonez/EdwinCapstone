import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScrollArea } from '../components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Helper function to parse duration string to hours
const parseDuration = (durationStr) => {
  if (!durationStr) return 0;
  if (typeof durationStr === 'number') return durationStr;
  if (durationStr.startsWith('PT')) {
    const hoursMatch = durationStr.match(/(\d+)H/);
    const minutesMatch = durationStr.match(/(\d+)M/);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    return hours + minutes / 60;
  }
  const hoursMatch = durationStr.match(/(\d+)h/);
  const minutesMatch = durationStr.match(/(\d+)m/);
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  return hours + minutes / 60;
};

// Calculate convenience score: 100 – (0.4×normalized_duration + 0.3×normalized_stops + 0.3×normalized_price)
const calculateConvenienceScore = (flights, totalPrice, maxPrice) => {
  if (!flights || flights.length === 0) return 0;
  
  const totalDuration = flights.reduce((sum, f) => sum + parseDuration(f.duration || f._duration || '0h'), 0);
  const totalStops = flights.reduce((sum, f) => sum + (f.stops || 0), 0);
  
  // Normalize values to 0-1 range
  const maxDuration = 24; // Assume max 24 hours for normalization
  const maxStops = 4; // Assume max 4 stops
  const maxPriceValue = maxPrice > 0 ? maxPrice : 2000; // Fallback max price
  
  const normalizedDuration = Math.min(totalDuration / maxDuration, 1);
  const normalizedStops = Math.min(totalStops / maxStops, 1);
  const normalizedPrice = Math.min(totalPrice / maxPriceValue, 1);
  
  // Calculate score: 100 – (0.4×normalized_duration + 0.3×normalized_stops + 0.3×normalized_price)
  const score = 100 - (0.4 * normalizedDuration + 0.3 * normalizedStops + 0.3 * normalizedPrice) * 100;
  return Math.max(0, Math.min(100, Math.round(score))); // Clamp between 0-100
};

// Format date for display (accepts Date object or date string)
const formatDate = (dateInput) => {
  if (!dateInput) return '';
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateInput);
      return '';
    }
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch (e) {
    console.warn('Error formatting date:', dateInput, e);
    return '';
  }
};

// Parse date string to Date object (handles various formats including ISO YYYY-MM-DD)
const parseDate = (dateStr) => {
  if (!dateStr) {
    console.warn('parseDate: No date string provided');
    return null;
  }
  try {
    // If already a Date object, return it
    if (dateStr instanceof Date) {
      return dateStr;
    }
    
    if (typeof dateStr !== 'string') {
      console.warn('parseDate: dateStr is not a string:', typeof dateStr, dateStr);
      return null;
    }
    
    const cleaned = dateStr.trim();
    
    // 1. Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    if (cleaned.match(/^\d{4}-\d{2}-\d{2}/)) {
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        console.log('Parsed ISO date:', cleaned, '->', date.toISOString().split('T')[0]);
        return date;
      }
    }
    
    // 2. Try formats like "Nov 20, 2025" or "November 20, 2025"
    // Pattern: Month Day, Year
    const monthDayYearPattern = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i;
    const monthDayMatch = cleaned.match(monthDayYearPattern);
    if (monthDayMatch) {
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        // Check if year is reasonable (not 2001 or before 2020)
        if (year >= 2020) {
          console.log('Parsed month-day-year format:', cleaned, '->', date.toISOString().split('T')[0]);
          return date;
        } else {
          // Try to extract year from match and fix it
          const extractedYear = parseInt(monthDayMatch[3]);
          if (extractedYear >= 2020) {
            const fixedDate = new Date(cleaned);
            fixedDate.setFullYear(extractedYear);
            if (!isNaN(fixedDate.getTime())) {
              console.log('Fixed date year from', year, 'to', extractedYear);
              return fixedDate;
            }
          }
        }
      }
    }
    
    // 3. Try formats like "20 Nov 2025" or "20 November 2025"
    const dayMonthYearPattern = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i;
    const dayMonthMatch = cleaned.match(dayMonthYearPattern);
    if (dayMonthMatch) {
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        if (year >= 2020) {
          console.log('Parsed day-month-year format:', cleaned, '->', date.toISOString().split('T')[0]);
          return date;
        } else {
          // Try to extract year from match and fix it
          const extractedYear = parseInt(dayMonthMatch[3]);
          if (extractedYear >= 2020) {
            const fixedDate = new Date(cleaned);
            fixedDate.setFullYear(extractedYear);
            if (!isNaN(fixedDate.getTime())) {
              console.log('Fixed date year from', year, 'to', extractedYear);
              return fixedDate;
            }
          }
        }
      }
    }
    
    // 4. Try standard Date constructor (handles most formats)
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      // Check if the year is reasonable (not 2001 or before 2020)
      const year = date.getFullYear();
      if (year < 2020) {
        console.warn('parseDate: Date year seems wrong:', year, 'from:', cleaned);
        // If year is 2001 or earlier, try to extract year from the string and fix it
        const yearMatch = cleaned.match(/\b(20\d{2})\b/);
        if (yearMatch && parseInt(yearMatch[1]) >= 2020) {
          const correctYear = parseInt(yearMatch[1]);
          const fixedDate = new Date(cleaned);
          fixedDate.setFullYear(correctYear);
          if (!isNaN(fixedDate.getTime())) {
            console.log('Fixed date year from', year, 'to', correctYear);
            return fixedDate;
          }
        }
      } else {
        console.log('Parsed date (standard):', cleaned, '->', date.toISOString().split('T')[0]);
        return date;
      }
    }
    
    console.warn('parseDate: Could not parse date string:', dateStr);
    return null;
  } catch (e) {
    console.warn('parseDate: Error parsing date:', dateStr, e);
    return null;
  }
};

export default function OptimizedItinerary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [itineraryData, setItineraryData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set([1]));
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  
  // Get preferences from location state or localStorage, with defaults
  const getInitialPreferences = () => {
    // First try from location state
    if (location.state?.preferences?.preferences) {
      return location.state.preferences.preferences;
    }
    // Try localStorage
    try {
      const stored = localStorage.getItem('travelPreferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.preferences) {
          return parsed.preferences;
        }
      }
    } catch (e) {
      console.log('Could not load preferences from localStorage:', e);
    }
    // Default: equal weighting
    return { budget: 0.33, quality: 0.33, convenience: 0.34 };
  };
  
  const [preferences, setPreferences] = useState(getInitialPreferences());

  // Get route info from location state or default
  const routeInfo = location.state?.routeInfo || {
    departure: 'New York',
    destination: 'Tokyo',
    departureCode: 'JFK',
    destinationCode: 'NRT',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    returnDate: null
  };

  const flights = location.state?.flights || [];
  const outboundFlights = location.state?.outboundFlights || [];
  const returnFlights = location.state?.returnFlights || [];
  const allFlights = [...outboundFlights, ...returnFlights].length > 0 
    ? [...outboundFlights, ...returnFlights] 
    : flights;

  const generateItinerary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting itinerary generation with routeInfo:', routeInfo);
      console.log('Available flights:', allFlights);

      // Validate routeInfo
      if (!routeInfo.destination && !routeInfo.destinationCode) {
        throw new Error('Destination information is missing. Please go back and search for flights again.');
      }

      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const base = isLocalhost 
        ? 'http://localhost:8000'
        : (process.env.REACT_APP_API_BASE || 'http://localhost:8000');

      // Get dates from tripState first, fallback to routeInfo
      let tripState = null;
      try {
        const { loadTripState } = require('../utils/tripState');
        tripState = loadTripState();
      } catch (e) {
        console.warn('Could not load tripState for dates:', e);
      }
      
      const startDateStr = tripState?.startDate || routeInfo.date || routeInfo.departure_display;
      const endDateStr = tripState?.endDate || routeInfo.returnDate || routeInfo.return_display;
      
      const departureDate = parseDate(startDateStr);
      const returnDate = endDateStr ? parseDate(endDateStr) : null;
      
      // Validate dates
      if (!departureDate) {
        console.error('Invalid departure date:', startDateStr);
        throw new Error(`Invalid departure date: ${startDateStr}`);
      }
      
      console.log('Parsed dates:', {
        startDateStr,
        endDateStr,
        departureDate: departureDate.toISOString().split('T')[0],
        returnDate: returnDate ? returnDate.toISOString().split('T')[0] : null
      });
      
      const originCode = tripState?.originCode || routeInfo.departureCode;
      const destinationCode = tripState?.destinationCode || routeInfo.destinationCode;
      
      console.log('Using tripState for dates and route:', {
        originCode,
        destinationCode,
        startDate: startDateStr,
        endDate: endDateStr,
        hasTripState: !!tripState
      });
      
      // Calculate actual trip duration
      // For round trip: use returnDate
      // For one-way: only show departure day (1 day itinerary)
      let tripEndDate = returnDate;
      let isRoundTrip = !!returnDate;
      
      if (!tripEndDate) {
        // One-way trip: only show departure day
        tripEndDate = departureDate; // Same as departure date for one-way
        console.log('No return date provided, creating 1-day itinerary (departure only)');
      }
      
      // Calculate check-in and check-out dates for hotel search
      // For hotel search, use a reasonable check-out date even for one-way
      const checkInDate = departureDate.toISOString().split('T')[0];
      const checkOutDateForHotel = returnDate 
        ? returnDate.toISOString().split('T')[0]
        : new Date(departureDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 2 days for hotel search
      
      // Calculate actual trip duration in days for itinerary display
      const tripDurationDays = isRoundTrip 
        ? Math.ceil((tripEndDate - departureDate) / (1000 * 60 * 60 * 24))
        : 1; // One-way is always 1 day
      console.log(`Trip duration: ${tripDurationDays} days (${checkInDate} to ${tripEndDate.toISOString().split('T')[0]})`);

      // First, fetch hotels and activities
      console.log('Fetching itinerary data with:', {
        destinationCode: routeInfo.destinationCode,
        destinationName: routeInfo.destination,
        checkIn: checkInDate,
        checkOut: checkOutDateForHotel
      });

      const dataResponse = await fetch(`${base}/api/fetchItineraryData`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationCode: routeInfo.destinationCode || routeInfo.destination,
          destinationName: routeInfo.destination || routeInfo.destinationCode,
          checkIn: checkInDate,
          checkOut: checkOutDateForHotel,
          adults: 1
        })
      });

      if (!dataResponse.ok) {
        const errorText = await dataResponse.text();
        console.error('fetchItineraryData error:', errorText);
        throw new Error(`Failed to fetch hotels and activities: ${dataResponse.status} ${errorText}`);
      }

      const dataResult = await dataResponse.json();
      console.log('fetchItineraryData result:', dataResult);
      
      if (!dataResult.ok) {
        throw new Error(dataResult.error || 'Failed to fetch hotels and activities');
      }

      const hotelsData = dataResult.hotels || [];
      const activitiesData = dataResult.activities || [];
      
      console.log(`Fetched ${hotelsData.length} hotels and ${activitiesData.length} activities`);

      // Prepare flights data - use optimalFlight from tripState if available
      let flightsToUse = allFlights;
      let optimalOutboundFlight = null;
      let optimalReturnFlight = null;
      
      // Helper function to extract airport code from flight
      const getFlightOrigin = (flight) => {
        return flight.origin || 
               flight.departureAirport || 
               flight.departureCode ||
               (flight.departure?.match(/([A-Z]{3})/)?.[1]) ||
               null;
      };
      
      const getFlightDestination = (flight) => {
        return flight.destination || 
               flight.arrivalAirport || 
               flight.arrivalCode ||
               (flight.arrival?.match(/([A-Z]{3})/)?.[1]) ||
               null;
      };
      
      // Find optimal flights from all flights using origin/destination matching
      const allOptimalFlights = [...(outboundFlights || []), ...(returnFlights || []), ...(allFlights || [])]
        .filter(f => f.optimalFlight || f.isOptimal);
      
      for (const flight of allOptimalFlights) {
        const flightOrigin = getFlightOrigin(flight);
        const flightDestination = getFlightDestination(flight);
        
        console.log('Checking flight:', {
          flightNumber: flight.flightNumber,
          origin: flightOrigin,
          destination: flightDestination,
          matchesOutbound: flightOrigin === originCode && flightDestination === destinationCode,
          matchesReturn: flightOrigin === destinationCode && flightDestination === originCode
        });
        
        // Outbound: origin === originCode && destination === destinationCode
        if (flightOrigin === originCode && flightDestination === destinationCode) {
          if (!optimalOutboundFlight) {
            optimalOutboundFlight = flight;
            console.log('Found optimal outbound flight:', flight.flightNumber);
          }
        }
        // Return: origin === destinationCode && destination === originCode
        else if (flightOrigin === destinationCode && flightDestination === originCode) {
          if (!optimalReturnFlight) {
            optimalReturnFlight = flight;
            console.log('Found optimal return flight:', flight.flightNumber);
          }
        }
      }
      
      // Fallback: use outboundFlights/returnFlights arrays if available
      if (!optimalOutboundFlight && outboundFlights && outboundFlights.length > 0) {
        optimalOutboundFlight = outboundFlights.find(f => f.optimalFlight || f.isOptimal);
      }
      
      if (!optimalReturnFlight && returnFlights && returnFlights.length > 0) {
        optimalReturnFlight = returnFlights.find(f => f.optimalFlight || f.isOptimal);
      }
      
      // Final fallback: use tripState.optimalFlight
      if (tripState?.optimalFlight && (!optimalOutboundFlight || !optimalReturnFlight)) {
        const flightOrigin = getFlightOrigin(tripState.optimalFlight);
        const flightDestination = getFlightDestination(tripState.optimalFlight);
        
        if (flightOrigin === originCode && flightDestination === destinationCode && !optimalOutboundFlight) {
          optimalOutboundFlight = tripState.optimalFlight;
          console.log('Using tripState.optimalFlight as outbound');
        } else if (flightOrigin === destinationCode && flightDestination === originCode && !optimalReturnFlight) {
          optimalReturnFlight = tripState.optimalFlight;
          console.log('Using tripState.optimalFlight as return');
        }
      }
      
      console.log('Final flight selection:', {
        outbound: optimalOutboundFlight?.flightNumber || 'N/A',
        return: optimalReturnFlight?.flightNumber || 'N/A'
      });
      
      const flightsData = flightsToUse.length > 0 ? flightsToUse.map(flight => ({
        id: flight.id || flight.flightNumber || `flight-${Math.random()}`,
        price: flight.price || 0,
        duration: flight.duration || '0h',
        airline: flight.airline || 'Unknown',
        flightNumber: flight.flightNumber || '',
        departure: flight.departure || '',
        arrival: flight.arrival || '',
        stops: flight.stops || 0
      })) : [];

      // If no flights provided, create a dummy flight from routeInfo
      if (flightsData.length === 0 && routeInfo.departure && routeInfo.destination) {
        console.warn('No flights provided, creating dummy flight from routeInfo');
        flightsData.push({
          id: 'dummy-flight',
          price: 500,
          duration: '5h',
          airline: 'Airline',
          flightNumber: 'FL123',
          departure: routeInfo.departureCode || routeInfo.departure,
          arrival: routeInfo.destinationCode || routeInfo.destination,
          stops: 0
        });
      }
      
      // Validate that we have at least some data
      if (flightsData.length === 0) {
        throw new Error('No flight data available. Please go back and search for flights first.');
      }
      
      if (hotelsData.length === 0 && activitiesData.length === 0) {
        console.warn('No hotels or activities found. Continuing with flights only.');
      }

      // Format preferences for backend - backend expects {budget, quality, convenience} as floats
      const formattedPreferences = {
        budget: typeof preferences.budget === 'number' ? preferences.budget : parseFloat(preferences.budget) || 0.33,
        quality: typeof preferences.quality === 'number' ? preferences.quality : parseFloat(preferences.quality) || 0.33,
        convenience: typeof preferences.convenience === 'number' ? preferences.convenience : parseFloat(preferences.convenience) || 0.34
      };

      // Generate optimal itinerary with user preferences
      console.log('Generating optimal itinerary with:', {
        flightsCount: flightsData.length,
        hotelsCount: hotelsData.length,
        activitiesCount: activitiesData.length,
        preferences: formattedPreferences
      });

      const itineraryResponse = await fetch(`${base}/api/generateOptimalItinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flights: flightsData,
          hotels: hotelsData,
          activities: activitiesData,
          preferences: formattedPreferences,
          userBudget: 5000 // Default budget
        })
      });

      if (!itineraryResponse.ok) {
        const errorText = await itineraryResponse.text();
        console.error('generateOptimalItinerary error:', errorText);
        throw new Error(`Failed to generate itinerary: ${itineraryResponse.status} ${errorText}`);
      }

      const result = await itineraryResponse.json();
      console.log('generateOptimalItinerary result:', result);
      
      if (!result.ok) {
        const errorMsg = result.error || 'Failed to generate itinerary';
        // Provide more helpful error messages
        if (errorMsg.includes('No valid combination found within budget')) {
          throw new Error('Unable to find a combination within the budget. Try adjusting your preferences or increasing your budget.');
        } else if (errorMsg.includes('No hotels') || errorMsg.includes('No activities')) {
          throw new Error('Unable to find hotels or activities for this destination. The itinerary will show flights only.');
        } else {
          throw new Error(errorMsg);
        }
      }

      // Create day-by-day itinerary structure
      // Use optimal flights if available, otherwise use result.flight
      const outboundFlight = optimalOutboundFlight || result.flight;
      const returnFlight = optimalReturnFlight || result.flight;
      
      console.log('Using flights for itinerary:', {
        outbound: outboundFlight?.flightNumber || 'N/A',
        return: returnFlight?.flightNumber || 'N/A',
        hasOptimalOutbound: !!optimalOutboundFlight,
        hasOptimalReturn: !!optimalReturnFlight,
        startDate: departureDate.toISOString().split('T')[0],
        endDate: tripEndDate.toISOString().split('T')[0]
      });
      
      const days = createDayByDayItinerary(
        outboundFlight, // Use optimal outbound flight if available
        result.hotel,
        result.activity ? [result.activity] : [],
        activitiesData,
        routeInfo,
        departureDate, // startDate
        tripEndDate, // endDate
        returnFlight // Use optimal return flight if available
      );

      setItineraryData({
        ...result,
        days: days,
        routeInfo: routeInfo,
        hotelsData: hotelsData,
        activitiesData: activitiesData
      });
    } catch (err) {
      console.error('Error generating itinerary:', err);
      setError(err.message || 'Failed to generate itinerary. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [preferences, allFlights, routeInfo]);

  useEffect(() => {
    generateItinerary();
  }, [generateItinerary]);

  const createDayByDayItinerary = (flight, hotel, selectedActivity, allActivities, routeInfo, startDate, endDate, returnFlight = null) => {
    const days = [];
    
    // Parse dates - ensure they are Date objects
    let endDateObj = null;
    let startDateObj = null;
    
    if (startDate instanceof Date) {
      startDateObj = startDate;
    } else if (startDate) {
      startDateObj = parseDate(startDate);
    }
    
    if (endDate instanceof Date) {
      endDateObj = endDate;
    } else if (endDate) {
      endDateObj = parseDate(endDate);
    }
    
    // Validate dates
    if (!startDateObj || isNaN(startDateObj.getTime())) {
      console.error('Invalid startDate:', startDate);
      throw new Error(`Invalid start date: ${startDate}`);
    }
    
    // For one-way trips, endDate might be null or same as startDate
    if (!endDateObj || isNaN(endDateObj.getTime())) {
      endDateObj = startDateObj; // Use startDate as endDate for one-way trips
    }
    
    console.log('createDayByDayItinerary dates:', {
      startDate: startDateObj.toISOString().split('T')[0],
      endDate: endDateObj.toISOString().split('T')[0],
      startDateType: typeof startDate,
      endDateType: typeof endDate
    });
    
    // Check if this is a round trip (endDate is different from startDate)
    const isRoundTrip = endDateObj && endDateObj.getTime() !== startDateObj.getTime();
    
    // Calculate actual trip duration in days
    // For one-way: always 1 day (departure only)
    // For round trip: actual days between start and end
    const daysDiff = isRoundTrip 
      ? Math.max(1, Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)))
      : 1; // One-way is always 1 day
    
    console.log(`Creating itinerary for ${daysDiff} days (${startDateObj.toISOString().split('T')[0]} to ${endDateObj.toISOString().split('T')[0]})`);
    
    // Day 1: Outbound flight + arrival
    const day1Items = [
      {
        type: 'flight',
        title: `${flight?.airline || 'Flight'} ${flight?.flightNumber || ''}`,
        time: flight?.departure || 'TBD',
        details: {
          departure: flight?.departure || routeInfo.departureCode,
          arrival: flight?.arrival || routeInfo.destinationCode,
          duration: flight?.duration ? (typeof flight.duration === 'number' ? `${flight.duration.toFixed(1)}h` : flight.duration) : 'N/A',
          stops: flight?.stops || 0,
          price: flight?.price || 0,
          airline: flight?.airline,
          flightNumber: flight?.flightNumber
        }
      }
    ];
    
    // Add hotel check-in only for round trips or if hotel is available
    if (hotel && !hotel.isDummy) {
      day1Items.push({
        type: 'hotel',
        title: hotel?.name || 'Hotel',
        time: 'Check-in',
        details: {
          location: hotel?.location || routeInfo.destination,
          distance: hotel?.distance || 0,
          rating: hotel?.rating || 0,
          price: hotel?.price || 0,
          name: hotel?.name
        }
      });
    }
    
    // Day 1 (startDate): Outbound flight
    days.push({
      day: null, // Will be set after sorting
      date: formatDate(startDateObj),
      dateObj: startDateObj,
      items: day1Items
    });

    // Middle days: Only for round trips with more than 1 day
    // Limit to maximum 5 middle days to avoid too many days
    if (isRoundTrip && daysDiff > 1) {
      const maxMiddleDays = Math.min(daysDiff - 1, 5); // Maximum 5 middle days
      
      for (let i = 1; i <= maxMiddleDays; i++) {
        const currentDate = new Date(startDateObj.getTime() + i * 24 * 60 * 60 * 1000);
        
        // Skip if this date is the return date (will be handled separately)
        if (currentDate.toISOString().split('T')[0] === endDateObj.toISOString().split('T')[0]) {
          continue;
        }
        
        // Distribute activities across days (max 2 per day)
        const activitiesPerDay = Math.ceil(allActivities.length / maxMiddleDays);
        const startIdx = (i - 1) * activitiesPerDay;
        const endIdx = startIdx + activitiesPerDay;
        const dayActivities = allActivities.slice(startIdx, endIdx);
      
        const dayItems = [];
      
        if (dayActivities.length > 0) {
          dayActivities.forEach((activity, idx) => {
            dayItems.push({
              type: 'activity',
              title: activity.name || 'Activity',
              time: idx === 0 ? 'Morning' : 'Afternoon',
              details: {
                description: activity.description || activity.shortDescription || '',
                duration: activity.minimumDuration || activity.duration || 'N/A',
                rating: activity.rating || 0,
                price: activity.price?.amount || activity.price || 0,
                location: activity.geoCode ? `${activity.geoCode.latitude}, ${activity.geoCode.longitude}` : ''
              }
            });
          });
        }
      
        // Add hotel stay only if hotel is available
        if (hotel && !hotel.isDummy) {
          dayItems.push({
            type: 'hotel',
            title: hotel?.name || 'Hotel',
            time: 'Overnight',
            details: {
              location: hotel?.location || routeInfo.destination,
              distance: hotel?.distance || 0,
              rating: hotel?.rating || 0,
              price: hotel?.price || 0,
              name: hotel?.name
            }
          });
        }
      
        days.push({
          day: null, // Will be set after sorting
          date: formatDate(currentDate),
          dateObj: currentDate,
          items: dayItems
        });
      }
    }

    // Last day (endDate): Return flight (only for round trips)
    if (isRoundTrip && endDateObj && endDateObj > startDateObj) {
      // Use actual return flight data if available
      const returnFlightData = returnFlight || {};
      
      // Extract time from departure string (e.g., "27 Nov 2025, 10:30" -> "10:30")
      let departureTime = 'TBD';
      if (returnFlightData.departure) {
        const timeMatch = returnFlightData.departure.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) {
          departureTime = timeMatch[1];
        } else {
          departureTime = returnFlightData.departure;
        }
      } else if (returnFlightData.departureTime) {
        departureTime = returnFlightData.departureTime;
      }
      
      // Extract airport codes - return flight departs from destination, arrives at origin
      const departureAirport = returnFlightData.departureAirport || 
                               (returnFlightData.departure?.match(/([A-Z]{3})/) ? returnFlightData.departure.match(/([A-Z]{3})/)[1] : null) ||
                               routeInfo.destinationCode;
      const arrivalAirport = returnFlightData.arrivalAirport || 
                             (returnFlightData.arrival?.match(/([A-Z]{3})/) ? returnFlightData.arrival.match(/([A-Z]{3})/)[1] : null) ||
                             routeInfo.departureCode;
      
      days.push({
        day: null, // Will be set after sorting
        date: formatDate(endDateObj),
        dateObj: endDateObj,
        items: [
          {
            type: 'flight',
            title: `${returnFlightData.airline || 'Return'} ${returnFlightData.flightNumber || 'Flight'}`,
            time: departureTime,
            details: {
              departure: returnFlightData.departure || `${departureAirport} ${departureTime}`,
              arrival: returnFlightData.arrival || `${arrivalAirport} TBD`,
              duration: returnFlightData.duration ? (typeof returnFlightData.duration === 'number' ? `${returnFlightData.duration.toFixed(1)}h` : returnFlightData.duration) : 'TBD',
              stops: returnFlightData.stops || 0,
              price: returnFlightData.price || 0,
              airline: returnFlightData.airline,
              flightNumber: returnFlightData.flightNumber
            }
          }
        ]
      });
    }

    // Sort days by date (ascending)
    days.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    
    // Assign day numbers (Day 1, Day 2, etc.)
    days.forEach((day, index) => {
      day.day = index + 1;
    });

    console.log(`Created ${days.length} days for itinerary (sorted and labeled)`);
    return days;
  };

  const toggleDay = (day) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  const toggleItem = (day, itemIndex) => {
    const key = `${day}-${itemIndex}`;
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(to bottom, #EAF9FF 0%, #ffffff 100%)'
      }}>
        <div style={{ fontSize: '48px' }}>✈️</div>
        <div style={{ fontSize: '20px', color: '#004C8C', fontWeight: 600 }}>Generating your optimized itinerary...</div>
        <div style={{ fontSize: '14px', color: '#64748b' }}>This may take a moment</div>
      </div>
    );
  }

  if (error) {
    return (
      <ScrollArea className="h-full">
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            padding: '24px', 
            backgroundColor: '#fee2e2', 
            borderRadius: '12px', 
            border: '1px solid #fca5a5',
            marginBottom: '24px'
          }}>
            <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>Error</h2>
            <p style={{ color: '#991b1b' }}>{error}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#00ADEF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            Back to Search Results
          </button>
        </div>
      </ScrollArea>
    );
  }

  if (!itineraryData) {
    return null;
  }

  const { flight, hotel, activity, days, total_price } = itineraryData;
  const totalDuration = parseDuration(flight?.duration || '0h');
  const totalStops = flight?.stops || 0;
  const maxPrice = Math.max(...allFlights.map(f => f.price || 0), total_price || 0, 2000);
  const convenienceScore = calculateConvenienceScore(
    [flight],
    total_price || 0,
    maxPrice
  );

  // Calculate total costs
  const flightCost = flight?.price || 0;
  const hotelCost = hotel?.price || 0;
  const activityCost = activity?.price?.amount || activity?.price || 0;
  const totalCost = total_price || (flightCost + hotelCost + activityCost);

  // Prepare chart data for summary
  const summaryChartData = [
    { name: 'Cost', value: totalCost, max: maxPrice },
    { name: 'Duration', value: totalDuration, max: 24 },
    { name: 'Stops', value: totalStops, max: 4 },
    { name: 'Convenience', value: convenienceScore, max: 100 }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #EAF9FF 0%, #ffffff 100%)' }}>
      <ScrollArea className="h-full">
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '32px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <h1 style={{ 
                fontSize: '36px', 
                fontWeight: 700, 
                color: '#004C8C',
                marginBottom: '8px'
              }}>
                Optimized Itinerary
              </h1>
              <p style={{ color: '#64748b', fontSize: '18px' }}>
                {(() => {
                  // Use tripState originCode/destinationCode if available, fallback to routeInfo
                  let tripState = null;
                  try {
                    const { loadTripState } = require('../utils/tripState');
                    tripState = loadTripState();
                  } catch (e) {
                    // Ignore
                  }
                  
                  const originCode = tripState?.originCode || routeInfo.departureCode || routeInfo.departure;
                  const destinationCode = tripState?.destinationCode || routeInfo.destinationCode || routeInfo.destination;
                  const startDate = tripState?.startDate || routeInfo.date || routeInfo.departure_display;
                  const endDate = tripState?.endDate || routeInfo.returnDate || routeInfo.return_display;
                  
                  const dateRange = endDate ? `${startDate} - ${endDate}` : startDate;
                  return `${originCode} → ${destinationCode} • ${dateRange}`;
                })()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowPreferencesModal(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#004C8C',
                  border: '2px solid #004C8C',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f0f9ff';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'white';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Preferences
              </button>
              <button
                onClick={() => navigate(-1)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#00ADEF',
                  border: '2px solid #00ADEF',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#E6F7FF';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'white';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Back to Results
              </button>
              <button
                onClick={generateItinerary}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#00ADEF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0, 173, 239, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#006AAF';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0, 173, 239, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#00ADEF';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0, 173, 239, 0.3)';
                }}
              >
                Re-optimize
              </button>
            </div>
          </div>

          {/* Preferences Display */}
          <div style={{
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid #bae6fd'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>Optimization Weights</div>
                <div style={{ display: 'flex', gap: '32px', fontSize: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ color: '#004C8C', fontWeight: 500 }}>Budget: </span>
                    <span style={{ color: '#00ADEF', fontWeight: 700 }}>{(preferences.budget * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span style={{ color: '#004C8C', fontWeight: 500 }}>Quality: </span>
                    <span style={{ color: '#00ADEF', fontWeight: 700 }}>{(preferences.quality * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span style={{ color: '#004C8C', fontWeight: 500 }}>Convenience: </span>
                    <span style={{ color: '#00ADEF', fontWeight: 700 }}>{(preferences.convenience * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPreferencesModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#00ADEF',
                  border: '1px solid #00ADEF',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Edit
              </button>
            </div>
          </div>

          {/* Summary Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <h2 style={{ 
                fontSize: '28px', 
                fontWeight: 700, 
                color: '#004C8C',
                margin: 0
              }}>
                Trip Summary
              </h2>
              {itineraryData?.total_score && (
                <div style={{
                  padding: '12px 20px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '12px',
                  border: '2px solid #bae6fd'
                }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Optimization Score</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#00ADEF' }}>
                    {Math.round(itineraryData.total_score * 100)}%
                  </div>
                </div>
              )}
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>Total Cost</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#00ADEF' }}>
                  ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Flights: ${flightCost.toFixed(2)} • Hotels: ${hotelCost.toFixed(2)} • Activities: ${activityCost.toFixed(2)}
                </div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>Total Travel Time</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#00ADEF' }}>
                  {totalDuration.toFixed(1)}h
                </div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>Number of Stops</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#00ADEF' }}>
                  {totalStops}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {totalStops === 0 ? 'Non-stop flight' : `${totalStops} stop${totalStops > 1 ? 's' : ''}`}
                </div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>Convenience Score</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#00ADEF' }}>
                  {convenienceScore}/100
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Based on duration, stops, and price
                </div>
              </div>
            </div>

            {/* Summary Chart */}
            <div style={{ height: '250px', marginTop: '24px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '8px',
                      padding: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="#00ADEF" radius={[8, 8, 0, 0]}>
                    {summaryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#00ADEF" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Day-by-Day Timeline */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: 700, 
              color: '#004C8C',
              marginBottom: '24px'
            }}>
              Itinerary Timeline
            </h2>
            {days.map((day, dayIndex) => (
              <DaySection
                key={day.day}
                day={day}
                isExpanded={expandedDays.has(day.day)}
                expandedItems={expandedItems}
                onToggleDay={() => toggleDay(day.day)}
                onToggleItem={(itemIndex) => toggleItem(day.day, itemIndex)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Preferences Modal */}
      {showPreferencesModal && (
        <PreferencesModal
          preferences={preferences}
          onSave={(newPreferences) => {
            setPreferences(newPreferences);
            setShowPreferencesModal(false);
            // Save to localStorage
            try {
              localStorage.setItem('travelPreferences', JSON.stringify({ preferences: newPreferences }));
            } catch (e) {
              console.log('Could not save preferences to localStorage:', e);
            }
            // Regenerate itinerary with new preferences - will be triggered by useEffect when preferences updates
          }}
          onClose={() => setShowPreferencesModal(false)}
        />
      )}
    </div>
  );
}

// Preferences Modal Component
function PreferencesModal({ preferences, onSave, onClose }) {
  const [budget, setBudget] = useState(Math.round(preferences.budget * 5));
  const [quality, setQuality] = useState(Math.round(preferences.quality * 5));
  const [convenience, setConvenience] = useState(Math.round(preferences.convenience * 5));

  const normalizeWeights = (budgetVal, qualityVal, convenienceVal) => {
    const total = budgetVal + qualityVal + convenienceVal;
    if (total === 0) return { budget: 0.33, quality: 0.33, convenience: 0.34 };
    return {
      budget: budgetVal / total,
      quality: qualityVal / total,
      convenience: convenienceVal / total
    };
  };

  const handleSave = () => {
    const weights = normalizeWeights(budget, quality, convenience);
    onSave(weights);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '28px',
            cursor: 'pointer',
            color: '#666',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ×
        </button>

        <h2 style={{ 
          fontSize: '28px', 
          fontWeight: 700, 
          color: '#004C8C',
          marginBottom: '8px',
          marginTop: 0
        }}>
          Trip Preferences
        </h2>
        <p style={{ 
          fontSize: '14px', 
          color: '#64748b', 
          marginBottom: '32px'
        }}>
          Adjust the importance of each factor (1 = least important, 5 = most important)
        </p>

        {/* Budget Slider */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <label style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#004C8C'
            }}>
              Budget
            </label>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: '#00ADEF',
              minWidth: '40px',
              textAlign: 'right'
            }}>
              {budget}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={budget}
            onChange={(e) => setBudget(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '10px',
              borderRadius: '5px',
              background: `linear-gradient(to right, #00ADEF 0%, #00ADEF ${((budget - 1) / 4) * 100}%, #EAF9FF ${((budget - 1) / 4) * 100}%, #EAF9FF 100%)`,
              outline: 'none',
              WebkitAppearance: 'none',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Quality Slider */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <label style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#004C8C'
            }}>
              Quality
            </label>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: '#00ADEF',
              minWidth: '40px',
              textAlign: 'right'
            }}>
              {quality}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '10px',
              borderRadius: '5px',
              background: `linear-gradient(to right, #00ADEF 0%, #00ADEF ${((quality - 1) / 4) * 100}%, #EAF9FF ${((quality - 1) / 4) * 100}%, #EAF9FF 100%)`,
              outline: 'none',
              WebkitAppearance: 'none',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Convenience Slider */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <label style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#004C8C'
            }}>
              Convenience
            </label>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: '#00ADEF',
              minWidth: '40px',
              textAlign: 'right'
            }}>
              {convenience}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={convenience}
            onChange={(e) => setConvenience(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '10px',
              borderRadius: '5px',
              background: `linear-gradient(to right, #00ADEF 0%, #00ADEF ${((convenience - 1) / 4) * 100}%, #EAF9FF ${((convenience - 1) / 4) * 100}%, #EAF9FF 100%)`,
              outline: 'none',
              WebkitAppearance: 'none',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Weight Display */}
        <div style={{ 
          marginBottom: '32px',
          padding: '20px',
          background: '#EAF9FF',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px', fontWeight: 500 }}>
            Normalized Weights:
          </div>
          <div style={{ display: 'flex', gap: '32px', fontSize: '18px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: '#004C8C', fontWeight: 600 }}>Budget: </span>
              <span style={{ color: '#00ADEF', fontWeight: 700 }}>
                {(normalizeWeights(budget, quality, convenience).budget * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span style={{ color: '#004C8C', fontWeight: 600 }}>Quality: </span>
              <span style={{ color: '#00ADEF', fontWeight: 700 }}>
                {(normalizeWeights(budget, quality, convenience).quality * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span style={{ color: '#004C8C', fontWeight: 600 }}>Convenience: </span>
              <span style={{ color: '#00ADEF', fontWeight: 700 }}>
                {(normalizeWeights(budget, quality, convenience).convenience * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '12px 24px',
              backgroundColor: '#00ADEF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            Apply & Re-optimize
          </button>
        </div>
      </div>
    </div>
  );
}

// Day Section Component
function DaySection({ day, isExpanded, expandedItems, onToggleDay, onToggleItem }) {
  const getIcon = (type) => {
    switch (type) {
      case 'flight': return '✈️';
      case 'hotel': return '🏨';
      case 'activity': return '🎫';
      default: return '📍';
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'flight': return '#00ADEF';
      case 'hotel': return '#8b5cf6';
      case 'activity': return '#10b981';
      default: return '#64748b';
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      marginBottom: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      transition: 'all 0.3s ease'
    }}>
      {/* Day Header */}
      <button
        onClick={onToggleDay}
        style={{
          width: '100%',
          padding: '24px',
          backgroundColor: isExpanded ? '#f0f9ff' : 'white',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background-color 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#00ADEF',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0, 173, 239, 0.3)'
          }}>
            {day.day}
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#004C8C', marginBottom: '4px' }}>
              Day {day.day}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              {day.date}
            </div>
          </div>
          <div style={{
            fontSize: '14px',
            color: '#64748b',
            padding: '4px 12px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px'
          }}>
            {day.items.length} item{day.items.length > 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ fontSize: '24px', color: '#64748b' }}>
          {isExpanded ? '▼' : '▶'}
        </div>
      </button>

      {/* Day Items */}
      {isExpanded && (
        <div style={{ padding: '24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#fafbfc' }}>
          {day.items.map((item, itemIndex) => (
            <ItemCard
              key={itemIndex}
              item={item}
              icon={getIcon(item.type)}
              color={getColor(item.type)}
              isExpanded={expandedItems.has(`${day.day}-${itemIndex}`)}
              onToggle={() => onToggleItem(itemIndex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Item Card Component
function ItemCard({ item, icon, color, isExpanded, onToggle }) {
  return (
    <div style={{
      marginBottom: '16px',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: 'white',
      transition: 'all 0.2s'
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '20px',
          backgroundColor: isExpanded ? '#f0f9ff' : 'white',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background-color 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            fontSize: '32px',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${color}20`,
            borderRadius: '12px'
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#004C8C', marginBottom: '4px' }}>
              {item.title}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              {item.time}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '18px', color: '#64748b' }}>
          {isExpanded ? '▼' : '▶'}
        </div>
      </button>

      {isExpanded && (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8fafc',
          borderTop: `3px solid ${color}`
        }}>
          {item.type === 'flight' && (
            <FlightDetails details={item.details} />
          )}
          {item.type === 'hotel' && (
            <HotelDetails details={item.details} />
          )}
          {item.type === 'activity' && (
            <ActivityDetails details={item.details} />
          )}
        </div>
      )}
    </div>
  );
}

function FlightDetails({ details }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Departure</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>{details.departure}</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Arrival</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>{details.arrival}</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Duration</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>{details.duration}</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Stops</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>
          {details.stops === 0 ? 'Non-stop' : `${details.stops} stop${details.stops > 1 ? 's' : ''}`}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Airline</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>{details.airline || 'N/A'}</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Price</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#00ADEF' }}>
          ${details.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}

function HotelDetails({ details }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Location</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>{details.location}</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Distance from Center</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>{details.distance} km</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Rating</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>
          ⭐ {details.rating.toFixed(1)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Price per Night</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#00ADEF' }}>
          ${details.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}

function ActivityDetails({ details }) {
  return (
    <div>
      {details.description && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Description</div>
          <div style={{ fontSize: '14px', color: '#004C8C', lineHeight: '1.6' }}>{details.description}</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Duration</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>{details.duration}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Rating</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C' }}>
            ⭐ {details.rating.toFixed(1)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 500 }}>Price</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#00ADEF' }}>
            ${details.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
