# User Stories — Jewish On The Way

---

## Actor 1: Guest (unauthenticated visitor)

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| G-01 | As a **Guest**, I want to browse a list of destinations worldwide, so that I can discover cities where Jewish services are available. | Destinations load without login; sorted by distance when GPS is granted; paginated. |
| G-02 | As a **Guest**, I want to view kosher restaurants in a destination, so that I can plan my meals before registering. | Restaurant list shows name, kashrut level, type, address, and opening hours. |
| G-03 | As a **Guest**, I want to view synagogues in a destination filtered by denomination, so that I can find a minyan that matches my nusach. | Filter by Ashkenaz / Sfarad / Chabad / Teimanim works without login. |
| G-04 | As a **Guest**, I want to use the AI smart search to find what I need in natural language, so that I don't have to navigate menus manually. | Typing "kosher meat restaurant in Tel Aviv" returns the correct category and city. |
| G-05 | As a **Guest**, I want to view Shabbat candle-lighting and havdalah times for any city, so that I can prepare for Shabbat even without an account. | Times are fetched from HebCal; city search fallback shown when GPS is denied. |
| G-06 | As a **Guest**, I want to use the Qibla compass to find the direction of Jerusalem, so that I can orient myself for prayer anywhere in the world. | Compass works via device orientation API; no login required. |
| G-07 | As a **Guest**, I want to register for an account with my email and password, so that I can access interactive features. | Registration validates email uniqueness; password is hashed; JWT is returned. |
| G-08 | As a **Guest**, I want to reset my forgotten password via email, so that I can regain access to my account. | Reset link is sent to registered email; token expires; new password is saved. |

---

## Actor 2: Registered User

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| U-01 | As a **Registered User**, I want to search for nearby kosher restaurants using free text, so that I can find food that matches my kashrut level and preferences. | AI classifier extracts type (meat/dairy/pareve) and kashrut level (rabbinate/mehadrin/badatz) from the query and filters results accordingly. |
| U-02 | As a **Registered User**, I want to save restaurants and synagogues to my favorites list, so that I can quickly access places I plan to visit again. | Toggle save/unsave; favorites list persists across sessions; shows restaurant and synagogue types. |
| U-03 | As a **Registered User**, I want to rate and review a restaurant or synagogue, so that I can share my experience with the community. | One review per user per place; 1–5 stars; optional comment; average displayed on place page. |
| U-04 | As a **Registered User**, I want to report incorrect or outdated information about a place, so that the community has accurate data. | Report types: not kosher, closed, moved, wrong info, other; report goes to admin queue. |
| U-05 | As a **Registered User**, I want to suggest a new restaurant or synagogue that is missing from the app, so that the community benefits from my local knowledge. | Request form includes name, address, phone, website, kashrut details; status tracked as pending/approved/rejected. |
| U-06 | As a **Registered User**, I want to create a minyan for a specific prayer time and location, so that I can gather a quorum of ten men for communal prayer. | Minyan requires prayer type, date (today or future), time, and location text; creator is recorded. |
| U-07 | As a **Registered User**, I want to join an existing minyan, so that I can participate in communal prayer when traveling. | Registration is unique per user per minyan; participant count increments; limit enforced at 10. |
| U-08 | As a **Registered User**, I want to leave a minyan I registered for, so that I can free up my spot if my plans change. | Unregistration removes the user's record; participant count decrements. |
| U-09 | As a **Registered User**, I want to delete a minyan I created, so that I can cancel it if it is no longer taking place. | Only the creator can delete; associated registrations are removed. |
| U-10 | As a **Registered User**, I want to chat in a destination's public chat room, so that I can connect with other Jewish travelers in the same city. | Messages are delivered in real time via WebSocket; all users in the destination room see the message. |
| U-11 | As a **Registered User**, I want to update my profile including my kashrut level preference, so that the app can personalise restaurant recommendations for me. | Fields: first name, last name, kashrut level (none / rabbinate / mehadrin / badatz); changes saved immediately. |
| U-12 | As a **Registered User**, I want to upload a profile avatar, so that other community members can recognise me in chats and reviews. | Image uploaded to Cloudinary; max 5 MB; JPEG/PNG/WebP only. |
| U-13 | As a **Registered User**, I want to view synagogues near my current GPS location, so that I can find a place to pray without knowing the city name. | Uses PostGIS ST_Distance; sorted nearest-first; returns up to 10 results. |
| U-14 | As a **Registered User**, I want to search for hosting offers in a destination for a specific Shabbat, so that I can find a Jewish family to stay with. | Filters: destination, arrival/departure dates, number of guests, Shabbat stay, children. |
| U-15 | As a **Registered User**, I want to delete my account, so that my personal data is removed from the platform. | Soft-delete; email becomes available for re-registration; data anonymised. |

