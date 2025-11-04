import React from 'react';
import { FlightMap } from './FlightMap';
import { PriceChart } from './PriceChart';
import { FlightsTable } from './FlightsTable';
import { ScrollArea } from '../ui/scroll-area';

// Mock data for demonstration - this will be replaced with real Amadeus API data
const generateMockPriceData = (startDate = new Date()) => {
  const basePrice = 380;
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: basePrice + Math.floor(Math.random() * 100) - 50,
      optimal: basePrice
    };
  });
};

const flightsData = [
  {
    id: '1',
    airline: 'Delta Airlines',
    flightNumber: 'DL 1234',
    departure: '08:00 AM',
    arrival: '11:30 AM',
    duration: '3h 30m',
    price: 380,
    isOptimal: true,
    stops: 0,
  },
  {
    id: '2',
    airline: 'United Airlines',
    flightNumber: 'UA 5678',
    departure: '10:15 AM',
    arrival: '02:00 PM',
    duration: '3h 45m',
    price: 395,
    isOptimal: true,
    stops: 0,
  },
  {
    id: '3',
    airline: 'American Airlines',
    flightNumber: 'AA 9012',
    departure: '01:30 PM',
    arrival: '05:15 PM',
    duration: '3h 45m',
    price: 420,
    isOptimal: false,
    stops: 0,
  },
  {
    id: '4',
    airline: 'Southwest Airlines',
    flightNumber: 'WN 3456',
    departure: '06:00 AM',
    arrival: '11:45 AM',
    duration: '5h 45m',
    price: 310,
    isOptimal: true,
    stops: 1,
  },
  {
    id: '5',
    airline: 'JetBlue Airways',
    flightNumber: 'B6 7890',
    departure: '03:00 PM',
    arrival: '06:45 PM',
    duration: '3h 45m',
    price: 450,
    isOptimal: false,
    stops: 0,
  },
  {
    id: '6',
    airline: 'Spirit Airlines',
    flightNumber: 'NK 2345',
    departure: '07:30 AM',
    arrival: '01:30 PM',
    duration: '6h 00m',
    price: 290,
    isOptimal: false,
    stops: 1,
  },
];

export function FlightDashboard({ searchData = null }) {
  // Debug logging
  console.log('FlightDashboard received searchData:', searchData);
  console.log('FlightDashboard route from searchData:', searchData?.route);
  console.log('FlightDashboard hasRealData:', searchData?.hasRealData);
  console.log('FlightDashboard error:', searchData?.error);
  console.log('FlightDashboard flights count:', searchData?.flights?.length);
  
  // Use real data if provided, otherwise use mock data
  const hasRealData = searchData?.hasRealData || false;
  const errorMessage = searchData?.error || null;
  const displayPriceData = searchData?.priceData?.length > 0 ? searchData.priceData : generateMockPriceData();
  const displayFlightsData = searchData?.flights?.length > 0 ? searchData.flights : flightsData;
  const routeInfo = searchData?.route || {
    departure: 'New York',
    destination: 'Tokyo',
    departureCode: 'JFK',
    destinationCode: 'NRT',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };
  
  console.log('FlightDashboard using data:', {
    hasRealData,
    errorMessage,
    priceDataLength: displayPriceData.length,
    flightsDataLength: displayFlightsData.length,
    routeInfo
  });

  // Format error message to be more user-friendly
  const getErrorMessage = (error) => {
    if (!error) return null;
    
    // Parse error message to provide specific guidance
    if (error.includes('MISSING INFORMATION')) {
      if (error.includes('origin') || error.includes('destination')) {
        return "Please provide both origin and destination cities (e.g., 'flights from New York to Paris').";
      } else if (error.includes('date')) {
        return "Please provide a departure date (e.g., 'November 3rd' or '11/03/2024').";
      }
      return error.replace('MISSING INFORMATION: ', '');
    } else if (error.includes('INVALID DATE FORMAT')) {
      return "Please provide dates in a valid format (e.g., 'November 3rd, 2024', '11/03/2024', or 'Nov 3').";
    } else if (error.includes('INVALID INPUT')) {
      return error.replace('INVALID INPUT: ', '');
    } else if (error.includes('API ERROR') || error.includes('API call failed')) {
      return "Unable to fetch flight data. Please check your connection and try again.";
    } else if (error.includes('NO FLIGHTS FOUND') || error.includes('No flights available')) {
      return "No flights available for the specified route and dates. Please try different dates or destinations.";
    }
    
    // Return the error message as-is if it doesn't match any pattern
    return error;
  };

  const formattedErrorMessage = getErrorMessage(errorMessage);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Flight Search Results</h2>
          <p className="text-muted-foreground">
            {routeInfo.departure} ({routeInfo.departureCode}) → {routeInfo.destination} ({routeInfo.destinationCode}) {routeInfo.date ? `• ${routeInfo.date}` : ''}
          </p>
        </div>

        {/* Error Message - Show prominently if hasRealData is false */}
        {!hasRealData && formattedErrorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-red-800">Unable to Find Flights</h3>
            </div>
            <p className="text-red-700">{formattedErrorMessage}</p>
          </div>
        )}

        {/* Flight Map Animation */}
        <FlightMap
          key={`flight-map-${routeInfo.departureCode}-${routeInfo.destinationCode}`}
          departure={routeInfo.departure}
          destination={routeInfo.destination}
          departureCode={routeInfo.departureCode}
          destinationCode={routeInfo.destinationCode}
        />

        {/* Price Chart */}
        <PriceChart key={`price-chart-${displayPriceData[0]?.date}-${displayPriceData[0]?.price}`} data={displayPriceData} />

               {/* Outbound Flights Table */}
               {searchData?.outboundFlights && searchData.outboundFlights.length > 0 && (
                 <div className="mb-6">
                   <h3 className="text-lg font-semibold mb-3 text-gray-800">
                     Outbound Flights - {routeInfo.departure} to {routeInfo.destination} ({routeInfo.departure_display || routeInfo.date})
                   </h3>
                   <FlightsTable 
                     key={`outbound-flights-${searchData.outboundFlights[0]?.id}-${searchData.outboundFlights[0]?.price}`} 
                     flights={searchData.outboundFlights} 
                   />
                 </div>
               )}

               {/* Return Flights Table */}
               {searchData?.returnFlights && searchData.returnFlights.length > 0 && (
                 <div className="mb-6">
                   <h3 className="text-lg font-semibold mb-3 text-gray-800">
                     Return Flights - {routeInfo.destination} to {routeInfo.departure} ({routeInfo.return_display})
                   </h3>
                   <FlightsTable 
                     key={`return-flights-${searchData.returnFlights[0]?.id}-${searchData.returnFlights[0]?.price}`} 
                     flights={searchData.returnFlights} 
                   />
                 </div>
               )}

        {/* Fallback: Single Flights Table (for backward compatibility) */}
        {(!searchData?.outboundFlights || searchData.outboundFlights.length === 0) && 
         (!searchData?.returnFlights || searchData.returnFlights.length === 0) && (
          <FlightsTable key={`flights-table-${displayFlightsData[0]?.id}-${displayFlightsData[0]?.price}`} flights={displayFlightsData} />
        )}
      </div>
    </ScrollArea>
  );
}
