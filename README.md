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
