import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import TripPreferencesForm from '../components/TripPreferencesForm';
import { recordTripSelection, loadTripState, saveTripState, updateTripRoute, loadCurrentItinerary, loadConversation, saveConversation, clearConversation, recordMustDoActivities, selectOutboundFlight, selectReturnFlight } from '../utils/tripState';

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

// Location detection utility
async function getLocationContext() {
  const now = new Date();
  const now_iso = now.toISOString();
  
  // Get timezone
  const user_tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Get locale
  const user_locale = navigator.language || 'en-US';
  
  // Try to get location from browser
  let user_location = {
    city: null,
    region: null,
    country: null,
    lat: null,
    lon: null
  };
  
  try {
    if (navigator.geolocation) {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          enableHighAccuracy: false
        });
      });
      
      user_location.lat = position.coords.latitude;
      user_location.lon = position.coords.longitude;
      
      // Try to reverse geocode to get city/country
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${user_location.lat}&longitude=${user_location.lon}&localityLanguage=${user_locale}`
        );
        if (response.ok) {
          const data = await response.json();
          user_location.city = data.city || data.locality;
          user_location.region = data.principalSubdivision;
          
          // Clean up country name to remove "(the)" and other formatting issues
          let countryName = data.countryName;
          if (countryName) {
            // Remove "(the)" from country names
            countryName = countryName.replace(/\s*\(the\)\s*$/i, '');
            // Handle common country name variations
            if (countryName.toLowerCase().includes('united states')) {
              countryName = 'United States';
            } else if (countryName.toLowerCase().includes('united kingdom')) {
              countryName = 'United Kingdom';
            }
          }
          user_location.country = countryName;
        }
      } catch (e) {
        // Silently fail - location is optional
      }
    }
  } catch (e) {
    // Silently fail - location is optional
  }
  
  return {
    now_iso,
    user_tz,
    user_locale,
    user_location
  };
}

// Helper function to clean context data
function cleanContext(context) {
  if (!context) return context;
  
  const cleaned = { ...context };
  if (cleaned.user_location) {
    const location = { ...cleaned.user_location };
    // Remove null/undefined values
    Object.keys(location).forEach(key => {
      if (location[key] === null || location[key] === undefined) {
        delete location[key];
      }
    });
    cleaned.user_location = location;
  }
  return cleaned;
}

async function sendToApi(messages, context, sessionId, preferences = null) {
  // Use production Vercel backend or fallback to localhost for development
  // For local development (localhost), always use localhost backend
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base = isLocalhost 
    ? 'http://localhost:8000'  // Force localhost for local development
    : (process.env.REACT_APP_API_BASE || 'http://localhost:8000');
  const cleanedContext = cleanContext(context);
  
  // Include preferences in request if available
  const requestBody = {
    messages,
    context: cleanedContext,
    session_id: sessionId
  };
  
  if (preferences && preferences.preferences) {
    requestBody.preferences = preferences.preferences;
    // Preferences are being sent to API
  } else {
    console.warn('[Chat] ⚠️ No preferences provided! preferences =', JSON.stringify(preferences, null, 2));
  }
  
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

export default function Chat({ pendingMessage, onPendingMessageSent, onShowDashboard, showDashboard, dashboardData, onHideDashboard }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  const [, setIsLoadingContext] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  // If coming from Back to Results, skip preference form immediately
  const [onboardingComplete, setOnboardingComplete] = useState(location.state?.restoreConversation || false);
  const [userPreferences, setUserPreferences] = useState(null);
  const [hasExistingItinerary, setHasExistingItinerary] = useState(location.state?.hasExistingItinerary || false);
  const scrollRef = useRef(null);
  const pendingMessageSentRef = useRef(false);

  const quickReplies = ['Plan a trip to Paris', 'Budget accommodations', 'Check weather'];

  const handleOnboardingComplete = (preferences) => {
    setUserPreferences(preferences);
    setOnboardingComplete(true);
    // Note: We don't save to localStorage so the form shows every time the user visits
  };

  // Initialize context and welcome message
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Detect if this is a refresh (reload) or navigation (back/forward/new)
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        const isRefresh = navigationEntry && navigationEntry.type === 'reload';
        
        // If refresh, clear saved conversation and start fresh
        if (isRefresh) {
          console.log('Refresh detected - clearing saved conversation');
          clearConversation();
        }
        
        // Check if we should restore conversation (from Back to Results flow)
        const shouldRestore = location.state?.restoreConversation || false;
        const hasItinerary = location.state?.hasExistingItinerary || false;
        
        if (hasItinerary) {
          setHasExistingItinerary(true);
        }
        
        // If Back to Results was clicked, skip preference form and restore saved conversation
        if (shouldRestore && !isRefresh) {
          // Always skip preference form when coming from Back to Results
          setOnboardingComplete(true);
          
          const savedConv = loadConversation();
          
          if (savedConv && savedConv.messages && savedConv.messages.length > 0) {
            console.log('Restoring saved conversation:', savedConv.messages.length, 'messages');
            // Restore saved conversation
            setMessages(savedConv.messages);
            if (savedConv.sessionId) {
              setSessionId(savedConv.sessionId);
            }
            if (savedConv.context) {
              setContext(savedConv.context);
            }
            if (savedConv.userPreferences) {
              setUserPreferences(savedConv.userPreferences);
            }
            setIsLoadingContext(false);
            return; // Don't initialize new chat if restoring saved conversation
          } else {
            // No saved conversation, but still skip preference form (user wants to edit itinerary)
            console.log('Back to Results: No saved conversation, but skipping preference form');
            // Initialize chat with welcome message for continuing itinerary
            const locationContext = await getLocationContext();
            setContext(locationContext);
            
            // Generate session ID for cache continuity
            const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            setSessionId(newSessionId);
            
            // Create welcome message
            let welcomeMessage = "Hi! I'm Miles, your AI travel assistant. I'm here to help you plan the perfect trip.";
            
            if (locationContext.user_location.city && locationContext.user_location.country) {
              welcomeMessage += ` I can see you're in ${locationContext.user_location.city}, ${locationContext.user_location.country}.`;
            } else if (locationContext.user_location.country) {
              welcomeMessage += ` I can see you're in ${locationContext.user_location.country}.`;
            }
            
            welcomeMessage += " You can continue building your itinerary. What would you like to add?";
            
            setMessages([{
              role: 'assistant',
              content: welcomeMessage,
              timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            }]);
            
            setIsLoadingContext(false);
            return; // Don't continue to normal initialization
          }
        }
        
        // No saved conversation - initialize new chat
        const locationContext = await getLocationContext();
        setContext(locationContext);
        
        // Generate session ID for cache continuity
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSessionId(newSessionId);
        
        // Create welcome message with location context
        let welcomeMessage = "Hi! I'm Miles, your AI travel assistant. I'm here to help you plan the perfect trip.";
        
        if (locationContext.user_location.city && locationContext.user_location.country) {
          welcomeMessage += ` I can see you're in ${locationContext.user_location.city}, ${locationContext.user_location.country}.`;
        } else if (locationContext.user_location.country) {
          welcomeMessage += ` I can see you're in ${locationContext.user_location.country}.`;
        }
        
        welcomeMessage += " Where would you like to go?";
        
        setMessages([{
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        }]);
      } catch (e) {
        console.error('Failed to initialize context:', e);
        setMessages([{
          role: 'assistant',
          content: "Hi! I'm Miles, your AI travel assistant. I'm here to help you plan the perfect trip. Where would you like to go?",
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        }]);
      } finally {
        setIsLoadingContext(false);
      }
    };
    
    initializeChat();
  }, []);
  
  // Auto-save conversation whenever messages change (for Back to Results flow)
  useEffect(() => {
    // Save conversation only if there are messages (not just welcome message)
    if (messages.length > 1 && sessionId) {
      saveConversation(messages, sessionId, context, userPreferences);
      console.log('Auto-saved conversation:', messages.length, 'messages');
    }
  }, [messages, sessionId, context, userPreferences]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Handle pending message from Generate Itinerary / Save Trip button
  useEffect(() => {
    if (pendingMessage && !pendingMessageSentRef.current && onboardingComplete && !isTyping && messages.length > 0) {
      pendingMessageSentRef.current = true;
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        handleSend(pendingMessage);
        if (onPendingMessageSent) {
          onPendingMessageSent();
        }
        pendingMessageSentRef.current = false;
      }, 300);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, onboardingComplete, isTyping, messages.length]);

  // Function to extract dates from user message
  const extractDatesFromMessage = (message) => {
    const lowerMessage = message.toLowerCase();
    
    // Look for month names and dates
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthAbbrevs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                         'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    let departureDate = null;
    let returnDate = null;
    
    // Look for patterns like "december 1" or "dec 1"
    const datePatterns = [
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/gi,
      /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/gi,
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi
    ];
    
    const matches = [];
    datePatterns.forEach(pattern => {
      const found = lowerMessage.match(pattern);
      if (found) {
        matches.push(...found);
      }
    });
    
    if (matches.length > 0) {
      // Parse the first date as departure
      const firstMatch = matches[0];
      const monthMatch = firstMatch.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
      const dayMatch = firstMatch.match(/(\d{1,2})/);
      
      if (monthMatch && dayMatch) {
        const monthName = monthMatch[0].toLowerCase();
        const day = parseInt(dayMatch[1]);
        const year = new Date().getFullYear();
        
        // Convert month name to number
        let monthNum;
        if (monthNames.includes(monthName)) {
          monthNum = monthNames.indexOf(monthName);
        } else if (monthAbbrevs.includes(monthName)) {
          monthNum = monthAbbrevs.indexOf(monthName);
        }
        
        if (monthNum !== undefined) {
          departureDate = new Date(year, monthNum, day);
          
          // If there's a second date, use it as return date
          if (matches.length > 1) {
            const secondMatch = matches[1];
            const secondMonthMatch = secondMatch.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
            const secondDayMatch = secondMatch.match(/(\d{1,2})/);
            
            if (secondMonthMatch && secondDayMatch) {
              const secondMonthName = secondMonthMatch[0].toLowerCase();
              const secondDay = parseInt(secondDayMatch[1]);
              
              let secondMonthNum;
              if (monthNames.includes(secondMonthName)) {
                secondMonthNum = monthNames.indexOf(secondMonthName);
              } else if (monthAbbrevs.includes(secondMonthName)) {
                secondMonthNum = monthAbbrevs.indexOf(secondMonthName);
              }
              
              if (secondMonthNum !== undefined) {
                returnDate = new Date(year, secondMonthNum, secondDay);
              }
            }
          }
        }
      }
    }
    
    return { departureDate, returnDate };
  };

  // Function to extract cities from user message
  const extractCitiesFromMessage = (message) => {
    const lowerMessage = message.toLowerCase();
    
    // Common city mappings
    const cityMappings = {
      'new york': { name: 'New York', code: 'JFK' },
      'nyc': { name: 'New York', code: 'JFK' },
      'washington dc': { name: 'Washington DC', code: 'DCA' },
      'washington': { name: 'Washington DC', code: 'DCA' },
      'dc': { name: 'Washington DC', code: 'DCA' },
      'barcelona': { name: 'Barcelona', code: 'BCN' },
      'paris': { name: 'Paris', code: 'CDG' },
      'london': { name: 'London', code: 'LHR' },
      'tokyo': { name: 'Tokyo', code: 'NRT' },
      'los angeles': { name: 'Los Angeles', code: 'LAX' },
      'lax': { name: 'Los Angeles', code: 'LAX' },
      'miami': { name: 'Miami', code: 'MIA' },
      'chicago': { name: 'Chicago', code: 'ORD' },
      'rome': { name: 'Rome', code: 'FCO' },
      'madrid': { name: 'Madrid', code: 'MAD' },
      'berlin': { name: 'Berlin', code: 'BER' },
      'amsterdam': { name: 'Amsterdam', code: 'AMS' },
      'dublin': { name: 'Dublin', code: 'DUB' },
      'sydney': { name: 'Sydney', code: 'SYD' },
      'melbourne': { name: 'Melbourne', code: 'MEL' },
      'toronto': { name: 'Toronto', code: 'YYZ' },
      'vancouver': { name: 'Vancouver', code: 'YVR' },
      'mexico city': { name: 'Mexico City', code: 'MEX' },
      'sao paulo': { name: 'São Paulo', code: 'GRU' },
      'rio de janeiro': { name: 'Rio de Janeiro', code: 'GIG' },
      'buenos aires': { name: 'Buenos Aires', code: 'EZE' },
      'lima': { name: 'Lima', code: 'LIM' },
      'bogota': { name: 'Bogotá', code: 'BOG' },
      'santiago': { name: 'Santiago', code: 'SCL' },
      'montevideo': { name: 'Montevideo', code: 'MVD' },
      'caracas': { name: 'Caracas', code: 'CCS' },
      'havana': { name: 'Havana', code: 'HAV' },
      'kingston': { name: 'Kingston', code: 'KIN' },
      'nassau': { name: 'Nassau', code: 'NAS' },
      'san juan': { name: 'San Juan', code: 'SJU' },
      'prague': { name: 'Prague', code: 'PRG' },
      'vienna': { name: 'Vienna', code: 'VIE' },
      'budapest': { name: 'Budapest', code: 'BUD' },
      'warsaw': { name: 'Warsaw', code: 'WAW' },
      'moscow': { name: 'Moscow', code: 'SVO' },
      'istanbul': { name: 'Istanbul', code: 'IST' },
      'cairo': { name: 'Cairo', code: 'CAI' },
      'cape town': { name: 'Cape Town', code: 'CPT' },
      'johannesburg': { name: 'Johannesburg', code: 'JNB' },
      'casablanca': { name: 'Casablanca', code: 'CMN' },
      'marrakech': { name: 'Marrakech', code: 'RAK' },
      'tunis': { name: 'Tunis', code: 'TUN' },
      'algiers': { name: 'Algiers', code: 'ALG' },
      'lagos': { name: 'Lagos', code: 'LOS' },
      'nairobi': { name: 'Nairobi', code: 'NBO' },
      'addis ababa': { name: 'Addis Ababa', code: 'ADD' },
      'dakar': { name: 'Dakar', code: 'DKR' },
      'accra': { name: 'Accra', code: 'ACC' },
      'abidjan': { name: 'Abidjan', code: 'ABJ' },
      'douala': { name: 'Douala', code: 'DLA' },
      'kinshasa': { name: 'Kinshasa', code: 'FIH' },
      'luanda': { name: 'Luanda', code: 'LAD' },
      'maputo': { name: 'Maputo', code: 'MPM' },
      'harare': { name: 'Harare', code: 'HRE' },
      'windhoek': { name: 'Windhoek', code: 'WDH' },
      'antananarivo': { name: 'Antananarivo', code: 'TNR' },
      'port louis': { name: 'Port Louis', code: 'MRU' },
      'victoria': { name: 'Victoria', code: 'SEZ' },
      'moroni': { name: 'Moroni', code: 'HAH' },
      'djibouti': { name: 'Djibouti', code: 'JIB' },
      'asmera': { name: 'Asmara', code: 'ASM' },
      'khartoum': { name: 'Khartoum', code: 'KRT' },
      'juba': { name: 'Juba', code: 'JUB' },
      'bangui': { name: 'Bangui', code: 'BGF' },
      'ndjamena': { name: 'N\'Djamena', code: 'NDJ' },
      'yaounde': { name: 'Yaoundé', code: 'YAO' },
      'libreville': { name: 'Libreville', code: 'LBV' },
      'malabo': { name: 'Malabo', code: 'SSG' },
      'brazzaville': { name: 'Brazzaville', code: 'BZV' },
      'bujumbura': { name: 'Bujumbura', code: 'BJM' },
      'kigali': { name: 'Kigali', code: 'KGL' },
      'kampala': { name: 'Kampala', code: 'EBB' },
      'dodoma': { name: 'Dodoma', code: 'DOD' },
      'dar es salaam': { name: 'Dar es Salaam', code: 'DAR' },
      'lusaka': { name: 'Lusaka', code: 'LUN' },
      'gaborone': { name: 'Gaborone', code: 'GBE' },
      'maseru': { name: 'Maseru', code: 'MSU' },
      'mbabane': { name: 'Mbabane', code: 'SHO' },
      'pretoria': { name: 'Pretoria', code: 'PRY' },
      'bloemfontein': { name: 'Bloemfontein', code: 'BFN' },
      'durban': { name: 'Durban', code: 'DUR' },
      'port elizabeth': { name: 'Port Elizabeth', code: 'PLZ' },
      'east london': { name: 'East London', code: 'ELS' },
      'kimberley': { name: 'Kimberley', code: 'KIM' },
      'polokwane': { name: 'Polokwane', code: 'PTG' },
      'nelspruit': { name: 'Nelspruit', code: 'NLP' },
      'richards bay': { name: 'Richards Bay', code: 'RCB' },
      'george': { name: 'George', code: 'GRJ' },
      'upington': { name: 'Upington', code: 'UTN' },
      'springbok': { name: 'Springbok', code: 'SBU' },
      'calvinia': { name: 'Calvinia', code: 'CVI' },
      'sutherland': { name: 'Sutherland', code: 'SUT' },
      'clanwilliam': { name: 'Clanwilliam', code: 'CLW' },
      'vredendal': { name: 'Vredendal', code: 'VRD' },
      'vanrhynsdorp': { name: 'Vanrhynsdorp', code: 'VRS' },
      'nieuwoudtville': { name: 'Nieuwoudtville', code: 'NWV' },
      'loeriesfontein': { name: 'Loeriesfontein', code: 'LRS' }
    };
    
    let origin = null;
    let destination = null;
    
    // Look for various route patterns
    const routePatterns = [
      // "flights to Washington DC to Barcelona from December 1 to December 5"
      /flights?\s+to\s+([^to]+?)\s+to\s+([^from]+?)(?:\s+from|\s+to|$)/gi,
      // "from X to Y"
      /from\s+([^to]+?)\s+to\s+([^from]+?)(?:\s+from|\s+to|$)/gi,
      // "X to Y"
      /([^to]+?)\s+to\s+([^from]+?)(?:\s+from|\s+to|$)/gi
    ];
    
    for (const pattern of routePatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        const parts = match[0].split(/\s+to\s+/i);
        
        if (parts.length >= 2) {
          const originPart = parts[0].replace(/^(from|flights?)\s+/i, '').trim();
          const destPart = parts[1].trim();
          
          
          // Try to find cities in the mappings
          for (const [key, value] of Object.entries(cityMappings)) {
            if (originPart.includes(key)) {
              origin = value;
            }
            if (destPart.includes(key)) {
              destination = value;
            }
          }
          
          if (origin && destination) break;
        }
      }
    }
    
    // Fallback: if no pattern matched, try to find cities anywhere in the message
    if (!origin || !destination) {
      const foundCities = [];
      for (const [key, value] of Object.entries(cityMappings)) {
        if (lowerMessage.includes(key)) {
          foundCities.push(value);
        }
      }
      
      if (foundCities.length >= 2) {
        origin = foundCities[0];
        destination = foundCities[1];
      }
    }
    
    
    // Extract dates from message if not already extracted
    let departureDate = null;
    let returnDate = null;
    
    // Look for date patterns
    const datePatterns = [
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/gi,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/gi,
      /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/gi,
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi,
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      /(\d{4}-\d{2}-\d{2})/g
    ];
    
    const dateMatches = [];
    datePatterns.forEach(pattern => {
      const matches = lowerMessage.match(pattern);
      if (matches) {
        dateMatches.push(...matches);
      }
    });
    
    if (dateMatches.length > 0) {
      departureDate = dateMatches[0];
      if (dateMatches.length > 1) {
        returnDate = dateMatches[1];
      }
    }
    
    return { origin, destination, departureDate, returnDate };
  };



  const handleSend = async (text) => {
    const userMsg = { role: 'user', content: text, timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
    setMessages((prev) => [...prev, userMsg]);
    setError(null);
    setIsTyping(true);
    
    // Check for must-do activities in user message
    const textLower = text.toLowerCase();
    const mustDoPatterns = [
      /(?:하고\s*싶어|하고\s*싶다|하고\s*싶습니다)/i, // Korean: 하고 싶어
      /(?:want\s+to\s+do|want\s+to\s+visit|want\s+to\s+see|want\s+to\s+go\s+to)/i,
      /(?:add\s+)([^to]+?)(?:\s+to\s+itinerary|\s+to\s+my\s+itinerary|$)/i,
      /(?:I\s+want\s+)([^\.]+?)(?:\.|$)/i,
      /(?:visit|see|do|tour|explore)\s+([A-Z][a-zA-Z\s]+?)(?:\s+하고\s*싶어|\s+하고\s*싶다|\.|$)/i
    ];
    
    let detectedActivities = [];
    for (const pattern of mustDoPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Extract activity name from match
        let activityName = match[1] || match[0];
        
        // Clean up activity name
        activityName = activityName
          .replace(/하고\s*싶어|하고\s*싶다|하고\s*싶습니다/gi, '')
          .replace(/want\s+to\s+do|want\s+to\s+visit|want\s+to\s+see|want\s+to\s+go\s+to/gi, '')
          .replace(/add\s+/gi, '')
          .replace(/to\s+itinerary|to\s+my\s+itinerary/gi, '')
          .replace(/I\s+want\s+/gi, '')
          .replace(/visit|see|do|tour|explore/gi, '')
          .trim();
        
        // Remove common stop words
        activityName = activityName
          .replace(/^(the|a|an)\s+/i, '')
          .trim();
        
        if (activityName && activityName.length > 2) {
          detectedActivities.push({
            name: activityName,
            description: `User requested: ${activityName}`,
            category: 'general',
            duration: '2-3 hours'
          });
        }
      }
    }
    
    // If no pattern matched, try to extract activity name directly
    if (detectedActivities.length === 0) {
      // Look for capitalized words or common activity patterns
      const activityNameMatch = text.match(/([A-Z][a-zA-Z\s]+?)(?:\s+하고\s*싶어|\s+하고\s*싶다|$)/);
      if (activityNameMatch && activityNameMatch[1].length > 3) {
        detectedActivities.push({
          name: activityNameMatch[1].trim(),
          description: `User requested: ${activityNameMatch[1].trim()}`,
          category: 'general',
          duration: '2-3 hours'
        });
      }
    }
    
    // Save must-do activities if detected
    if (detectedActivities.length > 0) {
      console.log('Detected must-do activities:', detectedActivities);
      recordMustDoActivities(detectedActivities);
    }
    
    // Check if user is requesting itinerary generation (explicit request)
    const isItineraryRequest = textLower.includes('generate itinerary') || 
                               textLower.includes('generate itineary') ||
                               textLower.includes('create itinerary') ||
                               textLower.includes('make itinerary') ||
                               textLower.includes('plan itinerary') ||
                               textLower.includes('show itinerary') ||
                               (textLower.includes('itinerary') && (textLower.includes('from') || textLower.includes('to')));
    
    // Check if user wants to add to existing itinerary
    const isAddToItinerary = textLower.includes('add to itinerary') || 
                            textLower.includes('add to itineary') ||
                            textLower.includes('update itinerary') ||
                            textLower.includes('back to itinerary') ||
                            textLower.includes('return to itinerary') ||
                            textLower.includes('go back to itinerary') ||
                            hasExistingItinerary; // If we have existing itinerary, treat as add to itinerary
    
    // Check if user is confirming itinerary creation (yes/ok response to assistant's question)
    const isAffirmativeResponse = /^(yes|yeah|yep|yup|ok|okay|sure|please|do it|go ahead|create it|make it|show me|let's do it)$/i.test(text.trim());
    
    // Check if previous assistant message was asking about creating itinerary
    const previousAssistantMsg = messages.length > 0 
      ? messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content?.toLowerCase() || ''
      : '';
    const isAssistantAskingForItinerary = previousAssistantMsg.includes('itinerary') && 
                                          (previousAssistantMsg.includes('create') || 
                                           previousAssistantMsg.includes('would you like') ||
                                           previousAssistantMsg.includes('create a detailed'));
    
    // If user says yes/ok to itinerary question, skip API call and go directly to itinerary page
    const shouldNavigateToItinerary = isItineraryRequest || (isAffirmativeResponse && isAssistantAskingForItinerary);
    
    try {
          // If user is confirming itinerary creation, skip API call and navigate directly
          if (isAffirmativeResponse && isAssistantAskingForItinerary && !isItineraryRequest) {
            console.log('User confirmed itinerary creation - navigating directly to itinerary page');
            setIsTyping(false);
            // Small delay to ensure UI updates
            setTimeout(() => {
              // Extract route info from previous messages
              const allMessages = [...messages, userMsg];
              const tripState = loadTripState();
              let extractedRoute = null;
              
              // Look through previous messages to find route info
              console.log('=== Extracting route from messages ===');
              console.log('All messages:', allMessages.map(m => ({ role: m.role, content: m.content?.substring(0, 100) })));
              
              // Helper function to extract departure from message
              const extractDepartureFromMessage = (msgContent) => {
                if (!msgContent) return null;
                
                // Try "from X to Y" pattern
                const fromToPattern = /from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i;
                const fromToMatch = msgContent.match(fromToPattern);
                if (fromToMatch) {
                  return fromToMatch[1].trim().replace(/\.$/, '').trim();
                }
                
                // Try "flights from X to Y" pattern
                const flightsPattern = /flights?\s+from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i;
                const flightsMatch = msgContent.match(flightsPattern);
                if (flightsMatch) {
                  return flightsMatch[1].trim().replace(/\.$/, '').trim();
                }
                
                return null;
              };
              
              for (let i = allMessages.length - 1; i >= 0; i--) {
                const msg = allMessages[i];
                const content = msg.content || '';
                
                // Try to extract departure from this message
                let extractedDeparture = extractDepartureFromMessage(content);
                
                // Check for patterns like "activities in Barcelona from Nov 20 to Nov 27"
                // or "Top activities in Barcelona from Nov 20 to Nov 27"
                const activityPattern = /(?:top|best|activities?|things to do|what to do)\s+(?:in|at|for)?\s+([A-Za-z\s]+?)\s+(?:from|between)\s+([A-Za-z]+\s+\d{1,2})\s+(?:to|until|-|–)\s+([A-Za-z]+\s+\d{1,2})/i;
                const activityMatch = content.match(activityPattern);
                
                if (activityMatch) {
                  const destination = activityMatch[1].trim();
                  const startDate = activityMatch[2].trim();
                  const endDate = activityMatch[3].trim();
                  
                  console.log('Found activity pattern match:', { destination, startDate, endDate });
                  
                  extractedRoute = {
                    destination: destination,
                    departure: extractedDeparture || tripState?.origin || null,
                    departureCode: tripState?.originCode || '',
                    destinationCode: tripState?.destinationCode || '',
                    date: startDate,
                    returnDate: endDate
                  };
                  break;
                }
                
                // Also check assistant messages for destination mentions
                if (msg.role === 'assistant') {
                  // Pattern: "for your trip to Barcelona from November 20 to November 27"
                  const tripPattern = /(?:trip|visit|travel)\s+to\s+([A-Za-z\s]+?)\s+(?:from|between)\s+([A-Za-z]+\s+\d{1,2})(?:\s+to|\s+until|-|–)\s+([A-Za-z]+\s+\d{1,2})/i;
                  const tripMatch = content.match(tripPattern);
                  
                  if (tripMatch) {
                    const destination = tripMatch[1].trim();
                    const startDate = tripMatch[2].trim();
                    const endDate = tripMatch[3].trim();
                    
                    console.log('Found trip pattern match:', { destination, startDate, endDate });
                    
                    extractedRoute = {
                      destination: destination,
                      departure: extractedDeparture || tripState?.origin || null,
                      departureCode: tripState?.originCode || '',
                      destinationCode: tripState?.destinationCode || '',
                      date: startDate,
                      returnDate: endDate
                    };
                    break;
                  }
                  
                  // Try simpler patterns: "Barcelona from Nov 20 to Nov 27" or "in Barcelona"
                  const simpleCityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:from|between)\s+([A-Za-z]+\s+\d{1,2})\s+(?:to|until|-|–)\s+([A-Za-z]+\s+\d{1,2})/i;
                  const simpleCityMatch = content.match(simpleCityPattern);
                  
                  if (simpleCityMatch && !extractedRoute) {
                    const destination = simpleCityMatch[1].trim();
                    const startDate = simpleCityMatch[2].trim();
                    const endDate = simpleCityMatch[3].trim();
                    
                    console.log('Found simple city pattern match:', { destination, startDate, endDate });
                    
                    extractedRoute = {
                      destination: destination,
                      departure: extractedDeparture || tripState?.origin || null,
                      departureCode: tripState?.originCode || '',
                      destinationCode: tripState?.destinationCode || '',
                      date: startDate,
                      returnDate: endDate
                    };
                  }
                }
              }
              
              // If we still don't have departure, try to extract from all messages
              if (extractedRoute && !extractedRoute.departure) {
                for (let i = allMessages.length - 1; i >= 0; i--) {
                  const msg = allMessages[i];
                  if (msg.role === 'user') {
                    const extractedDeparture = extractDepartureFromMessage(msg.content);
                    if (extractedDeparture) {
                      extractedRoute.departure = extractedDeparture;
                      console.log('Extracted departure from user message:', extractedDeparture);
                      break;
                    }
                  }
                }
              }
              
              console.log('Extracted route:', extractedRoute);
              
              // Use extracted route or fall back to tripState
              const routeInfo = extractedRoute || tripState?.route || {};
              
              // If we have extracted route info, save it to tripState first
              if (extractedRoute && extractedRoute.destination && extractedRoute.date) {
                // Update tripState with extracted route info
                const formatDateToISO = (dateStr) => {
                  if (!dateStr) return null;
                  try {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                      return date.toISOString().split('T')[0];
                    }
                  } catch (e) {
                    // Try to parse month name format
                    const monthNames = {
                      'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
                      'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
                      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                    };
                    const dateMatch = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i);
                    if (dateMatch) {
                      const month = monthNames[dateMatch[1].toLowerCase()];
                      const day = parseInt(dateMatch[2]);
                      const currentYear = new Date().getFullYear();
                      const date = new Date(currentYear, month, day);
                      // If date is in the past, use next year
                      if (date < new Date()) {
                        date.setFullYear(currentYear + 1);
                      }
                      return date.toISOString().split('T')[0];
                    }
                  }
                  return null;
                };
                
                // Extract departure from messages if not in extractedRoute
                let finalDeparture = extractedRoute.departure;
                if (!finalDeparture) {
                  // Try to extract from all messages
                  for (let i = allMessages.length - 1; i >= 0; i--) {
                    const msg = allMessages[i];
                    if (msg.role === 'user') {
                      const fromToPattern = /from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i;
                      const fromToMatch = msg.content?.match(fromToPattern);
                      if (fromToMatch) {
                        finalDeparture = fromToMatch[1].trim().replace(/\.$/, '').trim();
                        console.log('Extracted departure from user message:', finalDeparture);
                        break;
                      }
                    }
                  }
                }
                
                // Normalize departure city name (e.g., "washington dc" -> "Washington DC")
                if (finalDeparture) {
                  const cityMappings = {
                    'washington dc': 'Washington DC',
                    'washington': 'Washington DC',
                    'dc': 'Washington DC',
                    'new york': 'New York',
                    'nyc': 'New York',
                    'los angeles': 'Los Angeles',
                    'lax': 'Los Angeles'
                  };
                  const normalized = cityMappings[finalDeparture.toLowerCase()] || finalDeparture;
                  finalDeparture = normalized;
                }
                
                // Ensure we have a departure value - don't pass null
                const departureToSave = finalDeparture || tripState?.origin;
                
                console.log('=== Chat.jsx: Saving to tripState ===');
                console.log('finalDeparture:', finalDeparture);
                console.log('tripState?.origin:', tripState?.origin);
                console.log('departureToSave:', departureToSave);
                console.log('extractedRoute.destination:', extractedRoute.destination);
                
                if (departureToSave) {
                  updateTripRoute({
                    departure: departureToSave,
                    destination: extractedRoute.destination,
                    departureCode: extractedRoute.departureCode || tripState?.originCode || '',
                    destinationCode: extractedRoute.destinationCode || tripState?.destinationCode || '',
                    date: formatDateToISO(extractedRoute.date),
                    returnDate: extractedRoute.returnDate ? formatDateToISO(extractedRoute.returnDate) : null
                  });
                  console.log('Updated tripState with departure:', departureToSave);
                } else {
                  console.warn('No departure found - not updating tripState.origin');
                }
              }
              
              // If we have extracted route, pass it directly to handleGenerateItinerary
              // by creating a special routeInfo object that will be used directly
              if (extractedRoute && extractedRoute.destination && extractedRoute.date) {
                // Format dates properly for routeInfo
                const formatDateForRouteInfo = (dateStr) => {
                  if (!dateStr) return null;
                  
                  // If already in "Nov 20, 2025" format, return as is
                  if (dateStr.match(/[A-Za-z]+\s+\d{1,2},?\s+\d{4}/)) {
                    return dateStr;
                  }
                  
                  // If in "Nov 20" format (no year), add current or next year
                  const monthDayPattern = /([A-Za-z]+)\s+(\d{1,2})/;
                  const monthDayMatch = dateStr.match(monthDayPattern);
                  if (monthDayMatch) {
                    const monthNames = {
                      'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
                      'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
                      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                    };
                    const month = monthNames[monthDayMatch[1].toLowerCase()];
                    const day = parseInt(monthDayMatch[2]);
                    const currentYear = new Date().getFullYear();
                    const testDate = new Date(currentYear, month, day);
                    const year = testDate < new Date() ? currentYear + 1 : currentYear;
                    return `${monthDayMatch[1]} ${day}, ${year}`;
                  }
                  
                  // Try to parse as Date object
                  try {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                  } catch (e) {
                    // Return as is if parsing fails
                    return dateStr;
                  }
                  return dateStr;
                };
                
                // Extract departure from messages if not in extractedRoute
                let finalDepartureForNav = extractedRoute.departure;
                if (!finalDepartureForNav) {
                  // Try to extract from all messages
                  for (let i = allMessages.length - 1; i >= 0; i--) {
                    const msg = allMessages[i];
                    if (msg.role === 'user') {
                      const fromToPattern = /from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i;
                      const fromToMatch = msg.content?.match(fromToPattern);
                      if (fromToMatch) {
                        finalDepartureForNav = fromToMatch[1].trim().replace(/\.$/, '').trim();
                        break;
                      }
                    }
                  }
                }
                
                const routeInfoForNav = {
                  departure: finalDepartureForNav || tripState?.origin || null,
                  destination: extractedRoute.destination,
                  departureCode: extractedRoute.departureCode || tripState?.originCode || '',
                  destinationCode: extractedRoute.destinationCode || tripState?.destinationCode || '',
                  date: formatDateForRouteInfo(extractedRoute.date),
                  returnDate: extractedRoute.returnDate ? formatDateForRouteInfo(extractedRoute.returnDate) : null
                };
                
                // Navigate directly with routeInfo instead of parsing message
                const existingItinerary = loadCurrentItinerary();
                navigate('/itinerary', {
                  state: {
                    routeInfo: routeInfoForNav,
                    flights: [],
                    outboundFlights: [],
                    returnFlights: [],
                    preferences: userPreferences ? { preferences: userPreferences } : null,
                    updateExistingItinerary: false,
                    existingItineraryData: null
                  }
                });
                return;
              }
              
              // Fallback: Construct a message for handleGenerateItinerary
              let messageForItinerary = '';
              
              if (routeInfo.destination && routeInfo.date) {
                // Use routeInfo if available
                if (routeInfo.returnDate) {
                  messageForItinerary = `Create itinerary to ${routeInfo.destination} from ${routeInfo.date} to ${routeInfo.returnDate}`;
                } else {
                  messageForItinerary = `Create itinerary to ${routeInfo.destination} on ${routeInfo.date}`;
                }
              } else {
                // Try to get from previous user messages (like "Top activities in Barcelona from Nov 20 to Nov 27")
                const prevUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
                if (prevUserMsg && (prevUserMsg.toLowerCase().includes('activities') || prevUserMsg.toLowerCase().includes('itinerary'))) {
                  messageForItinerary = prevUserMsg;
                } else {
                  messageForItinerary = `Create itinerary`;
                }
              }
              
              handleGenerateItinerary(messageForItinerary);
            }, 300);
            return;
          }
          
          const payload = [...messages, userMsg];
          const data = await sendToApi(payload, context, sessionId, userPreferences);
          const reply = data.reply || '';
          setMessages((prev) => [...prev, { role: 'assistant', content: reply, timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }]);
          
          // Save optimalFlight to tripState if available in amadeus_data
          // Backend returns amadeus_data with outboundFlights and returnFlights
          const flightData = data.dashboardData || data.amadeus_data;
          if (flightData) {
            const { outboundFlights, returnFlights, activities } = flightData;
            const optimalOutbound = outboundFlights?.find(f => f.optimalFlight || f.isOptimal);
            const optimalReturn = returnFlights?.find(f => f.optimalFlight || f.isOptimal);
            
            // Update must-do activities with full details from API response
            if (detectedActivities.length > 0 && activities && Array.isArray(activities)) {
              const updatedActivities = detectedActivities.map(detected => {
                // Try to find matching activity in API response by name
                const matchingActivity = activities.find(apiAct => {
                  const apiName = (apiAct.name || apiAct.title || '').toLowerCase().trim();
                  const detectedName = (detected.name || '').toLowerCase().trim();
                  return apiName === detectedName || 
                         apiName.includes(detectedName) || 
                         detectedName.includes(apiName);
                });
                
                if (matchingActivity) {
                  // Merge detected activity with API activity details
                  return {
                    ...detected,
                    name: matchingActivity.name || matchingActivity.title || detected.name,
                    description: matchingActivity.description || detected.description,
                    duration: matchingActivity.duration || detected.duration,
                    rating: matchingActivity.rating || detected.rating,
                    price: matchingActivity.price || detected.price,
                    category: matchingActivity.category || matchingActivity.type || detected.category,
                    location: matchingActivity.location || detected.location,
                    bookingLink: matchingActivity.bookingLink || matchingActivity.booking_link || detected.bookingLink
                  };
                }
                return detected;
              });
              
              // Update must-do activities with full details
              recordMustDoActivities(updatedActivities);
              console.log('Updated must-do activities with API details:', updatedActivities);
            }
            
            // Save selected flights to tripState
            if (optimalOutbound) {
              selectOutboundFlight(optimalOutbound);
              console.log('Saved selected outbound flight from API response:', optimalOutbound.flightNumber);
            }
            if (optimalReturn) {
              selectReturnFlight(optimalReturn);
              console.log('Saved selected return flight from API response:', optimalReturn.flightNumber);
            }
            
            if (optimalOutbound || optimalReturn) {
              const optimalFlight = optimalOutbound || optimalReturn;
              
              // Save optimal flight to tripState (for backward compatibility)
              recordTripSelection('flight', optimalFlight, {
                route: flightData.route,
                preferenceWeights: userPreferences?.preferences || null
              });
              
              // Update tripState with route information (including dates in ISO format)
              if (flightData.route) {
                updateTripRoute({
                  departureCode: flightData.route.departureCode,
                  destinationCode: flightData.route.destinationCode,
                  departure: flightData.route.departure,
                  destination: flightData.route.destination,
                  date: formatDateToISO(flightData.route.date || flightData.route.departure_display),
                  returnDate: formatDateToISO(flightData.route.returnDate || flightData.route.return_display)
                });
              }
              
              // Update tripState with optimalFlight (for backward compatibility)
              const currentState = loadTripState();
              saveTripState({
                ...currentState,
                optimalFlight: optimalFlight
              });
              
            }
          }
          
          // Auto-navigate to itinerary page if user requested itinerary generation or adding to itinerary
          if (shouldNavigateToItinerary || isAddToItinerary) {
            console.log('Itinerary generation/add request detected, navigating to itinerary page...');
            // Small delay to ensure state is saved
            setTimeout(() => {
              // Check if there's an existing itinerary to update
              const existingItinerary = loadCurrentItinerary();
              
              if (isAddToItinerary && existingItinerary) {
                console.log('Found existing itinerary, will update it with new data');
                // Navigate with update flag - handleGenerateItinerary will check for this
                // We need to modify handleGenerateItinerary to accept updateExisting flag
                // For now, use a special message format
                handleGenerateItinerary(`UPDATE_EXISTING_ITINERARY: ${text}`);
              } else {
                handleGenerateItinerary(text);
              }
            }, 500);
          }
        } catch (e) {
          console.error('API Error:', e);
          setError('Something went wrong. Please try again.');
          setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, there was an error reaching the server.', timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }]);
        } finally {
          setIsTyping(false);
        }
  };

  // Extract destination and dates from message content
  const extractTripInfo = (messageContent) => {
    let destination = null;
    let departureDate = null;
    let returnDate = null;
    let origin = null;
    
    // Try to extract origin and destination from various patterns
    // Pattern 1: "from X to Y" (full pattern)
    const fromToPattern = /from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i;
    const fromToMatch = messageContent.match(fromToPattern);
    if (fromToMatch) {
      origin = fromToMatch[1].trim().replace(/\.$/, '').trim();
      destination = fromToMatch[2].trim().split(/\s+from|\s+to|\s+on/)[0].trim();
    }
    
    // Pattern 2: "Flights from X to Y"
    if (!fromToMatch || !origin || !destination) {
      const flightsPattern = /Flights?\s+from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i;
      const flightsMatch = messageContent.match(flightsPattern);
      if (flightsMatch) {
        origin = origin || flightsMatch[1].trim().replace(/\.$/, '').trim();
        destination = destination || flightsMatch[2].trim().split(/\s+from|\s+to|\s+on/)[0].trim();
      }
    }
    
    // Pattern 3: "generate itinerary from X to Y"
    if (!origin || !destination) {
      const generatePattern = messageContent.match(/(?:generate|create|make|plan|show)\s+itinerary\s+from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i);
      if (generatePattern) {
        origin = origin || generatePattern[1].trim().replace(/\.$/, '').trim();
        destination = destination || generatePattern[2].trim().split(/\s+from|\s+to|\s+on/)[0].trim();
      }
    }
    
    // Pattern 4: Just look for city names after "to"
    if (!destination) {
      const toPattern = /\s+to\s+([A-Z][a-zA-Z\s]+?)(?:\s+from|\s+to|\s+on|\s|$|,|\.|\n)/i;
      const toMatch = messageContent.match(toPattern);
      if (toMatch) {
        destination = toMatch[1].trim().split(/\s+from|\s+to|\s+on/)[0].trim();
      }
    }
    
    // Extract dates
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthAbbrevs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                         'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    // Look for date patterns
    const datePatterns = [
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/gi,
      /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/gi,
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi,
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      /(\d{4}-\d{2}-\d{2})/g
    ];
    
    const dateMatches = [];
    datePatterns.forEach(pattern => {
      const matches = messageContent.match(pattern);
      if (matches) {
        dateMatches.push(...matches);
      }
    });
    
    if (dateMatches.length > 0) {
      departureDate = dateMatches[0];
      if (dateMatches.length > 1) {
        returnDate = dateMatches[1];
      }
    }
    
    return { destination, departureDate, returnDate };
  };

  // Handle Generate Itinerary button click - navigate to itinerary page
  const handleGenerateItinerary = (messageContentOrData) => {
    // Check if this is an update to existing itinerary
    const isUpdateExisting = typeof messageContentOrData === 'string' && messageContentOrData.startsWith('UPDATE_EXISTING_ITINERARY:');
    let actualMessageContent = messageContentOrData;
    
    if (isUpdateExisting) {
      // Extract actual message content
      actualMessageContent = messageContentOrData.replace('UPDATE_EXISTING_ITINERARY:', '').trim();
      console.log('Updating existing itinerary with message:', actualMessageContent);
    }
    
    // Try to parse as JSON first (if it contains route data from MessageBubble)
    let routeData = null;
    let messageContent = actualMessageContent;
    
    try {
      routeData = JSON.parse(actualMessageContent);
      if (routeData.messageContent) {
        messageContent = routeData.messageContent;
      }
    } catch (e) {
      // Not JSON, treat as plain message content
      messageContent = actualMessageContent;
    }
    
    // Use dashboardData if available (most reliable)
    if (dashboardData && dashboardData.route) {
      // Find optimal flights from dashboardData based on preferences
      const optimalOutbound = dashboardData.outboundFlights?.find(f => f.optimalFlight || f.isOptimal);
      const optimalReturn = dashboardData.returnFlights?.find(f => f.optimalFlight || f.isOptimal);
      
      // Save selected flights to tripState
      if (optimalOutbound) {
        selectOutboundFlight(optimalOutbound);
        console.log('Saved selected outbound flight:', optimalOutbound.flightNumber);
      }
      if (optimalReturn) {
        selectReturnFlight(optimalReturn);
        console.log('Saved selected return flight:', optimalReturn.flightNumber);
      }
      
      // Navigate with existing dashboard data
      navigate('/itinerary', {
        state: {
          routeInfo: dashboardData.route,
          flights: dashboardData.flights || [],
          outboundFlights: dashboardData.outboundFlights || [],
          returnFlights: dashboardData.returnFlights || [],
          // Explicitly pass optimal flights for first and last day display
          optimalOutboundFlight: optimalOutbound || null,
          optimalReturnFlight: optimalReturn || null,
          preferences: userPreferences ? { preferences: userPreferences } : null,
          // Pass update flag if updating existing itinerary
          updateExistingItinerary: isUpdateExisting,
          existingItineraryData: isUpdateExisting ? loadCurrentItinerary() : null
        }
      });
      return;
    }
    
    // Extract from routeData if available (from MessageBubble table extraction)
    if (routeData && routeData.flightSummary) {
      const summary = routeData.flightSummary;
      // Extract from message content if summary doesn't have all info
      const msgContent = routeData.messageContent || messageContent;
      
      // Try to extract route from message patterns
      const routeMatch = msgContent.match(/from\s+([^to]+)\s+to\s+([^\n]+)/i);
      let departure = summary.originCity || summary.origin || 'Unknown';
      let destination = summary.destCity || summary.destination || 'Unknown';
      let departureCode = summary.originCode || '';
      let destinationCode = summary.destCode || '';
      
      if (routeMatch) {
        departure = routeMatch[1].trim();
        destination = routeMatch[2].trim().split(/\s+/)[0];
      }
      
      // Try to extract airport codes from message
      const codeMatch = msgContent.match(/([A-Z]{3})\s*[→-]\s*([A-Z]{3})/);
      if (codeMatch && !departureCode && !destinationCode) {
        departureCode = codeMatch[1];
        destinationCode = codeMatch[2];
      }
      
      // Extract dates from message
      const datePatterns = [
        /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi,
        /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/gi,
      ];
      const dateMatches = [];
      datePatterns.forEach(pattern => {
        const matches = msgContent.match(pattern);
        if (matches) dateMatches.push(...matches);
      });
      
      let departureDate = summary.departureDate || null;
      let returnDate = summary.returnDate || null;
      
      if (dateMatches.length > 0 && !departureDate) {
        departureDate = dateMatches[0];
      }
      if (dateMatches.length > 1 && !returnDate) {
        returnDate = dateMatches[1];
      }
      
      const routeInfo = {
        departure: departure,
        destination: destination,
        departureCode: departureCode,
        destinationCode: destinationCode,
        date: departureDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        returnDate: returnDate || null
      };
      
      navigate('/itinerary', {
        state: {
          routeInfo: routeInfo,
          flights: [],
          outboundFlights: [],
          returnFlights: [],
          preferences: userPreferences ? { preferences: userPreferences } : null,
          // Pass update flag if updating existing itinerary
          updateExistingItinerary: isUpdateExisting,
          existingItineraryData: isUpdateExisting ? loadCurrentItinerary() : null
        }
      });
      return;
    }
    
    // FIRST: Try to get route info from tripState (most reliable)
    const currentTripState = loadTripState();
    let departure = currentTripState?.origin || null;
    let destination = currentTripState?.destination || null;
    let departureCode = currentTripState?.originCode || null;
    let destinationCode = currentTripState?.destinationCode || null;
    let departureDate = currentTripState?.startDate || null;
    let returnDate = currentTripState?.endDate || null;
    
    console.log('=== Chat.jsx handleGenerateItinerary - tripState data ===');
    console.log('tripState:', currentTripState);
    console.log('origin:', departure);
    console.log('destination:', destination);
    console.log('startDate:', departureDate);
    console.log('endDate:', returnDate);
    
    // Fallback: Extract from message content if tripState doesn't have it
    const tripInfo = extractTripInfo(messageContent);
    
    if (!departure) departure = tripInfo.origin || 'Unknown';
    if (!destination) destination = tripInfo.destination || 'Unknown';
    if (!departureCode) departureCode = '';
    if (!destinationCode) destinationCode = '';
    if (!departureDate) departureDate = tripInfo.departureDate || null;
    if (!returnDate) returnDate = tripInfo.returnDate || null;
    
    // Try to extract route info from message patterns as additional fallback
    // Pattern 1: "from X to Y" (full pattern)
    const routeMatch = messageContent.match(/from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i);
    
    if (departure === 'Unknown' && routeMatch) {
      departure = routeMatch[1].trim();
      departure = departure.replace(/\.$/, '').trim();
    }
    if (destination === 'Unknown' && routeMatch) {
      destination = routeMatch[2].trim();
      destination = destination.split(/\s+from|\s+to|\s+on/)[0].trim();
    }
    
    // Pattern 2: "generate itinerary from X to Y"
    if (departure === 'Unknown' || destination === 'Unknown') {
      const generatePattern = messageContent.match(/(?:generate|create|make|plan|show)\s+itinerary\s+from\s+([^to]+?)\s+to\s+([^\n,]+?)(?:\s+from|\s+to|\s+on|\s+,\s|$)/i);
      if (generatePattern) {
        if (departure === 'Unknown') {
          departure = generatePattern[1].trim().replace(/\.$/, '').trim();
        }
        if (destination === 'Unknown') {
          destination = generatePattern[2].trim().split(/\s+from|\s+to|\s+on/)[0].trim();
        }
      }
    }
    
    // Try to extract airport codes (e.g., "IAD → BCN" or "JFK to CDG")
    const codeMatch = messageContent.match(/([A-Z]{3})\s*[→-]\s*([A-Z]{3})/);
    if (codeMatch) {
      if (!departureCode) departureCode = codeMatch[1];
      if (!destinationCode) destinationCode = codeMatch[2];
    }
    
    // Extract dates more robustly from message if not in tripState
    if (!departureDate || !returnDate) {
      const monthPattern = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/gi;
      const dateMatches = [];
      let match;
      while ((match = monthPattern.exec(messageContent)) !== null) {
        dateMatches.push(match[0]);
      }
      
      if (!departureDate && dateMatches.length > 0) {
        departureDate = dateMatches[0];
      }
      if (!returnDate && dateMatches.length > 1) {
        returnDate = dateMatches[1];
      }
    }
    
    // Format dates to ISO format for TripState
    const formatDateToISO = (dateStr) => {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        // Fallback: try to parse month name format
        const monthNames = {
          'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
          'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        const dateMatch = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i);
        if (dateMatch) {
          const month = monthNames[dateMatch[1].toLowerCase()];
          const day = parseInt(dateMatch[2]);
          const currentYear = new Date().getFullYear();
          const date = new Date(currentYear, month, day);
          // If date is in the past, use next year
          if (date < new Date()) {
            date.setFullYear(currentYear + 1);
          }
          return date.toISOString().split('T')[0];
        }
      }
      return null;
    };
    
    const routeInfo = {
      departure: departure || 'Unknown',
      destination: destination || 'Unknown',
      departureCode: departureCode || '',
      destinationCode: destinationCode || '',
      date: departureDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      returnDate: returnDate || null
    };
    
    console.log('=== Final routeInfo ===');
    console.log(routeInfo);
    
    // Update TripState with route info before navigation
    // Normalize departure city name
    let normalizedDeparture = departure;
    if (normalizedDeparture && normalizedDeparture !== 'Unknown') {
      const cityMappings = {
        'washington dc': 'Washington DC',
        'washington': 'Washington DC',
        'dc': 'Washington DC',
        'new york': 'New York',
        'nyc': 'New York',
        'los angeles': 'Los Angeles',
        'lax': 'Los Angeles'
      };
      normalizedDeparture = cityMappings[normalizedDeparture.toLowerCase()] || normalizedDeparture;
    }
    
    if (normalizedDeparture && destination && normalizedDeparture !== 'Unknown' && destination !== 'Unknown') {
      console.log('=== handleGenerateItinerary: Saving to tripState ===');
      console.log('normalizedDeparture:', normalizedDeparture);
      console.log('destination:', destination);
      updateTripRoute({
        departure: normalizedDeparture,
        destination: destination,
        departureCode: departureCode,
        destinationCode: destinationCode,
        date: formatDateToISO(departureDate) || formatDateToISO(routeInfo.date),
        returnDate: formatDateToISO(returnDate)
      });
      console.log('Updated tripState in handleGenerateItinerary');
    } else {
      console.warn('handleGenerateItinerary: Not updating tripState - missing departure or destination');
    }
    
    navigate('/itinerary', {
      state: {
        routeInfo: routeInfo,
        flights: [],
        outboundFlights: [],
        returnFlights: [],
        preferences: userPreferences ? { preferences: userPreferences } : null,
        // Pass update flag if updating existing itinerary
        updateExistingItinerary: isUpdateExisting,
        existingItineraryData: isUpdateExisting ? loadCurrentItinerary() : null
      }
    });
  };

  // Handle Save Trip button click
  const handleSaveTrip = (messageContent) => {
    // Get dates from dashboardData if available (most reliable source)
    let departureDate = null;
    let returnDate = null;
    let destination = 'your destination';
    
    if (dashboardData && dashboardData.route) {
      departureDate = dashboardData.route.departure_display || dashboardData.route.date;
      returnDate = dashboardData.route.return_display || dashboardData.route.returnDate;
      // Prefer destination city name over code, but use code if name is not available
      destination = dashboardData.route.destination || dashboardData.route.destinationCode || destination;
    } else {
      // Fallback: Try to extract from message content, but be more careful
      const tripInfo = extractTripInfo(messageContent);
      departureDate = tripInfo.departureDate;
      returnDate = tripInfo.returnDate;
      // Only use extracted destination if it looks valid (not "ask for" or other invalid text)
      if (tripInfo.destination && 
          tripInfo.destination.length > 2 && 
          !tripInfo.destination.toLowerCase().includes('ask') &&
          !tripInfo.destination.toLowerCase().includes('for')) {
        destination = tripInfo.destination;
      }
    }
    
    // Try to get dates from tripState as fallback
    if ((!departureDate || !returnDate) && typeof loadTripState === 'function') {
      try {
        const tripState = loadTripState();
        if (tripState && tripState.route) {
          if (!departureDate && tripState.route.date) {
            departureDate = tripState.route.date;
          }
          if (!returnDate && tripState.route.returnDate) {
            returnDate = tripState.route.returnDate;
          }
          if (!destination && tripState.route.destination) {
            destination = tripState.route.destination;
          }
        }
      } catch (e) {
        console.warn('Error loading tripState:', e);
      }
    }
    
    // Try to extract dates from message history (user's original request)
    if ((!departureDate || !returnDate) && messages && messages.length > 0) {
      // Look for user messages with date information
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user') {
          const dates = extractDatesFromMessage(msg.content);
          // Convert Date objects to formatted strings
          if (dates.departureDate && !departureDate) {
            if (dates.departureDate instanceof Date) {
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                'July', 'August', 'September', 'October', 'November', 'December'];
              const month = monthNames[dates.departureDate.getMonth()];
              const day = dates.departureDate.getDate();
              const getOrdinalSuffix = (d) => {
                if (d > 3 && d < 21) return 'th';
                switch (d % 10) {
                  case 1: return 'st';
                  case 2: return 'nd';
                  case 3: return 'rd';
                  default: return 'th';
                }
              };
              departureDate = `${month} ${day}${getOrdinalSuffix(day)}`;
            } else {
              departureDate = dates.departureDate;
            }
          }
          if (dates.returnDate && !returnDate) {
            if (dates.returnDate instanceof Date) {
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                'July', 'August', 'September', 'October', 'November', 'December'];
              const month = monthNames[dates.returnDate.getMonth()];
              const day = dates.returnDate.getDate();
              const getOrdinalSuffix = (d) => {
                if (d > 3 && d < 21) return 'th';
                switch (d % 10) {
                  case 1: return 'st';
                  case 2: return 'nd';
                  case 3: return 'rd';
                  default: return 'th';
                }
              };
              returnDate = `${month} ${day}${getOrdinalSuffix(day)}`;
            } else {
              returnDate = dates.returnDate;
            }
          }
          if (departureDate && returnDate) break;
        }
      }
    }
    
    // Format dates for display (extract month and day, e.g., "November 20th")
    const formatDateForDisplay = (dateStr) => {
      if (!dateStr) return null;
      
      // Helper to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
      const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
        }
      };
      
      // Handle ISO format (YYYY-MM-DD)
      if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                              'July', 'August', 'September', 'October', 'November', 'December'];
            const month = monthNames[date.getMonth()];
            const day = date.getDate();
            return `${month} ${day}${getOrdinalSuffix(day)}`;
          }
        } catch (e) {
          console.warn('Error parsing ISO date:', dateStr, e);
        }
      }
      
      // Try to match patterns like "Nov 21", "Nov 21, 2025", "November 21", etc.
      const match = dateStr.match(/(Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|November|December|January|February|March|April|May|June|July|August|September|October)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
      if (match) {
        // Convert abbreviations to full month names
        const monthMap = {
          'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
          'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
          'sep': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December'
        };
        const monthInput = match[1].toLowerCase();
        let month;
        if (monthInput.length <= 3) {
          month = monthMap[monthInput] || match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        } else {
          month = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        }
        const day = parseInt(match[2]);
        return `${month} ${day}${getOrdinalSuffix(day)}`;
      }
      return dateStr;
    };
    
    const formattedDeparture = formatDateForDisplay(departureDate);
    const formattedReturn = formatDateForDisplay(returnDate);
    
    // Build the date string - show range only if returnDate exists and is different from departure
    // Save Trip means the user wants to find hotels/activities for the entire trip period
    let dateStr = '';
    if (formattedDeparture && formattedReturn && formattedDeparture !== formattedReturn) {
      // Show full trip period (departure to return) - only if dates are different
      dateStr = ` for ${formattedDeparture} to ${formattedReturn}`;
    } else if (formattedDeparture) {
      // Only departure date available, or return date is same as departure
      dateStr = ` for ${formattedDeparture}`;
    }
    
    // Instead of sending a user message, add an assistant message asking the question
    const assistantMessage = {
      role: 'assistant',
      content: `Would you like me to find hotels and activities in ${destination}${dateStr}?`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const rendered = useMemo(() => messages.map((m, idx) => (
    <MessageBubble 
      key={idx} 
      role={m.role} 
      content={m.content} 
      timestamp={m.timestamp}
      onGenerateItinerary={m.role === 'assistant' ? (messageContent) => handleGenerateItinerary(messageContent) : null}
      onSaveTrip={m.role === 'assistant' ? (messageContent) => handleSaveTrip(messageContent) : null}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  )), [messages, dashboardData, userPreferences]);

  // Show message if we have existing itinerary
  const showItineraryMessage = hasExistingItinerary && onboardingComplete;

  // Show onboarding form if not completed
  if (!onboardingComplete) {
    return (
      <div className="chat-page" style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(to bottom, #EAF9FF 0%, #ffffff 100%)',
        padding: '40px 20px'
      }}>
        <header className="chat-header">
          <div className="container">
            <div className="chat-header-content">
              <button className="back-button" onClick={() => window.location.href = '/'}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to Home
              </button>
              <div className="chat-header-info">
                <div className="chat-header-icon" style={{ width: '48px', height: '48px', padding: '6px', background: '#E6F7FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={process.env.PUBLIC_URL + '/Miles_logo.png'} alt="Miles" style={{ width: '36px', height: '36px' }} />
                </div>
                <div>
                  <h1 className="chat-title">Miles</h1>
                  <p className="chat-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff00', display: 'inline-block' }}></span>
                    Online • Let's personalize your experience
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div style={{ marginTop: '40px' }}>
          <TripPreferencesForm onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="container">
          <div className="chat-header-content">
            <button className="back-button" onClick={() => window.location.href = '/'}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Home
            </button>
            <div className="chat-header-info">
              <div className="chat-header-icon" style={{ width: '48px', height: '48px', padding: '6px', background: '#E6F7FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={process.env.PUBLIC_URL + '/Miles_logo.png'} alt="Miles" style={{ width: '36px', height: '36px' }} />
              </div>
              <div>
                <h1 className="chat-title">Miles</h1>
                <p className="chat-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff00', display: 'inline-block' }}></span>
                  Online • Ready to help plan your trip
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        <div className="container">
          {showItineraryMessage && (
            <div style={{
              padding: '16px 20px',
              marginBottom: '16px',
              backgroundColor: '#f0f9ff',
              borderRadius: '12px',
              border: '2px solid #bae6fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#004C8C', marginBottom: '4px' }}>
                  Continue Building Your Itinerary
                </div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  You have an existing itinerary. Continue the conversation to add more activities, flights, or hotels. Type "add [activity name]" to add it to your itinerary.
                </div>
              </div>
              <button
                onClick={() => {
                  navigate('/itinerary');
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#00ADEF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                View Itinerary
              </button>
            </div>
          )}
          {rendered}
          {isTyping && (
            <div className="message-row">
              <div className="avatar avatar-assistant">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="#00ADEF"/>
                </svg>
              </div>
              <div className="typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
          {error && (
            <div className="card" style={{ padding: 12, marginTop: 8 }}>
              <div className="muted">{error}</div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-input-dock">
        <div className="container">
          {messages.length === 1 && (
            <div className="quick-replies">
              {quickReplies.map((text, idx) => (
                <button key={idx} className="quick-reply-btn" onClick={() => handleSend(text)}>
                  {text}
                </button>
              ))}
            </div>
          )}
          <ChatInput onSend={handleSend} disabled={isTyping} />
        </div>
      </div>
    </div>
  );
}