CURRENT STATE ANALYSIS
✅ What Exists Today
Therapist Directory (Static HTML/JS on Hostinger)

~12 therapists in therapists.json
Multi-filter UI (state, specialty, language, price, availability)
"Book Consultation" button passes single ?therapist=id to booking page
Booking App (Next.js)

Single therapist support via URL query param
Date/time selection with availability
Form for client details
PostgreSQL API ready (but db.js not created)
Supabase client installed
❌ What's Missing
No therapist selector on booking page
When user selects another therapist → availability doesn't update
No dynamic therapist details refresh
User experience breaks if multiple therapists available
DETAILED IMPLEMENTATION PROCESS
PHASE 1: UI/UX Architecture
Step 1.1 - Design Therapist Selector Component

Location: Add above the availability section in booking page
Display Options:
Option A: Dropdown select showing all available therapists
Option B: Horizontal tab/button group for quick switching (up to 5 therapists, then dropdown)
Option C: Search + filtered list if >10 therapists match criteria
Data Needed: Pass all therapist objects to booking page, not just single ID
Default Behavior: If single therapist in URL → auto-select; if multiple → show selector; if none → error state
Step 1.2 - Therapist Summary Card Updates

Current: Shows one therapist profile card (static sidebar)
New Behavior: When therapist selector changes → card updates instantly
Fields to Sync: name, image, title, location, languages, price, availability, specialties
Step 1.3 - Availability Recalculation

Current: Loads availability for ONE therapist at init
New Behavior: When selector changes → fetch availability for NEW therapist
Logic: Different therapists = different booked slots = different available dates/times
PHASE 2: Data Flow & State Management
Step 2.1 - Modify URL Handling

Current: ?therapist=siham-abdelqader (single ID)
Enhanced:
?therapist=siham-abdelqader → still works (backward compatible)
OR fetch ALL therapists and show selector
Consider: ?matched_therapists=id1,id2,id3 (if filtering on static site first)
Step 2.2 - State Structure Updates
Before:
- therapist (single object)

After:
- availableTherapists (array of objects)
- selectedTherapist (currently selected therapist)
- therapistIndex (current position in available list)
- therapistAvailability (map keyed by therapist ID: { "siham": {...}, "diana": {...} })
Step 2.3 - Load Strategy

Option A: Load ALL therapists from /data/therapists.json on page init, show selector
Option B: Get list from static site query params, then fetch full details
Option C: Create API endpoint /api/therapists to get filtered list
PHASE 3: Component Architecture
Step 3.1 - Create TherapistSelector Component

Props:
therapists (array)
selectedTherapistId (string)
onTherapistChange (callback function)
Returns: Dropdown/tabs UI
Behavior on Change:
Update selected therapist state
Trigger availability re-fetch
Reset date/time selection (user must re-select for new therapist)
Step 3.2 - Create Availability Loader Hook

New Hook: useTherapistAvailability(therapistId)
Returns:
availability (availability map)
orderedDates (sorted dates)
isLoading (loading state)
error (error state if fetch fails)
Logic: Fetch /api/bookings?therapistId=X for booked slots, calculate available
Step 3.3 - Refactor BookingPage Component

Split Responsibilities:
Render multiple availability sections (one per therapist)? NO - show only selected
Therapist selector → updates selectedTherapist state
Details panel → watches selectedTherapist and updates
Availability section → watches selectedTherapist and refetches times
Form submission → still sends selectedTherapist.id, dateKey, time
PHASE 4: API Changes
Step 4.1 - Create Therapist Endpoint (if needed)

Endpoint: GET /api/therapists
Query Params:
ids=id1,id2,id3 (filter by list)
Returns array of therapist objects from therapists.json
Step 4.2 - Update Bookings Endpoint (what exists)

Current: Already handles therapistId parameter
No Changes Needed: Just ensure POST saves correct therapist ID
PHASE 5: Integration Between Static Site & Booking App
Step 5.1 - Static Site Booking Links

Current: ?therapist=siham-abdelqader
Option 1 (Not ideal): Keep as-is, show selector on booking page
Option 2 (Better): Pass multiple therapist IDs if user filtered first
e.g., /booking?therapists=siham,diana,kevin (from filtered list)
Option 3 (Best UX): Pass specialty/criteria, booking app filters
e.g., /booking?specialty=Anxiety,location=NY
Step 5.2 - Query String Parsing

Parse incoming params to determine:
Pre-filtered therapist list vs all therapists
Single therapist (auto-select) vs multiple (show selector)
PHASE 6: Form Submission & Booking Storage
Step 6.1 - Pre-Submission Validation

Ensure selected therapist is valid
Ensure selected date/time is still available (re-check before submit)
Detect if therapist/slot was taken by another user (race condition)
Step 6.2 - Conflict Resolution

Current Logic: If slot taken → suggest next available
Enhanced: Show which therapist has next slot available
Option: Allow user to re-select different therapist from selector
Step 6.3 - Booking Record
{
  therapist_id: "siham-abdelqader",
  date_key: "2026-04-20",
  time: "10:30 AM",
  client_name: "John Doe",
  client_email: "john@example.com",
  ... other form fields
}
Save to DB/PostgreSQL:
PHASE 7: Edge Cases & Error Handling
Step 7.1 - No Therapists Scenario

URL has no ?therapist= and no therapists available
Show error: "No therapists available. Please go back and adjust filters."
Button to return to directory
Step 7.2 - Therapist No Longer Available

Therapist in URL is deleted/archived
Show fallback message + suggest alternatives
Load all therapists and show selector
Step 7.3 - All Slots Booked

Selected therapist has no availability
Selector shows "(Fully Booked)" badge
Offer to select different therapist
Suggest "Try again later" message
Step 7.4 - Race Conditions

Two users book same slot simultaneously
Solution: DB unique constraint + graceful redirect to next available
Show message: "That slot was just booked. We found this alternative: [date/time/therapist]"
PHASE 8: User Experience Enhancements
Step 8.1 - Therapist Comparison

Option: Show side-by-side cards of 2-3 therapists before selecting?
Or: Keep current single-selection, but make switching easy
Step 8.2 - Availability Indicators

Show badge on each therapist in selector:
"◆ Limited" (few slots left)
"✓ Available" (many slots)
"⊘ Fully Booked"
Step 8.3 - Persistence

Remember user's therapist choice if page refreshes
Use session storage or URL state
IMPLEMENTATION SEQUENCE
Priority Order (Recommended)
Phase	Priority	Effort	Impact
Phase 2.1-2.2	🔴 HIGH	Small	Foundation for everything
Phase 3.1	🔴 HIGH	Medium	Core selector UI
Phase 3.2	🔴 HIGH	Medium	Dynamic availability fetch
Phase 3.3	🟡 MEDIUM	Large	Refactor booking page logic
Phase 4.1	🟡 MEDIUM	Small	Helper endpoint
Phase 5.1-5.2	🟡 MEDIUM	Small	Link static site to booking
Phase 6.1-6.3	🟡 MEDIUM	Medium	Safe form submission
Phase 7	🟢 LOW	Medium	Robustness
Phase 8	🟢 LOW	Medium	Polish
KEY TECHNICAL DECISIONS TO MAKE
Therapist Selection UI: Dropdown vs Tabs vs Grid?
Pre-filtered vs All Therapists: Should booking page show all or only matched ones?
Date/Time Reset: When therapist changes, reset selection or keep same date/time?
Conflict Handling: Auto-suggest next slot or let user choose?
Static Site Integration: Pass therapist IDs or search criteria?
This is the complete process.