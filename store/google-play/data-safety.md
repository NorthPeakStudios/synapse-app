# Synapse: Data safety form answers (Play Console -> Policy -> App content -> Data safety)

These answers describe the app as built (website v102, native build 1). If a feature changes what leaves the phone, update this form.

## Overview questions
- Does your app collect or share any of the required user data types? **Yes** (only the optional sync data and feedback text below)
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**: Settings -> Data & Sync -> Delete my data deletes the synced copy from the server. Users can also email northpeak.support@gmail.com.
- Account creation: the app has **no accounts** (choose "My app does not allow users to create an account").

## Data types collected (declare these)
| Data type (Play's names) | Collected | Shared | Optional? | Why | Notes |
|---|---|---|---|---|---|
| App activity -> Other user-generated content (flashcards, decks, notes) | Yes | No | Optional (only if the user turns on Sync) | App functionality | Stored under a random sync code, no name or email attached |
| App activity -> App interactions (study progress, review history, settings) | Yes | No | Optional (Sync) | App functionality | Same sync copy |
| Messages -> Other in-app messages (the feedback form) | Yes | No | Optional | Developer communications, App functionality | Free text the user types, max 2000 characters, no contact details asked |
| App info and performance -> Other app performance data (app version sent with feedback) | Yes | No | Optional | Analytics (bug triage) | Only when feedback is sent |

Mark each as **not processed ephemerally**, **user can choose** (optional), and **encrypted in transit**.

## Data types NOT collected
- Personal info (name, email, address, phone, IDs): **not collected**. Support email is only if the user writes to us.
- Location, contacts, calendar, photos and videos, files: **not collected** (photos picked for "Snap a page" are read on the phone).
- Audio: **not collected**. The microphone is used on the phone for hands-free review and voice notes; recordings are not uploaded to our server. Voice notes stay on the device.
- Financial info / purchase history: **not collected by us**. Synapse Pro purchases are handled by Google Play; the app only keeps a "Pro is active" flag on the phone. (Google Play's own processing is not declared by the app.)
- Device or other IDs, advertising ID: **not collected**. No ads, no analytics SDK, no tracking.

## Shared with third parties
- **None.** Data is stored on our own server only to sync the user's devices.

## Security practices
- Encrypted in transit: Yes
- Deletion request mechanism: Yes (in-app Delete my data, plus email)
- Independent security review: No (leave unchecked)
- Committed to Play Families Policy: not applicable (the target audience is 13 and older, see content-rating.md)
