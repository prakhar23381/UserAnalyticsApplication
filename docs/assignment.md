# Assignment: Build a Simple User Analytics Application

## Objective

CausalFunnel builds products that help e-commerce businesses understand user behavior through session tracking and analytics.

As part of the hiring process for the **Full Stack Engineer** role, build a small full-stack application that tracks user interactions on a webpage and displays them in a dashboard.

## Requirements

### 1. Event Tracking (Client Side)

- Create a JavaScript tracking script that can be added to a webpage.
- Track the following events:
  - page_view
  - click
- Each event must include:
  - session_id (stored in cookie or localStorage)
  - event type
  - page URL
  - timestamp
  - click x/y coordinates (for click events)
- Send event data to the backend API.
- You may create a simple demo webpage to test tracking.

### 2. Backend (Node.js)

- Build a backend using **Node.js / Flask.**
- Implement APIs to:
  - Receive and store events.
  - Fetch a list of sessions with event counts.
  - Fetch all events for a specific session.
  - Fetch click data for a page (for heatmap).

### 3. Database

- Use **MongoDB** to store all data.
- Store events in a structured format suitable for querying.

### 4. Dashboard (Frontend)

Build a dashboard using **React / Next.js** with:

- **Sessions View**
  - List all sessions with total events.
  - Clicking a session shows the ordered list of events (user journey).
- **Heatmap View**
  - Select a page URL.
  - Display click positions visually (dots or simple grid).

## Submission Instructions

- Host the application (optional but preferred).
- Share a public GitHub repository with the source code.
- Include a README with:
  - Setup steps
  - Tech stack
  - Assumptions or trade-offs
