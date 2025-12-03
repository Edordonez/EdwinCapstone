/**
 * Utility functions to transform Amadeus API data to itinerary format
 */

/**
 * Transform Amadeus flight data to itinerary flight format
 */
export const transformFlightsToItinerary = (amadeusFlights, route, isOutbound = null) => {
  if (!amadeusFlights || !Array.isArray(amadeusFlights)) {
    return [];
  }

  const flights = [];
  
  // Helper functions
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    // If already formatted (e.g., "08:00 AM"), return as-is
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}\s*(AM|PM)/i.test(timeStr)) {
      return timeStr;
    }
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
    }
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };
  
  const extractAirportCode = (str) => {
    if (!str) return '';
    // If it's already a 3-letter code
    if (/^[A-Z]{3}$/.test(str)) return str;
    // Try to extract from strings like "JFK" or "New York (JFK)"
    const match = str.match(/\b([A-Z]{3})\b/);
    return match ? match[1] : str;
  };
  
  amadeusFlights.forEach((flight, index) => {
    // Determine if this is outbound or return
    let type = 'departure';
    if (isOutbound !== null) {
      type = isOutbound ? 'departure' : 'return';
    } else if (flight.type) {
      type = flight.type;
    } else if (flight.return !== undefined) {
      type = flight.return ? 'return' : 'departure';
    } else if (index >= amadeusFlights.length / 2) {
      type = 'return';
    }
    
    // Extract flight details - handle both dashboard format and Amadeus API format
    const airline = flight.airline || flight.carrier || 'Unknown';
    const flightNumber = flight.flightNumber || flight.number || `${flight.carrierCode || ''} ${flight.number || ''}`.trim();
    
    // Handle simple dashboard format (departure/arrival are strings like "08:00 AM")
    if (typeof flight.departure === 'string' && typeof flight.arrival === 'string') {
      const departureAirport = extractAirportCode(flight.departureAirport || route?.departureCode || '');
      const arrivalAirport = extractAirportCode(flight.arrivalAirport || route?.destinationCode || '');
      
      flights.push({
        id: flight.id || `flight-${index}`,
        type,
        airline,
        flightNumber,
        departure: {
          airport: departureAirport,
          time: formatTime(flight.departure),
          date: formatDate(route?.date || route?.departure_display || ''),
        },
        arrival: {
          airport: arrivalAirport,
          time: formatTime(flight.arrival),
          date: formatDate(route?.returnDate || route?.return_display || route?.date || ''),
        },
        duration: flight.duration || 'N/A',
        price: parseFloat(flight.price) || 0,
        class: flight.class || 'Economy',
        stops: flight.stops || 0,
        segments: flight.segments || [],
      });
      return;
    }
    
    // Handle Amadeus API format (with segments)
    const departureSegment = flight.segments?.[0] || flight.departure || {};
    const departureAirport = departureSegment.iataCode || departureSegment.airport || extractAirportCode(route?.departureCode || '');
    const departureTime = departureSegment.at || departureSegment.time || flight.departure || '';
    const departureDate = departureSegment.date || route?.date || route?.departure_display || '';
    
    const arrivalSegment = flight.segments?.[flight.segments?.length - 1] || flight.arrival || {};
    const arrivalAirport = arrivalSegment.iataCode || arrivalSegment.airport || extractAirportCode(route?.destinationCode || '');
    const arrivalTime = arrivalSegment.at || arrivalSegment.time || flight.arrival || '';
    const arrivalDate = arrivalSegment.date || route?.returnDate || route?.return_display || '';
    
    flights.push({
      id: flight.id || `flight-${index}`,
      type,
      airline,
      flightNumber,
      departure: {
        airport: departureAirport,
        time: formatTime(departureTime),
        date: formatDate(departureDate || departureTime),
      },
      arrival: {
        airport: arrivalAirport,
        time: formatTime(arrivalTime),
        date: formatDate(arrivalDate || arrivalTime),
      },
      duration: flight.duration || 'N/A',
      price: parseFloat(flight.price) || 0,
      class: flight.class || 'Economy',
      stops: flight.stops || 0,
      segments: flight.segments || [],
    });
  });
  
  return flights;
};

