# Communal Sauna Booking System

The system has been successfully developed from the ground up as a fully functioning serverless application utilizing Firebase and Vanilla JS/HTML/CSS.

## Goal Description

Build and deploy a serverless communal sauna booking system that is accessible online. The system features a responsive calendar with 30-minute slots, user authentication with invite codes, role-based access for admins, mass booking and deletion mechanisms, editable screennames, native slot merging, and a beautiful "Ember & Cedar" dark-wood palette.

## Proposed Changes (ALL COMPLETED)

### Frontend (Vanilla JS/HTML/CSS)
- [x] Create the main application scaffolding (`index.html`, `styles.css`, `app.js`).
- [x] Build the "Ember & Cedar" responsive aesthetic CSS system.
- [x] Design an interceptor Loading UI to prevent login flicker.
- [x] Implement a mobile-friendly infinitely scrollable weekly Calendar grid.
- [x] Implement visual block-merging logic for consecutive slots.
- [x] Build modal logic for selecting End Times dynamically.
- [x] Build contextual screen-name edit logic directly in the header.

### Backend (Google Firebase)
- [x] Integrate Firebase Authentication (Email + Password + Invite Codes).
- [x] Set Firebase Auth configurations for user state persistence.
- [x] Create Firestore Real-time DB listeners.
- [x] Build robust constraint logic preventing bookings from overwriting each other.
- [x] Implement the 1.5 Hour strict-slot rule specifically enforcing weekend (Fri/Sat) quotas.
- [x] Build global mass-modification queries (delete entire blocks, mark blocks as maintenance, retroactively rename).

### Admin System
- [x] Restrict the `[ADMIN777]` workflow code.
- [x] Expose `Maintenance` functionality purely to Admins, blocking standard flows.
- [x] Build a dedicated Admin Dashboard to see all verified users and their underlying emails safely.
- [x] Embed CSV mass-export tools.

## Verification Plan

### Automated/Manual Testing (PASSED)
- Tested user flows on mobile & desktop views.
- Validated Firebase security rule execution manually via test accounts.
- Confirmed strict boundary limits on Friday/Saturday successfully reject over-bookings.
- Verified visual merging natively loops continuously across overlapping grid slots.
- Verified retroactive name changes sweep old records without breaking DB integrity.
