import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import './styles/globals.css';
import './styles/site.css';
import Home from './pages/Home';
import Chat from './pages/Chat';
import OptimizedItinerary from './pages/OptimizedItinerary';
import { FlightDashboard } from './components/dashboard/FlightDashboard';
import { recordTripSelection, loadTripState, saveTripState, updateTripRoute } from './utils/tripState';

// Helper function to convert date string to ISO format (YYYY-MM-DD)
const formatDateToISO = (dateStr) => {
  if (!dateStr) return null;
  try {
    // Already ISO format
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      return dateStr;
    }
    // Parse and convert to ISO
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  } catch (e) {
    console.warn('Error formatting date to ISO:', dateStr, e);
  }
  return dateStr; // Return original if conversion fails
};

function App() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);

  // Function to show dashboard when user asks about prices/flights
  const handleShowDashboard = (data) => {
    console.log('App.js handleShowDashboard called with data:', data);
    console.log('App.js route data:', data?.route);
    setDashboardData(data);
    setShowDashboard(true);
    
    // Save optimalFlight to tripState if available
    if (data) {
      const { outboundFlights, returnFlights } = data;
      const optimalOutbound = outboundFlights?.find(f => f.optimalFlight);
      const optimalReturn = returnFlights?.find(f => f.optimalFlight);
      
      if (optimalOutbound || optimalReturn) {
        const optimalFlight = optimalOutbound || optimalReturn;
        
        // Save optimal flight to tripState
        recordTripSelection('flight', optimalFlight, {
          route: data.route,
          preferenceWeights: data.preferences?.preferences || null
        });
        
        // Update tripState with route information (including dates in ISO format)
        if (data.route) {
          updateTripRoute({
            departureCode: data.route.departureCode,
            destinationCode: data.route.destinationCode,
            departure: data.route.departure,
            destination: data.route.destination,
            date: formatDateToISO(data.route.date || data.route.departure_display),
            returnDate: formatDateToISO(data.route.returnDate || data.route.return_display)
          });
        }
        
        // Update tripState with optimalFlight
        const currentState = loadTripState();
        saveTripState({
          ...currentState,
          optimalFlight: optimalFlight
        });
        
        console.log('[App] Saved optimalFlight to tripState:', optimalFlight);
      }
    }
  };

  // Function to hide dashboard and return to chat
  const handleHideDashboard = () => {
    setShowDashboard(false);
    setDashboardData(null);
  };

  // Function to handle Generate Itinerary button click
  const handleGenerateItinerary = (tripInfo) => {
    const destination = tripInfo.destination || tripInfo.destinationCode;
    const dates = tripInfo.departureDate ? ` for ${tripInfo.departureDate}` : '';
    if (tripInfo.returnDate) {
      dates += ` to ${tripInfo.returnDate}`;
    }
    const message = `Would you like me to find hotels in ${destination}${dates}?`;
    setPendingMessage(message);
    setShowDashboard(false);
    setDashboardData(null);
    // Navigate will be handled by the component
  };

  // Function to handle Save Trip button click
  const handleSaveTrip = (tripInfo) => {
    const destination = tripInfo.destination || tripInfo.destinationCode;
    const dates = tripInfo.departureDate ? ` for ${tripInfo.departureDate}` : '';
    if (tripInfo.returnDate) {
      dates += ` to ${tripInfo.returnDate}`;
    }
    const message = `Would you like me to find hotels and activities in ${destination}${dates}?`;
    setPendingMessage(message);
    setShowDashboard(false);
    setDashboardData(null);
    // Navigate will be handled by the component
  };

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route 
        path="/chat" 
        element={
          <Chat 
            onShowDashboard={handleShowDashboard}
            showDashboard={showDashboard}
            dashboardData={dashboardData}
            onHideDashboard={handleHideDashboard}
            pendingMessage={pendingMessage}
            onPendingMessageSent={() => setPendingMessage(null)}
          />
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <DashboardWrapper 
            searchData={dashboardData}
            onBack={handleHideDashboard}
            onGenerateItinerary={handleGenerateItinerary}
            onSaveTrip={handleSaveTrip}
          />
        } 
      />
      <Route 
        path="/itinerary" 
        element={<OptimizedItinerary />} 
      />
    </Routes>
  );
}

// Wrapper component to handle navigation
function DashboardWrapper({ searchData, onBack, onGenerateItinerary, onSaveTrip }) {
  const navigate = useNavigate();
  
  const handleGenerateItineraryClick = (tripInfo) => {
    onGenerateItinerary(tripInfo);
    navigate('/chat');
  };

  const handleSaveTripClick = (tripInfo) => {
    onSaveTrip(tripInfo);
    navigate('/chat');
  };

  return (
    <FlightDashboard 
      searchData={{
        ...searchData,
        onGenerateItinerary: handleGenerateItineraryClick,
        onSaveTrip: handleSaveTripClick,
      }}
      onBack={() => {
        onBack();
        navigate('/chat');
      }}
    />
  );
}

export default App;
