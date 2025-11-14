const TRIP_STATE_KEY = 'sta_trip_state_v1';

const defaultTripState = {
  flights: [],
  accommodation: [],
  activities: [],
  route: null,
  origin: null,
  destination: null,
  originCode: null,
  destinationCode: null,
  startDate: null,
  endDate: null,
  preferenceWeights: null,
  optimalFlight: null,  // The flight with highest preference score
  filters: {
    activityBudgetMax: null,
  },
  preferences: {
    guidedTour: false,
    categories: [],
  },
  mustDoActivities: [],
  lastUpdated: null,
};

const ensureWindow = () => (typeof window !== 'undefined' ? window : null);

const readState = () => {
  const win = ensureWindow();
  if (!win) return null;
  try {
    const raw = win.sessionStorage.getItem(TRIP_STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaultTripState,
      ...parsed,
      flights: Array.isArray(parsed?.flights) ? parsed.flights : [],
      accommodation: Array.isArray(parsed?.accommodation) ? parsed.accommodation : [],
      activities: Array.isArray(parsed?.activities) ? parsed.activities : [],
      filters: {
        ...defaultTripState.filters,
        ...(parsed?.filters || {}),
      },
      preferences: {
        ...defaultTripState.preferences,
        ...(parsed?.preferences || {}),
      },
      mustDoActivities: Array.isArray(parsed?.mustDoActivities) ? parsed.mustDoActivities : [],
    };
  } catch (err) {
    console.warn('Unable to read trip state', err);
    return null;
  }
};

const writeState = (state) => {
  const win = ensureWindow();
  if (!win) return;
  try {
    win.sessionStorage.setItem(TRIP_STATE_KEY, JSON.stringify(state));
    win.dispatchEvent(new CustomEvent('tripStateUpdated', { detail: state }));
  } catch (err) {
    console.warn('Unable to persist trip state', err);
  }
};

const upsertItem = (items, item) => {
  const list = Array.isArray(items) ? [...items] : [];
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...item, updatedAt: new Date().toISOString() };
  } else {
    list.push({ ...item, updatedAt: new Date().toISOString() });
  }
  return list;
};

export const loadTripState = () => readState() || { ...defaultTripState };

export const saveTripState = (nextState) => {
  const state = {
    ...defaultTripState,
    ...nextState,
    flights: Array.isArray(nextState?.flights) ? nextState.flights : [],
    accommodation: Array.isArray(nextState?.accommodation) ? nextState.accommodation : [],
    activities: Array.isArray(nextState?.activities) ? nextState.activities : [],
    filters: {
      ...defaultTripState.filters,
      ...(nextState?.filters || {}),
    },
    preferences: {
      ...defaultTripState.preferences,
      ...(nextState?.preferences || {}),
    },
    mustDoActivities: Array.isArray(nextState?.mustDoActivities) ? nextState.mustDoActivities : [],
    lastUpdated: new Date().toISOString(),
  };

  writeState(state);
  return state;
};

export const recordTripSelection = (category, selection, options = {}) => {
  if (!selection || !category) return loadTripState();

  const state = loadTripState();
  const nextState = { ...state };
  const normalizedSelection = {
    ...selection,
    category,
    recordedAt: new Date().toISOString(),
  };

  if (category === 'flight') {
    nextState.flights = upsertItem(state.flights, normalizedSelection);
  } else if (category === 'hotel') {
    nextState.accommodation = upsertItem(state.accommodation, normalizedSelection);
  } else if (category === 'activity') {
    nextState.activities = upsertItem(state.activities, normalizedSelection);
  }

  if (options.route) {
    nextState.route = {
      ...state.route,
      ...options.route,
      updatedAt: new Date().toISOString(),
    };
  }

  if (options.preferenceWeights) {
    nextState.preferenceWeights = { ...options.preferenceWeights };
  }

  if (options.filters) {
    nextState.filters = {
      ...defaultTripState.filters,
      ...(state.filters || {}),
      ...options.filters,
    };
  }

  if (options.preferences) {
    nextState.preferences = {
      ...defaultTripState.preferences,
      ...(state.preferences || {}),
      ...options.preferences,
    };
  }

  if (options.mustDoActivities) {
    const combined = Array.isArray(state.mustDoActivities) ? [...state.mustDoActivities] : [];
    options.mustDoActivities.forEach((activity) => {
      if (!activity?.name) return;
      const exists = combined.some(
        (existing) => existing.name.toLowerCase() === activity.name.toLowerCase(),
      );
      if (!exists) {
        combined.push({ ...activity, recordedAt: new Date().toISOString() });
      }
    });
    nextState.mustDoActivities = combined;
  }

  return saveTripState(nextState);
};

export const updateTripRoute = (route) => {
  if (!route) return loadTripState();
  const state = loadTripState();
  const nextState = {
    ...state,
    route: {
      ...state.route,
      ...route,
      updatedAt: new Date().toISOString(),
    },
  };

  if (route.departure) {
    nextState.origin = route.departure;
  }
  if (route.destination) {
    nextState.destination = route.destination;
  }
  if (route.departureCode) {
    nextState.originCode = route.departureCode;
  }
  if (route.destinationCode) {
    nextState.destinationCode = route.destinationCode;
  }
  if (route.date) {
    nextState.startDate = route.date;
  }
  if (route.returnDate) {
    nextState.endDate = route.returnDate;
  }

  return saveTripState(nextState);
};

export const updateTripFilters = (partial = {}) => {
  if (!partial || typeof partial !== 'object') {
    return loadTripState();
  }
  const state = loadTripState();
  const nextState = {
    ...state,
    filters: {
      ...defaultTripState.filters,
      ...(state.filters || {}),
      ...partial,
      updatedAt: new Date().toISOString(),
    },
  };
  return saveTripState(nextState);
};

export const recordBudgetConstraint = (amount) => {
  const numeric =
    typeof amount === 'number'
      ? amount
      : Number(String(amount).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return loadTripState();
  }
  return updateTripFilters({ activityBudgetMax: numeric, budget: numeric });
};

export const recordMustDoActivities = (activities) => {
  if (!Array.isArray(activities) || activities.length === 0) {
    return loadTripState();
  }
  const state = loadTripState();
  const existing = Array.isArray(state.mustDoActivities) ? [...state.mustDoActivities] : [];

  activities.forEach((activity) => {
    if (!activity?.name) return;
    const normalisedName = activity.name.trim();
    if (!normalisedName) return;
    const alreadyExists = existing.some(
      (entry) => entry.name.toLowerCase() === normalisedName.toLowerCase(),
    );
    if (!alreadyExists) {
      existing.push({ ...activity, name: normalisedName, recordedAt: new Date().toISOString() });
    }
  });

  return saveTripState({
    ...state,
    mustDoActivities: existing,
  });
};

export const updateTripPreferences = (partial = {}) => {
  if (!partial || typeof partial !== 'object') {
    return loadTripState();
  }
  const state = loadTripState();
  const mergedCategories = new Set([...(state.preferences?.categories || [])]);
  if (Array.isArray(partial.categories)) {
    partial.categories.forEach((category) => {
      if (typeof category === 'string' && category.trim()) {
        mergedCategories.add(category.trim().toLowerCase());
      }
    });
  }

  const nextState = {
    ...state,
    preferences: {
      ...defaultTripState.preferences,
      ...(state.preferences || {}),
      ...partial,
      categories: Array.from(mergedCategories),
    },
  };

  return saveTripState(nextState);
};

export const clearTripState = () => {
  const state = { ...defaultTripState, lastUpdated: new Date().toISOString() };
  writeState(state);
  return state;
};

export { TRIP_STATE_KEY };

