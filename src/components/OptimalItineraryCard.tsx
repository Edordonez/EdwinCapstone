import React from 'react';

interface Scores {
  budget: number;
  quality: number;
  convenience: number;
  total: number;
}

interface Flight {
  id?: string;
  airline: string;
  flightNumber: string;
  price: number;
  duration: number;
  rating: number;
  departure: string;
  arrival: string;
  scores: Scores;
}

interface Hotel {
  id?: string;
  name: string;
  price: number;
  rating: number;
  distance: number;
  location: string;
  scores: Scores;
}

interface Activity {
  id?: string;
  name: string;
  price: number;
  rating: number;
  duration: number;
  description: string;
  scores: Scores;
}

interface OptimalItineraryData {
  ok: boolean;
  flight: Flight;
  hotel: Hotel;
  activity: Activity;
  total_price: number;
  total_score: number;
  insight: string;
  error?: string;
}

interface OptimalItineraryCardProps {
  data: OptimalItineraryData;
  onClose?: () => void;
}

const OptimalItineraryCard: React.FC<OptimalItineraryCardProps> = ({ data, onClose }) => {
  if (!data.ok || data.error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-4xl mx-auto">
        <div className="text-center py-8">
          <p className="text-red-600 text-lg font-medium">
            {data.error || 'Unable to generate optimal itinerary'}
          </p>
        </div>
      </div>
    );
  }

  const { flight, hotel, activity, total_price, total_score, insight } = data;

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDuration = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatRating = (rating: number): string => {
    return rating.toFixed(1);
  };

  const ScoreBar: React.FC<{ label: string; score: number; color: string }> = ({
    label,
    score,
    color,
  }) => {
    const percentage = Math.round(score * 100);
    return (
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">{label}</span>
          <span className="font-semibold">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300`}
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  };

  const ItemCard: React.FC<{
    title: string;
    icon: string;
    children: React.ReactNode;
    scores: Scores;
    gradient: string;
  }> = ({ title, icon, children, scores, gradient }) => {
    return (
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100">
        {/* Gradient Header */}
        <div className={`${gradient} px-6 py-4 text-white`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {children}

          {/* Score Bars */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <ScoreBar label="Budget" score={scores.budget} color="#10b981" />
            <ScoreBar label="Quality" score={scores.quality} color="#3b82f6" />
            <ScoreBar label="Convenience" score={scores.convenience} color="#8b5cf6" />
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Overall Score</span>
                <span className="text-lg font-bold text-[#004C8C]">
                  {Math.round(scores.total * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-6xl mx-auto my-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#004C8C] mb-2">Your Optimal Itinerary</h2>
          <p className="text-gray-600 text-sm">{insight}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-[#004C8C] to-[#00ADEF] rounded-xl p-6 mb-6 text-white shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm opacity-90 mb-1">Total Price</div>
            <div className="text-3xl font-bold">{formatPrice(total_price)}</div>
          </div>
          <div>
            <div className="text-sm opacity-90 mb-1">Overall Match Score</div>
            <div className="text-3xl font-bold">{Math.round(total_score * 100)}%</div>
          </div>
          <div>
            <div className="text-sm opacity-90 mb-1">Recommendation</div>
            <div className="text-base font-medium line-clamp-2">{insight}</div>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Flight Card */}
        <ItemCard
          title="Flight"
          icon="✈️"
          scores={flight.scores}
          gradient="bg-gradient-to-r from-blue-500 to-blue-600"
        >
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500 mb-1">Airline</div>
              <div className="font-semibold text-[#004C8C]">{flight.airline}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Flight Number</div>
              <div className="font-mono text-sm text-gray-700">{flight.flightNumber}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-gray-500 mb-1">Departure</div>
                <div className="font-medium text-gray-800">{flight.departure}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Arrival</div>
                <div className="font-medium text-gray-800">{flight.arrival}</div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <div>
                <div className="text-sm text-gray-500">Duration</div>
                <div className="font-semibold">{formatDuration(flight.duration)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Price</div>
                <div className="font-bold text-[#00ADEF] text-lg">{formatPrice(flight.price)}</div>
              </div>
            </div>
          </div>
        </ItemCard>

        {/* Hotel Card */}
        <ItemCard
          title="Accommodation"
          icon="🏨"
          scores={hotel.scores}
          gradient="bg-gradient-to-r from-purple-500 to-purple-600"
        >
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500 mb-1">Hotel Name</div>
              <div className="font-semibold text-[#004C8C] text-lg">{hotel.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Location</div>
              <div className="font-medium text-gray-800">{hotel.location}</div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-500">Distance from Center</div>
                <div className="font-semibold">{hotel.distance.toFixed(1)} km</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Rating</div>
                <div className="font-semibold flex items-center gap-1">
                  <span>⭐</span>
                  <span>{formatRating(hotel.rating)}</span>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="text-sm text-gray-500 mb-1">Price per Night</div>
              <div className="font-bold text-[#00ADEF] text-xl">{formatPrice(hotel.price)}</div>
            </div>
          </div>
        </ItemCard>

        {/* Activity Card */}
        <ItemCard
          title="Activity"
          icon="🎫"
          scores={activity.scores}
          gradient="bg-gradient-to-r from-green-500 to-green-600"
        >
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500 mb-1">Activity Name</div>
              <div className="font-semibold text-[#004C8C] text-lg">{activity.name}</div>
            </div>
            {activity.description && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Description</div>
                <div className="text-sm text-gray-700 line-clamp-2">{activity.description}</div>
              </div>
            )}
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-500">Duration</div>
                <div className="font-semibold">{formatDuration(activity.duration)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Rating</div>
                <div className="font-semibold flex items-center gap-1">
                  <span>⭐</span>
                  <span>{formatRating(activity.rating)}</span>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="text-sm text-gray-500 mb-1">Price</div>
              <div className="font-bold text-[#00ADEF] text-xl">{formatPrice(activity.price)}</div>
            </div>
          </div>
        </ItemCard>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="text-center text-sm text-gray-500">
          This itinerary was optimized based on your preferences for budget, quality, and
          convenience.
        </div>
      </div>
    </div>
  );
};

export default OptimalItineraryCard;