/**
 * Transform Amadeus hotel data to itinerary hotel format
 */
export const transformHotelsToItinerary = (amadeusHotels, checkIn, checkOut) => {
  if (!amadeusHotels || !Array.isArray(amadeusHotels)) {
    return [];
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const calculateNights = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 1;
    try {
      const inDate = new Date(checkIn);
      const outDate = new Date(checkOut);
      const diffTime = Math.abs(outDate - inDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    } catch {
      return 1;
    }
  };

  return amadeusHotels.map((hotel, index) => {
    const pricePerNight = hotel.price_per_night || hotel.price_min || (hotel.price ? hotel.price / (hotel.nights || 1) : 0);
    const totalNights = hotel.nights || calculateNights(checkIn, checkOut);
    const totalPrice = hotel.price || (pricePerNight * totalNights);
    
    return {
      id: hotel.hotel_id || hotel.id || `hotel-${index}`,
      name: hotel.name || 'Unknown Hotel',
      image: hotel.images?.[0] || hotel.pictures?.[0] || hotel.image || 'https://via.placeholder.com/400x300?text=Hotel',
      rating: parseFloat(hotel.rating) || 0,
      reviewCount: hotel.review_count || hotel.reviews || 0,
      location: hotel.location || hotel.address || hotel.city || '',
      checkIn: formatDate(checkIn || hotel.check_in),
      checkOut: formatDate(checkOut || hotel.check_out),
      nightlyRate: parseFloat(pricePerNight) || 0,
      totalNights,
      totalPrice: parseFloat(totalPrice) || 0,
      currency: hotel.currency || 'USD',
      bookingLinks: hotel.bookingLinks || {},
    };
  });
};

/**
 * Transform Amadeus activity data to itinerary activity format
 */
export const transformActivitiesToItinerary = (amadeusActivities, startDate, endDate) => {
  if (!amadeusActivities || !Array.isArray(amadeusActivities)) {
    return [];
  }

  // Group activities by day
  const daysMap = new Map();
  
  // Calculate trip duration
  const calculateDays = (start, end) => {
    if (!start || !end) return 7; // Default 7 days
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    } catch {
      return 7;
    }
  };

  const tripDays = calculateDays(startDate, endDate);
  
  // Distribute activities across days
  amadeusActivities.forEach((activity, index) => {
    // Distribute evenly across days (day 1 to tripDays)
    const day = (index % tripDays) + 1;
    
    if (!daysMap.has(day)) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + (day - 1));
      daysMap.set(day, {
        day,
        date: dayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        activities: [],
      });
    }
    
    const priceInfo = activity.price || {};
    const priceAmount = typeof priceInfo === 'object' ? (priceInfo.amount || priceInfo.total || 0) : (priceInfo || 0);
    
    // Generate time based on day and activity index
    const hour = 9 + (index % 4) * 3; // 9 AM, 12 PM, 3 PM, 6 PM
    const time = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
    
    daysMap.get(day).activities.push({
      id: activity.id || activity.activity_id || `activity-${day}-${index}`,
      time,
      title: activity.name || 'Activity',
      description: activity.shortDescription || activity.description || '',
      location: activity.geoCode?.address || activity.location || '',
      duration: activity.minimumDuration || activity.duration || '2h',
      price: parseFloat(priceAmount) || 0,
      rating: activity.rating || 0,
      bookingLink: activity.bookingLink || '',
      images: activity.pictures || [],
    });
  });
  
  // Convert map to array and sort by day
  return Array.from(daysMap.values()).sort((a, b) => a.day - b.day);
};

/**
 * Calculate total costs from itinerary data
 */
export const calculateCosts = (flights, hotels, activities) => {
  const flightCost = flights.reduce((sum, f) => sum + (f.price || 0), 0);
  const hotelCost = hotels.reduce((sum, h) => sum + (h.totalPrice || h.nightlyRate * h.totalNights || 0), 0);
  const activityCost = activities.reduce((sum, day) => {
    return sum + day.activities.reduce((daySum, act) => daySum + (act.price || 0), 0);
  }, 0);
  
  return {
    flights: flightCost,
    hotels: hotelCost,
    activities: activityCost,
    total: flightCost + hotelCost + activityCost,
  };
};

