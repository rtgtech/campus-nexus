# Campus Nexus Requirements

## 1. Project Overview

Campus Nexus is a student-focused campus social hub. It provides a feed for campus updates, club discovery, student marketplace listings, mini-game discovery, chat views, and student profiles. The current implementation uses a Next.js frontend and a lightweight Flask demo backend with in-memory data.

## 2. Scope

The system is intended for students who want to discover campus activity, share posts, join or create clubs, browse student-to-student marketplace items, view games, and communicate with other students.

Current backend data is stored in memory and resets when the Flask server restarts. Persistent storage, authentication, role management, payment handling, and real-time messaging are outside the current demo implementation unless added later.

## 3. Users

- Student: Uses the platform to browse content, create posts, discover clubs, list or contact marketplace items, play games, chat, and view profiles.
- Club organizer: Creates and manages club listings and community information.
- Marketplace seller: Lists student items for sale or exchange.
- System administrator, future scope: Moderates users, posts, clubs, listings, and reports.

## 4. Functional Requirements

### 4.1 Navigation and Layout

- The system shall provide main navigation for Feed, Create Post, Clubs, Marketplace, Games, Chat, and Profile.
- The system shall provide responsive navigation for both desktop and mobile layouts.
- The system shall display the Campus Nexus brand consistently across pages.
- The system shall show a global search input in supported page headers.
- The system shall show notification and activity icons in supported page headers.

### 4.2 Campus Feed

- The system shall display a feed of campus posts.
- Each feed post shall show author, metadata, title, body, image, hashtag, like count, and comment count.
- The system shall display trending campus topics with labels, tags, and activity counts.
- The system shall display suggested people with names and academic or interest subtitles.
- The system shall allow a student to open a create-post overlay from the feed.
- The system shall allow a student to submit a new post with photo, caption, hashtags, and tagged people.
- The system shall send created post data to the backend through `POST /api/posts`.
- The system shall show a saving, success, or error state while creating a post.
- The system shall refresh the feed after a successful post submission.

### 4.3 Campus Pulse

- The system shall display a campus pulse or live-campus information panel on the feed.
- The system shall allow the campus pulse panel to be dismissed if supported by the UI component.

### 4.4 Clubs

    - The system shall display spotlight clubs with badges, titles, descriptions, images, and icons.
    - The system shall display a directory of club cards with banner images, title, description, member indicators, and status.
    - The system shall display club statistics such as new clubs, city clubs, members, and live activity.
    - The system shall provide category filters such as All Clubs, Tech, Culture, Sports, Food, and Wellness.
- The system shall allow a student to open a create-club overlay.
- The system shall allow a club organizer to submit club details including name, category, short description, full description, campus area, meeting mode, meeting schedule, contact email, banner URL, tags, membership type, and approval mode.
- The system shall send created club data to the backend through `POST /api/clubs`.
- The system shall show a saving, success, or error state while creating a club.
- The system shall refresh the clubs page after successful club creation.
- The system shall redirect `/club` to `/clubs`.

### 4.5 Marketplace

- The system shall display student marketplace listings.
- Each marketplace item shall show title, owner, listing mode, category, condition, price or contact label, location, description, image, and tags.
- The system shall provide marketplace filters such as All, Books, Electronics, Stationery, Hostel, Exchange only, and Contact price.
- The system shall allow a student to open a listing form for a new item.
- The listing form shall collect item name, listing type, category, condition, price, description, preferred exchange, pickup location, contact, photo URL, and tags.
- The backend shall support creating marketplace items through `POST /api/marketplace` and `POST /api/marketplace/items`.
- The backend shall normalize missing prices to `Contact`.
- The backend shall normalize comma-separated or array-based tags into a list.

### 4.6 Games

- The system shall display a games discovery page.
- The system shall show a featured weekly challenge with play and leaderboard actions.
- The system shall display game category tabs such as All Games, Multiplayer, Puzzle, Action, Social, and Tournaments.
- The system shall display game cards with image, title, online count, and rating.
- The system shall display top-rated games with rank, title, subtitle, rating, and badge.
- The system shall display recent game activity so students can jump back into previously viewed games.

### 4.7 Chat and Messages

- The system shall redirect `/messages` to `/chat`.
- The system shall display a chat interface with a conversation list and active message thread.
- Each conversation shall show name, preview or typing state, time, avatar, role, unread count if available, and active state.
- The active chat thread shall display incoming and outgoing messages.
- Messages shall show text, time, side, and read status where available.
- The chat interface shall include controls for search, compose, media actions, call/video/info actions, text input, and send button.
- The current demo shall display seeded chat data from the backend or fallback data.

### 4.8 Profile

- The system shall provide user profile pages based on the route `/:user`.
- The system shall format profile names from the URL slug.
- The system shall display avatar, name, major, bio, edit profile action, and share action.
- The system shall display an empty posts state when the user has not posted.
- The system shall fetch profile data from `GET /api/profile/<user>` and use fallback data if the backend is unavailable.

### 4.9 Backend API

