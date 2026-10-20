# Sauna Booking System - Final Walkthrough

The Communal Sauna Booking System is now fully constructed, featuring a complete Firebase integration, responsive UI, advanced grid layout, and seamless admin features.

## 🌟 Core System Highlights

### 1. Advanced Real-Time Calendar Grid
- Fully responsive scrolling calendar for a rolling 7-day week (00:00 - 23:30, 30-minute intervals).
- **Intelligent Block Merging**: The grid natively loops through connected bookings (by the same user, with the same status) and seamlessly wipes the interior border styling, making large 1.5-hour reservations display as a single contiguous, solid rectangle—just like Google Calendar.

### 2. Powerful Mass-Booking & Syncing logic
- When booking a slot, users can simply select their "End Time" from a drop-down list. 
- The system automatically factors in forward booking collisions and midnight boundaries.
- **Whole-Block Deletion:** Built-in backward & forward tracing logic allows you to click *anywhere* inside a large booking block and delete all associated historical half-hour Firebase records at once.
- On Friday and Saturday, regular users are strictly capped to a 1.5-hour limit, cleanly hiding dropdown options beyond their limit natively.

### 3. Smart User Identity Control
- Registration is strictly gated behind the `TRANHOLMEN` user invite code and `ADMIN777` admin invite code.
- **Editable Screennames:** Users can edit their screenname contextually any time using the ✏️ pencil icon.
- **Retroactive Binding:** Name changes retroactively crawl through your Firebase history, mapping the new screen name immediately over all historical bookings.
- **Security Visibility:** Normal users see screennames only. Admins effortlessly see a custom tag underneath the screenname detailing the explicit Firebase registration email for zero-obfuscation security.

### 4. "Ember & Cedar" Aesthetic Makeover
The site strictly adheres to a premium light-warm palette:
- `Soft Steam (#F9F5F0)`: Off-white UI padding and backgrounds.
- `Terracotta Clay (#D37B5C)`: Button accents.
- `Golden Birch (#E4B373)`: Warm highlighter for the "Booked by Me" slots.
- `Rich Cedar (#8B5A44)`: Standard visibility bookings.
- `Hot Stone (#3A2E2A)`: Deep-readability contrast tracking and maintenance indicators.

### 5. Flash-less Authentication
A loading interceptor UI aggressively intercepts the screen while the Firebase session spins up in the background (~0.5s), destroying the annoying visual flicker between the "Auth screen" and "Calendar View".

### 6. Multi-Day Maintenance Range & Booking Restoration
- **Two-Click Range Tool:** Admins and Moderators can click the **"🛠️ Maintenance Range"** button in the header, click a start slot, and click an end slot across days or weeks to instantly set a maintenance period.
- **Custom Reason / Notes:** Admins can attach a message (e.g., *"Chimney inspection"*, *"Stove repair"*), which displays as a tag on the calendar and informs regular users why the sauna is closed.
- **Conflict Warning & Safe Suspension:** If regular users had bookings within the maintenance window, their reservations are safely suspended instead of deleted.
- **Early Completion & Restoration:** If maintenance finishes ahead of schedule, clicking a slot provides a **"Shorten: Clear from here onwards"** option. All suspended user bookings in reopened slots are automatically restored to the calendar.
- **Non-blocking UX:** The entire flow runs without native browser popups to ensure smooth operation across all devices.

### 7. Door Code Change Notification
- **Targeted Notification**: When an Admin or Moderator updates the door code, a prominent floating toast alert smoothly slides down from the top of the viewport in real time (for logged-in users) or upon their next login.
- **Protected to Ongoing Paid Members**: Only accounts with an ongoing paid membership (`active` with valid expiry, or `approved_pending_start`), plus admins and moderators, see the notification and new code. Unapproved, expired, or non-paying users will not receive the notification banner (and their header badge continues to say "Door Code: Hidden").
- **Admin Testing Tool**: A dedicated **"🔔 Test Notification"** button in the Admin Dashboard allows admins to preview the exact alert at any time on demand.
- **Account-Aware Dismissal**: Acknowledging the banner records the seen timestamp per user account in local storage, preventing duplicate alerts across shared or multi-account devices.

---

## 🤖 Automatic Deployment (Magic Workflow)
We have moved from manual "Drag-and-Drop" to a fully automated professional setup:
- **GitHub Sync**: Your code now lives on GitHub in the `sauna-booking` repository.
- **Auto-Deploy**: Every time we make a change, the website updates instantly. No more manual work required!
- **Status Indicator**: Look for the **"● Live"** dot in your header—this confirms you are running the latest automated version.

---

## 🧪 Verification & Deployment
**The setup is now fully self-sustaining!** 
If you have any future requests or community feedback, feel free to reach out. I can now update your live site directly whenever we finish a new feature.

**Enjoy the steam and the community bookings!**
