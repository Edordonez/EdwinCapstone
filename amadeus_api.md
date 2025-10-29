\`\`\`\`markdown \# Amadeus Self-Service API Guide for \*\*Smart Travel
Assistant\*\*

\> Copy-paste into your codebase (e.g., \`docs/AMADEUS_GUIDE.md\`). It
covers auth, SDK setup (Node/Python), core endpoints & use-cases, moving
to production, pagination & rate limits, plus a debugging checklist for
"fake flights / no usage count" issues.

\-\--

\## 1) Environments & Authentication (OAuth2 Client Credentials)

\- \*\*Base URLs\*\*  - \*\*Test\*\*: \`https://test.api.amadeus.com\`
 - \*\*Production\*\*: \`https://api.amadeus.com\` (after approval; see
Production)

\- \*\*Token endpoint\*\* (both envs use the same path under their
base):  - \`POST /v1/security/oauth2/token\`  - Body (form-urlencoded):
\`grant_type=client_credentials&client_id=\...&client_secret=\...\`  -
Response contains \`access_token\` (Bearer), \`expires_in\` (≈1800s)

\### cURL example (Test) \`\`\`bash curl
\"https://test.api.amadeus.com/v1/security/oauth2/token\" \\ -H
\"Content-Type: application/x-www-form-urlencoded\" \\ -d
\"grant_type=client_credentials&client_id=\$AMADEUS_CLIENT_ID&client_secret=\$AMADEUS_CLIENT_SECRET\"
\`\`\`\`

Use returned \`access_token\` in \`Authorization: Bearer \<token\>\` for
subsequent API calls.

\-\--

\## 2) Official SDKs (Recommended)

\### Node.js

\`\`\`bash npm install amadeus \--save \`\`\`

\`\`\`js // .env -\> AMADEUS_CLIENT_ID=\... , AMADEUS_CLIENT_SECRET=\...
const Amadeus = require(\'amadeus\'); require(\'dotenv\').config();

const amadeus = new Amadeus({ clientId: process.env.AMADEUS_CLIENT_ID,
clientSecret: process.env.AMADEUS_CLIENT_SECRET, // hostname:
\'production\' // uncomment ONLY after production approval });

// Example: Flight Offers Search
amadeus.shopping.flightOffersSearch.get({ originLocationCode: \'IAD\',
destinationLocationCode: \'BCN\', departureDate: \'2025-10-28\',
returnDate: \'2025-11-05\', adults: \'1\' }).then(r =\>
console.log(r.data)) .catch(e =\> console.error(e)); \`\`\`

\* To \*\*switch to production\*\* via SDK, set \`hostname:
\'production\'\`.

\### Python

\`\`\`bash pip install amadeus \`\`\`

\`\`\`python from amadeus import Client, Location, ResponseError import
os

amadeus = Client( client_id=os.getenv(\'AMADEUS_CLIENT_ID\'),
client_secret=os.getenv(\'AMADEUS_CLIENT_SECRET\'), \#
hostname=\'production\' \# uncomment only after production approval )

try: \# Example: Airport/City search resp =
amadeus.reference_data.locations.get( keyword=\'WAS\',
subType=Location.AIRPORT ) print(resp.data) except ResponseError as err:
print(err) \`\`\`

\* SDK auto-renews the token and exposes \`.data\`, \`.result\`,
\`.body\` on responses.

\-\--

\## 3) Core Flight Use-Cases (Self-Service)

\> \*\*Typical search flow\*\*: \> \> 1. \*\*Search\*\* flight offers →
2) (Optional) \*\*Price\*\* verification → 3) (Optional gated)
\*\*Create Order\*\*. \> Booking (Create Orders) has \*\*special
production requirements\*\*; many apps stop at search/price.

\### A) Flight Offers Search

\* \`GET /v2/shopping/flight-offers\` (also \`POST\` variant) --- core
availability & fares. \* Required: \`originLocationCode\`,
\`destinationLocationCode\`, \`departureDate\`, \`adults\`. Optional:
\`returnDate\`, \`max\`, \`nonStop\`, \`currencyCode\`, \`travelClass\`,
etc.

\*\*Node (GET)\*\*

\`\`\`js amadeus.shopping.flightOffersSearch.get({ originLocationCode:
\'IAD\', destinationLocationCode: \'BCN\', departureDate:
\'2025-10-28\', returnDate: \'2025-11-05\', adults: \'1\', nonStop:
false, currencyCode: \'USD\' }).then(r =\> console.log(r.data)); \`\`\`

\### B) Flight Offers Price (re-price/verify)

\* \`POST /v1/shopping/flight-offers/pricing\` --- confirm
price/availability before booking. (Send selected offer from the search
as request body.)

\### C) Reference + Ops

\* \*\*Check-in links\*\*: \`GET
/v2/reference-data/urls/checkin-links?airlineCode=IB\` --- airline
check-in URL. \* \*\*Airport/City search\*\*: \`GET
/v1/reference-data/locations?keyword=LON&subType=AIRPORT,CITY\` \*
\*\*On-Demand Flight Status\*\*: live flight info by
carrier/number/date. \* \*\*Flight Delay Prediction\*\* / \*\*Airport
On-Time Performance\*\*: disruption insights for UX.

\### D) Market Insights

\* Inspiration / most-traveled / busiest-periods endpoints for discovery
& analytics.

\-\--

\## 4) Hotels (Search → Offers → Book)

\> Production booking is available; follow Hotel tutorials for shape of
requests and guest/room payloads.

\*\*Key steps\*\*

1\. \*\*Find hotels\*\* (by city name, geocode, radius, chain, ratings).
2. \*\*Get offers\*\* for specific hotels (availability & rates). 3.
\*\*Verify\*\* the selected offer (optional). 4. \*\*Book\*\* with
guest + payment details (where available).

\*\*Booking payload\*\*: Rooms & guest distribution require guest IDs
mapped per room; API returns booking IDs and provider confirmation
references.

\-\--

\## 5) Destination Experiences, Transfers & More

\* \*\*Tours & Activities\*\*: search by lat/lon, radius, or bounding
box. \* \*\*Transfers\*\*: point-to-point ground transfers search by
start/end.

\-\--

\## 6) Moving to Production

1\. Request \*\*Production Key\*\* in your Self-Service Workspace. 2.
After approval (≈72h on first app), update:

\* Base URL → \`https://api.amadeus.com\` \* SDK \`hostname:
\'production\'\` 3. \*\*Flight Create Orders\*\* has \*\*extra
requirements\*\* (consolidator agreement, etc.). 4. Billing: automatic
once free tier exceeded; track usage in Workspace.

\-\--

\## 7) Pagination & Rate Limits

\* SDK helpers: \`.next()\`, \`.previous()\`, \`.first()\`, \`.last()\`
where supported. \* Handle \`429\` responses; respect free/test quotas
and per-endpoint limits.

\-\--

\## 8) Minimal Backend Patterns (FastAPI example)

\`\`\`python \# fastapi_router.py import os, requests from fastapi
import APIRouter, HTTPException

AMADEUS_BASE = os.getenv(\"AMADEUS_BASE\",
\"https://test.api.amadeus.com\") CLIENT_ID =
os.getenv(\"AMADEUS_CLIENT_ID\") CLIENT_SECRET =
os.getenv(\"AMADEUS_CLIENT_SECRET\") router = APIRouter()

def get_token(): r =
requests.post(f\"{AMADEUS_BASE}/v1/security/oauth2/token\",
headers={\"Content-Type\":\"application/x-www-form-urlencoded\"},
data={\"grant_type\":\"client_credentials\",
\"client_id\":CLIENT_ID,\"client_secret\":CLIENT_SECRET})
r.raise_for_status() return r.json()\[\"access_token\"\]

\@router.get(\"/api/flights/search\") def flight_search(origin:str,
dest:str, depart:str, ret:str=None, adults:int=1): token = get_token()
params =
{\"originLocationCode\":origin,\"destinationLocationCode\":dest,
\"departureDate\":depart,\"adults\":adults} if ret:
params\[\"returnDate\"\] = ret r =
requests.get(f\"{AMADEUS_BASE}/v2/shopping/flight-offers\",
headers={\"Authorization\":f\"Bearer {token}\"}, params=params) if
r.status_code != 200: raise HTTPException(r.status_code, r.text) return
r.json() \`\`\`

(Adopt similar pattern for Node/Express using the Node SDK.)

\-\--

\## 9) Frontend Integration Tips (React)

\* \*\*Do not call Amadeus from the browser\*\*; call your backend route
(e.g., \`/api/flights/search\`) so the server injects the Bearer token
and keeps keys secret. \* Render dashboard from real response objects;
avoid mock generators in production builds.

\-\--

\## 10) Debugging Checklist (Fix "fake flights" & "no usage count")

1\. \*\*Verify you're hitting Amadeus at all\*\*

\* Add server logs for the \*\*exact URL\*\* called and
\`X-Request-Id\`/status codes. \* In local & Vercel, confirm
\`AMADEUS_BASE=https://test.api.amadeus.com\`. 2. \*\*Token step
actually runs\*\*

\* Log token acquisition \*\*once\*\* per cache window; on failure,
you're likely falling back to mock data. 3. \*\*Disable mock/fake
data\*\*

\* Search the codebase for keywords like \`mock\`, \`fixtures\`,
\`sample\`, \`ChatMockup\`, \`useMock=true\`, and \*\*remove or guard by
env\*\* in production builds. 4. \*\*SDK hostname\*\*

\* For test: \*\*omit\*\* hostname (default is test). For production:
set \`hostname:\'production\'\`. Don't mix base URL overrides with SDK
hostname. 5. \*\*Dates & search window\*\*

\* Ensure realistic dates, correct IATA codes (\`IAD\`, \`DCA\`,
\`BCN\`), \`adults\>=1\`, etc. If the search is too constrained, you may
get empty results and your UI could be filling with placeholders. 6.
\*\*Environment variables on Vercel\*\*

\* Present for \*\*Server\*\* runtime, redeployed, and not restricted to
preview env only. 7. \*\*Usage counter\*\*

\* The Amadeus dashboard increments \*\*only when Amadeus endpoints are
actually called\*\* (not when your chat LLM fabricates tables). Confirm
your chat agent really calls your backend route that calls Amadeus. 8.
\*\*Production booking\*\*

\* If you try \*\*Create Orders\*\*, ensure consolidator/requirements
are met or you will fail silently and revert to mocks.

\-\--

\## 11) Handy Snippets

\*\*Check-in links (cURL)\*\*

\`\`\`bash TOKEN=\"\...\"; curl
\"https://test.api.amadeus.com/v2/reference-data/urls/checkin-links?airlineCode=IB\"
\\ -H \"Authorization: Bearer \$TOKEN\" \`\`\`

\*\*Arbitrary SDK calls (Python)\*\*

\`\`\`python amadeus.get(\'/v2/reference-data/urls/checkin-links\',
airlineCode=\'BA\') amadeus.post(\'/v1/shopping/flight-offers/pricing\',
body) \`\`\`

\-\--

\## 12) References (Official Docs)

\* \*\*Authorization / Tokens\*\* --- how to request, use, and manage:
Amadeus for Developers. \* \*\*Node SDK Tutorial\*\* --- install, init,
production hostname, pagination helpers. \* \*\*Python SDK Tutorial\*\*
--- install, first call, arbitrary endpoints, async patterns. \*
\*\*Hotels Developer Guide\*\* --- hotel search → offers → booking &
guest distribution. \* \*\*Moving to Production\*\* --- request
production keys, switch base URL/hostname, Create Orders requirements.
\* \*\*FAQ / Rate Limits / Pagination\*\* --- operational behaviors &
limits.

\`\`\` \`\`\`