- The backend shall provide `GET /health` for service health checks.
- The backend shall provide `GET /api/feed` for feed, trending, and suggested people data.
- The backend shall provide `POST /api/posts` for creating feed posts.
- The backend shall provide `GET /api/clubs` for spotlight clubs, club cards, and club stats.
- The backend shall provide `POST /api/clubs` for creating clubs.
- The backend shall provide `GET /api/games` for game cards, top-rated games, and recent activity.
- The backend shall provide `GET /api/marketplace` for marketplace listings.
- The backend shall provide `POST /api/marketplace` and `POST /api/marketplace/items` for creating marketplace listings.
- The backend shall provide `GET /api/messages` for chat conversations and messages.
- The backend shall provide `GET /api/profile/<user>` for basic profile data.
- The backend shall return JSON responses for API endpoints.
- The backend shall support CORS headers for local frontend-to-backend requests.

### 4.10 Fallback and Demo Behavior

- The frontend shall use local fallback data if the backend is unavailable or returns an error.
- The frontend shall default backend requests to `http://127.0.0.1:5000`.
- The frontend shall allow backend URL overrides using `CAMPUS_NEXUS_API_URL` for server-side fetches.
- Browser-side form submissions shall allow API URL overrides using `NEXT_PUBLIC_CAMPUS_NEXUS_API_URL`.
- Demo backend data shall be held in memory and may reset after server restart.

## 5. Non-Functional Requirements

### 5.1 Usability

- The interface shall be easy for students to navigate without training.
- Primary actions such as creating a post, creating a club, listing an item, opening chat, and viewing profile shall be visually discoverable.
- Forms shall provide clear labels, placeholders, and status messages.
- Error messages shall explain when the backend is unreachable.
- The system shall provide consistent visual language across feed, clubs, marketplace, games, chat, and profile pages.

### 5.2 Responsiveness

- The frontend shall support desktop and mobile layouts.
- Navigation shall adapt to desktop sidebar/header navigation and mobile bottom navigation where applicable.
- Content grids shall collapse appropriately on smaller screens.
- Overlays and forms shall remain usable on small screens with scroll support.

### 5.3 Performance

- Page data fetches should complete quickly for demo-sized datasets.
- The frontend should avoid stale API data by using no-store fetch behavior for demo API calls.
- Images should be sized and displayed in a way that does not break page layout.
- UI interactions such as opening overlays, navigating pages, and switching views should feel immediate on standard student devices.

### 5.4 Reliability and Availability

- The frontend shall continue to display fallback data when the backend is offline.
- The backend shall expose a health endpoint for quick availability checks.
- API failures during create actions shall not crash the frontend.
- In-memory data loss after backend restart shall be acceptable for the demo version and documented clearly.

### 5.5 Security

- The system shall avoid exposing secrets in frontend code.
- API base URLs shall be configurable through environment variables.
- User-submitted text should be treated as untrusted data.
- A production version should add authentication, authorization, input validation, rate limiting, persistent storage, and moderation controls.
- A production version should restrict CORS to approved origins instead of allowing all origins.

### 5.6 Privacy

- The system shall avoid collecting unnecessary personal data.
- Profile and chat data shown in the demo shall be sample data.
- A production version should define privacy rules for user profiles, messages, marketplace contact details, and uploaded media.

### 5.7 Maintainability

- Frontend data contracts should remain typed through TypeScript types.
- Shared demo data and API helpers should stay centralized in `lib`.
- Reusable layout and overlay behavior should remain in shared components.
- Backend endpoints should keep request parsing and response formats consistent.
- Future persistence should be added behind the same API contracts where possible.

### 5.8 Compatibility

- The frontend shall run with the project Node.js dependency stack defined in `package.json`.
- The backend shall run with Python and dependencies listed in `backend/requirements.txt`.
- The application shall support modern browsers used by students on desktop and mobile devices.

### 5.9 Accessibility

- Interactive controls should be keyboard reachable.
- Images should include meaningful alt text where practical.
- Form fields should have visible labels.
- Text contrast should remain readable against background colors.
- Focus states should be preserved or added for keyboard users.

### 5.10 Scalability

- The current demo supports small in-memory datasets only.
- A production version should replace in-memory storage with a database.
- A production version should add pagination or infinite loading for feeds, clubs, marketplace listings, messages, and games.
- A production version should use real-time infrastructure for live chat, notifications, and activity indicators.

## 6. Current Implementation Notes

- The frontend is implemented with Next.js, React, and TypeScript.
- The backend is implemented with Flask.
- The backend currently stores feed posts, clubs, and marketplace items in process memory.
- Feed post creation and club creation are wired from the frontend to the backend.
- The backend supports marketplace item creation, but the current marketplace page uses a demo-only listing form and static frontend listing data.
- Chat is currently a display/demo experience and does not send new messages to the backend.
- Games are currently discovery cards and calls to action; game play itself is not implemented.
- Authentication and persistent user sessions are not currently implemented.

## 7. Future Enhancements

- Add student authentication and profile ownership.
- Add persistent database storage.
- Add full CRUD operations for posts, clubs, marketplace items, and profiles.
- Add real-time chat and notifications.
- Add moderation and reporting workflows.
- Add search and filter behavior backed by API queries.
- Add file upload storage for post, club, profile, and marketplace images.
- Add tests for frontend routes, form submissions, and backend API endpoints.
