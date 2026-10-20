# Tranholmen Sauna Booking App

A sleek, responsive, and robust web application for managing sauna bookings for the Tranholmen local community.

## Features

- **Interactive Calendar**: Users can book sauna slots, view upcoming reservations, and see available times at a glance.
- **Role-Based Access Control**:
  - **Admin**: Full access to all features. Can revoke plans, appoint/demote moderators, manage the door code, export data, and view detailed booking statistics.
  - **Moderator**: Elevated privileges designed to help manage daily operations without needing full admin access. Moderators can approve/reject payments, update the door code, and delete user bookings from the calendar. They *cannot* revoke active plans or promote other users.
  - **User**: Standard access. Can book slots (limited by weekend rules) and view the door code (if they have an active membership).
- **Membership & Subscription System**:
  - Supports 5 payment tiers: Full Membership, Full + Yearly, Yearly Renewal, Monthly, and Weekly.
  - The payment system blocks unauthorized users from viewing the calendar or the door code until their payment is approved by an Admin/Moderator.
  - *Feature Flag*: The payment enforcement system is currently toggled **OFF** in preparation for the June 1st launch.

## How to Run the Application

The app uses vanilla HTML, CSS, and JavaScript. The backend is entirely managed by Firebase (Authentication and Firestore).

### Prerequisites
- Any modern web browser.
- A local web server (e.g., VS Code Live Server, `npx serve`, or Python's `http.server`).

### Starting the App
Because the app uses ES Modules (`<script type="module">`), you cannot simply double-click `index.html` to open it via a `file://` protocol. You must run it through a local server.

1. Navigate to the project directory in your terminal.
2. Start a local server:
   - If using Node.js: `npx serve .`
   - If using Python: `python -m http.server 8000`
3. Open your browser and navigate to `http://localhost:8000` (or whichever port your server is using).

## June 1st Launch Instructions

To enable the membership payment system on launch day:
1. Open `app.js` in your code editor.
2. Locate the feature toggle near line 64:
   ```javascript
   const MEMBERSHIP_ENFORCEMENT_ENABLED = false;
   ```
3. Change it to `true`.
4. Save the file.
5. In `index.html`, bump the `app.js?v=X.XX` cache-buster version to ensure all users immediately receive the update.
6. Commit and push the changes to GitHub.

## Database Structure (Firebase)
- `users`: Stores user profiles, roles (`admin`, `moderator`, `user`), and their active `membership` objects.
- `bookings`: Stores all sauna reservations (date, time, userId).
- `settings`: Stores global app settings, such as the `door` document which contains the active door code.

## Continuing Work on Another Computer

All code has been committed and pushed to the `main` branch. 
To continue working on another machine:
1. Clone the repository: `git clone https://github.com/LordPalmerston/sauna-booking.git`
2. Open the folder in your code editor.
3. Start your local server and you're good to go!

## Known Edge Cases & Auto-Repairs

### Orphaned Authentication Profiles
Users added manually via the Firebase Authentication console (or who experience a network timeout precisely during registration) may be able to log in but lack a corresponding profile document in the Firestore `users` collection. This causes silent failures when attempting to select payment plans and results in the user not appearing in the Admin User Registry.

**The Auto-Repair**: An auto-repair mechanism exists within `onAuthStateChanged` in `app.js`. If a user logs in and their Firestore `users` document is missing, the system will immediately generate a clean, safe default profile for them. This safely repairs their account without ever overwriting existing user data.

## Maintenance Range & Booking Restoration System

### Multi-Day Maintenance Range Tool
Admins and Moderators can put large sections of the calendar into maintenance across multiple days or weeks:
1. Click **"🛠️ Maintenance Range"** in the calendar header.
2. Click any slot to choose the **Start Time** (highlights with an orange pulse).
3. Use `<` and `>` buttons to navigate across weeks if needed, then click the **End Time** slot.
4. An interactive modal displays the total slot count and hours. Admins can enter an optional **Reason / Message for Users** (e.g. *"Stove replacement", "Chimney inspection"*).
5. **Conflict Warning & Suspension**: If regular users had bookings within that window, a warning lists them. Instead of deleting user bookings, the system stores their data in a `suspendedBooking` state.

### User Visibility
- Maintenance slots display both "Maintenance" and the custom message tag directly on the calendar grid.
- If a regular user clicks a maintenance slot, a modal appears explaining why the sauna is closed and showing the admin's message.

### Shortening & Automatic Restoration
- If maintenance finishes early, an Admin or Moderator can click the slot where work finished.
- The modal provides two options:
  - **"Shorten: Clear from here onwards"**: Clears maintenance from that specific slot to the end of the block.
  - **"Clear entire maintenance"**: Reopens the entire block.
- **Automatic Restoration**: Any reopened slots that previously had user bookings will **automatically restore** those users' original reservations right back onto the calendar! Purely empty maintenance slots return to "Available".
- Operates smoothly without native browser `confirm()` or `alert()` dialogs to prevent browser popup suppression.

## Door Code Change Notification System

When an Admin or Moderator updates the sauna door code:
- Firestore records the new `currentCode` and a `changedAt` timestamp under `settings/door`.
- When an active, paid member logs in (or if they are already logged in when the code changes), a floating alert toast slides down from the top of their screen:
  > 🔑 **The door code has been updated! The new code is: [CODE]** `Got it ✓`
- **Ongoing Paid Membership Required**: Users with no plan, expired plans, pending payments, or restricted accounts do not receive the notification (and the door code remains hidden from them).
- **Admin Testing Tool**: Admins can preview this alert at any time using the "🔔 Test Notification" button in the Admin Dashboard.
- **Dismissal Tracking**: Clicking "Got it ✓" dismisses the banner and records the seen timestamp per user account in browser storage so it is only presented once per code update.
