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

---

## 🚀 Deployment Instructions (Netlify)

Since this stack is 100% serverless (Vanilla HTML, CSS, JS), you can deploy it in 60 seconds:

1. Locate the local folder `Sauna_booking` containing `index.html`, `app.js`, and `styles.css`.
2. Go to **[Netlify Drop](https://app.netlify.com/drop)** in your browser.
3. Drag and drop the exact folder into the circle.
4. Go to **Site Settings > Domain Management**.
5. Add your custom subdomain **`boka.tranholmen.se`** and map your DNS records to the provided Netlify address.
6. The moment you push your DNS mapping over, Netlify generates a secure, permanent, free SSL certificate. It is now fully live to your community.
