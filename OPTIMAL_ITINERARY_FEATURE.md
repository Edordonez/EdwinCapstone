# Optimal Itinerary Feature

## Overview

The Optimal Itinerary feature automatically computes and displays the best combination of flights, hotels, and activities based on user preferences for Budget, Quality, and Convenience using real Amadeus API data.

## Backend API

### Endpoint: `/api/generateOptimalItinerary`

**Method:** `POST`

**Request Body:**
```json
{
  "flights": [
    {
      "id": "flight-id",
      "price": 500.00,
      "duration": "PT8H30M",
      "airline": "Delta Airlines",
      "flightNumber": "DL123",
      "departure": "JFK",
      "arrival": "CDG"
    }
  ],
  "hotels": [
    {
      "hotel_id": "hotel-id",
      "name": "Grand Hotel",
      "price": 150.00,
      "rating": 4.5,
      "distance": 2.5
    }
  ],
  "activities": [
    {
      "id": "activity-id",
      "name": "City Tour",
      "price": 50.00,
      "rating": 4.8,
      "minimumDuration": "PT3H",
      "shortDescription": "Guided city tour"
    }
  ],
  "preferences": {
    "budget": 0.4,
    "quality": 0.4,
    "convenience": 0.2
  },
  "userBudget": 1000.00
}
```

**Response:**
```json
{
  "ok": true,
  "flight": {
    "id": "flight-id",
    "airline": "Delta Airlines",
    "flightNumber": "DL123",
    "price": 500.00,
    "duration": 8.5,
    "rating": 4.0,
    "departure": "JFK",
    "arrival": "CDG",
    "scores": {
      "budget": 0.85,
      "quality": 0.80,
      "convenience": 0.75,
      "total": 0.80
    }
  },
  "hotel": {
    "id": "hotel-id",
    "name": "Grand Hotel",
    "price": 150.00,
    "rating": 4.5,
    "distance": 2.5,
    "location": "Paris",
    "scores": {
      "budget": 0.90,
      "quality": 0.90,
      "convenience": 0.80,
      "total": 0.87
    }
  },
  "activity": {
    "id": "activity-id",
    "name": "City Tour",
    "price": 50.00,
    "rating": 4.8,
    "duration": 3.0,
    "description": "Guided city tour",
    "scores": {
      "budget": 0.95,
      "quality": 0.96,
      "convenience": 0.70,
      "total": 0.87
    }
  },
  "total_price": 700.00,
  "total_score": 0.85,
  "insight": "This combination offers the best balance of excellent value, high quality options while staying within your budget."
}
```

## Algorithm

### Scoring Methodology

1. **Normalization (0-1 scale):**
   - **Budget Score:** `1 - (price / maxPrice)` - Lower prices score higher
   - **Quality Score:** `rating / 5` - Higher ratings score higher
   - **Convenience Score:** 
     - For flights: `1 - (duration / maxDuration)` - Shorter flights score higher
     - For hotels: `1 - (distance / maxDistance)` - Closer to center scores higher
     - For activities: `1 - (duration / maxDuration)` - Shorter activities score higher

2. **Category Score Calculation:**
   ```
   categoryScore = budgetWeight * budgetScore + 
                   qualityWeight * qualityScore + 
                   convenienceWeight * convenienceScore
   ```

3. **Optimal Selection:**
   - Iterates through all combinations of (flight, hotel, activity)
   - Filters out combinations exceeding `userBudget`
   - Selects combination with highest average category score
   - Returns the best match with detailed scoring breakdown

## Frontend Component

### Component: `OptimalItineraryCard.tsx`

**Props:**
```typescript
interface OptimalItineraryCardProps {
  data: OptimalItineraryData;
  onClose?: () => void;
}
```

**Usage:**
```tsx
import OptimalItineraryCard from './components/OptimalItineraryCard';

// After fetching data from API
<OptimalItineraryCard 
  data={itineraryData} 
  onClose={() => setItineraryData(null)}
/>
```

### Features

- **Summary Banner:** Displays total price, overall match score, and recommendation
- **Individual Cards:** Separate cards for Flight, Hotel, and Activity
- **Score Visualization:** Color-coded progress bars for Budget, Quality, and Convenience scores
- **Responsive Design:** Adapts to mobile, tablet, and desktop screens
- **Gradient Headers:** Visual distinction with gradient backgrounds
- **Hover Effects:** Interactive UI elements with smooth transitions

## Integration Example

```typescript
// 1. Fetch flights, hotels, activities from Amadeus API
const flights = await amadeusService.search_flights(...);
const hotels = await amadeusService.search_hotels(...);
const activities = await amadeusService.search_activities(...);

// 2. Get user preferences (from TripPreferencesForm)
const preferences = {
  budget: 0.4,
  quality: 0.4,
  convenience: 0.2
};

// 3. Set user budget
const userBudget = 1000.00;

// 4. Call optimal itinerary endpoint
const response = await fetch('/api/generateOptimalItinerary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    flights: flights.flights,
    hotels: hotels.hotels,
    activities: activities.activities,
    preferences,
    userBudget
  })
});

const itineraryData = await response.json();

// 5. Display in component
<OptimalItineraryCard data={itineraryData} />
```

## Auto-Trigger

The optimal itinerary should be computed and displayed automatically when:
1. User submits their preferences (from `TripPreferencesForm`)
2. API data for flights, hotels, and activities is available
3. User budget is provided

The component will automatically recalculate if any of the inputs change.

## Styling

The component uses Tailwind CSS classes with the project's design system:
- Primary colors: `#004C8C` (blue), `#00ADEF` (light blue)
- Gradients: Blue (flights), Purple (hotels), Green (activities)
- Responsive grid: 1 column (mobile) → 3 columns (desktop)
- Shadow effects: `shadow-lg`, `hover:shadow-xl`
- Border radius: `rounded-xl`, `rounded-2xl`

## Error Handling

The component gracefully handles:
- Missing data (shows error message)
- API failures (displays error state)
- Invalid combinations (returns error from backend)
- Budget constraints (filters out invalid combinations)
