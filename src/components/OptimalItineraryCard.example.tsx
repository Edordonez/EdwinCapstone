/**
 * Example usage of OptimalItineraryCard component
 * 
 * This shows how to:
 * 1. Fetch flights, hotels, and activities from Amadeus API
 * 2. Call the generateOptimalItinerary API endpoint
 * 3. Display the result using OptimalItineraryCard
 */

import React, { useState, useEffect } from 'react';
import OptimalItineraryCard from './OptimalItineraryCard';

interface ExampleUsageProps {
  flights: any[];
  hotels: any[];
  activities: any[];
  preferences: { budget: number; quality: number; convenience: number };
  userBudget: number;
}

const OptimalItineraryExample: React.FC<ExampleUsageProps> = ({
  flights,
  hotels,
  activities,
  preferences,
  userBudget,
}) => {
  const [itineraryData, setItineraryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateOptimalItinerary = async () => {
      if (!flights.length || !hotels.length || !activities.length) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const base = isLocalhost 
          ? 'http://localhost:8000'
          : (process.env.REACT_APP_API_BASE || 'http://localhost:8000');

        const response = await fetch(`${base}/api/generateOptimalItinerary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            flights,
            hotels,
            activities,
            preferences,
            userBudget,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setItineraryData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate itinerary');
        console.error('Error generating optimal itinerary:', err);
      } finally {
        setLoading(false);
      }
    };

    generateOptimalItinerary();
  }, [flights, hotels, activities, preferences, userBudget]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00ADEF] mx-auto mb-4"></div>
          <p className="text-gray-600">Generating your optimal itinerary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (!itineraryData) {
    return null;
  }

  return (
    <OptimalItineraryCard
      data={itineraryData}
      onClose={() => setItineraryData(null)}
    />
  );
};

export default OptimalItineraryExample;