---

## Actor 3: Host (registered user offering Shabbat hospitality)

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| H-01 | As a **Host**, I want to post a hosting offer for my city with availability dates and guest capacity, so that Jewish travelers can find a place to stay for Shabbat. | Offer requires destination, available-from/to dates, max guests, kashrut level, Shabbat/children flags. |
| H-02 | As a **Host**, I want to view all hosting requests I have received, so that I can decide which guests to welcome. | Received requests list shows guest name, dates, number of guests, and special requests. |
| H-03 | As a **Host**, I want to approve a hosting request, so that the guest knows they have a confirmed place to stay. | Status changes to `approved`; both parties can open the private chat. |
| H-04 | As a **Host**, I want to reject a hosting request, so that I can free the slot for other guests when I cannot accommodate someone. | Status changes to `rejected`; guest is notified. |
| H-05 | As a **Host**, I want to chat privately with a guest after approving their request, so that we can coordinate arrival details and meal preferences. | Real-time WebSocket chat scoped to the hosting request; only the two parties can see it. |
| H-06 | As a **Host**, I want to deactivate my hosting offer when I am no longer available, so that travelers do not submit requests I cannot fulfil. | `is_active` flag set to false; offer disappears from search results immediately. |
| H-07 | As a **Host**, I want to view all my active and past hosting offers, so that I can manage my hospitality history. | My-offers list shows all offers with status and date range. |

---

## Actor 4: Admin

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| A-01 | As an **Admin**, I want to create a new destination (city), so that restaurants and synagogues in that city can be added to the platform. | Destination requires name, city, country, country code, and GPS coordinates; supports parent/child hierarchy. |
| A-02 | As an **Admin**, I want to bulk-import synagogues from a JSON file for a given city, so that I can onboard an entire city's synagogue data in one operation. | Import geocodes each address via Nominatim; deduplicates by normalised name; returns created/updated/skipped/error counts. |
| A-03 | As an **Admin**, I want to review candidate synagogues imported from OpenStreetMap, so that I can approve accurate records and reject duplicates or incorrect entries. | Candidate list filterable by status (pending/approved/rejected); approval promotes record to the live synagogues table. |
| A-04 | As an **Admin**, I want to import kosher restaurants from Google Places for a destination, so that the restaurant catalogue stays current without manual data entry. | Imports by "kosher" keyword search; deduplicates by `google_place_id`; stores rating, opening hours, and coordinates. |
| A-05 | As an **Admin**, I want to delete a restaurant or synagogue that is permanently closed or incorrect, so that users are not directed to non-existent places. | Hard delete cascades to related reviews, reports, and favorites. |
| A-06 | As an **Admin**, I want to block a user account, so that I can remove bad actors who violate community guidelines. | Sets `isActive = false`; user cannot log in; existing JWT tokens are rejected. |
| A-07 | As an **Admin**, I want to delete an abusive chat message, so that the community chat remains respectful and on-topic. | Message is removed from the destination chat immediately for all connected clients. |
| A-08 | As an **Admin**, I want to review place reports submitted by users, so that I can take corrective action on incorrect or outdated data. | Reports queue filterable by status (pending/reviewed/resolved); admin can add a note and change status. |
| A-09 | As an **Admin**, I want to review user-submitted place requests, so that I can add legitimate new venues to the platform. | Request detail shows all submitted fields; admin can approve (which adds the place) or reject with a note. |
| A-10 | As an **Admin**, I want to re-run the AI denomination classifier on all synagogues in bulk, so that newly trained models improve the denomination tags across the dataset. | `POST /restaurants/reclassify` processes all records; returns counts of updated classifications. |

---

## Story Map Summary

| Discovery | Prayer | Hospitality | Community | Administration |
|-----------|--------|-------------|-----------|----------------|
| G-01 Browse destinations | U-06 Create minyan | H-01 Post hosting offer | U-10 Destination chat | A-01 Add city |
| G-02 View restaurants | U-07 Join minyan | H-02 View received requests | U-03 Rate & review place | A-02 Bulk import synagogues |
| G-03 View synagogues | U-08 Leave minyan | H-03 Approve request | U-04 Report a place | A-03 Approve OSM candidates |
| G-04 AI smart search | U-09 Delete own minyan | H-04 Reject request | U-05 Suggest new place | A-04 Import from Google |
| G-05 Shabbat times | U-13 Nearby synagogues | H-05 Private hosting chat | U-02 Favorites | A-06 Block user |
| G-06 Qibla compass | | H-06 Deactivate offer | U-11 Edit profile | A-07 Delete chat message |
| G-07 Register | | H-07 My offers history | U-12 Upload avatar | A-08 Resolve reports |
| G-08 Reset password | | | U-14 Search hosting | A-09 Resolve place requests |
