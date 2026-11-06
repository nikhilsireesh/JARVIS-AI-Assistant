# JARVIS AI — Google Workspace Personal Assistant

JARVIS AI is a personal assistant that operates your Google Workspace through natural language. A Gemini model with function calling reads, sends and archives Gmail, manages Calendar events and reads/writes Google Sheets on your behalf, with OAuth tokens encrypted at rest, scheduled automations and an activity log of every AI action. The Next.js frontend provides a glassmorphic dashboard with chat, command palette and per-service views.


## 🚀 System Architecture Overview

```mermaid
graph TD
    User([User Browser]) <--> |HTTP/WS| NextJS[Next.js Frontend\nlocalhost:3000]
    NextJS <--> |REST API / JWT Session| ExpressJS[Express Backend\nlocalhost:5001]
    ExpressJS <--> |SQL| Postgres[(PostgreSQL Database)]
    ExpressJS <--> |OAuth 2.0 / API Calls| GoogleAPI[Google Workspace APIs\nGmail, Calendar, Sheets]
    ExpressJS <--> |API / Function Calls| Gemini[Google Gemini API]
```

### Key Technical Patterns
1. **Security & Cryptography**: All OAuth tokens are encrypted using **AES-256-GCM** via the `crypto` library prior to persistence in the database.
2. **Database Fallback Pattern**: The backend dynamically detects database availability. If PostgreSQL is offline or a URL is not provided, it automatically falls back to an embedded **SQLite** database, creating the schema and index structures automatically on startup.
3. **AI Function Calling Loop**: Gemini evaluates messages and requests function/tool invocations (e.g. `read_emails`, `create_calendar_event`, `append_sheet`). The backend routes these tool triggers to the Google APIs client, retrieves the results, feeds them back to Gemini, and streams the final response to the user via **Server-Sent Events (SSE)**.
4. **Holographic Particle HUD**: An interactive canvas-based animation rendering constellation particles linking nodes to the user's cursor at 60FPS with zero third-party packages.

---

## 📂 Project Structure

```
JARVIS-Personal-Assistant/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route Controllers (Auth, Chat, Workspace, Automations)
│   │   ├── middleware/      # Middlewares (Auth, ErrorHandler)
│   │   ├── routes/          # REST Router (api.ts)
│   │   ├── services/        # Business Logic (GoogleAuth, Gmail, Calendar, Sheets, Gemini, Encryption, Database, Automation)
│   │   ├── tools/           # AI Function Calling Declarations (workspaceTools.ts)
│   │   └── index.ts         # Bootstrapping Entrypoint
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/             # Next.js App Router (Layout, Page, CSS, Redirect Route)
    │   ├── components/      # UI components (Sidebar, Navbar, GlassCard, CommandPalette)
    │   │   └── views/       # Sub-Views (Dashboard, Chat, Gmail, Calendar, Sheets, Automation, Activity, Settings, Tasks, Notes)
    │   ├── context/         # Contexts (AuthContext)
    │   └── utils/           # API wrapper (api.ts)
    ├── postcss.config.mjs
    ├── next.config.ts
    ├── tsconfig.json
    └── package.json
```

---

## 🛠️ Environment Variables Configuration

Copy `backend/.env.example` to `backend/.env` and fill in the values (Google OAuth client from Google Cloud Console with the Gmail, Calendar and Sheets APIs enabled; Gemini key from Google AI Studio). The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local` (see `frontend/.env.example`); it must include the `/api` path, e.g. `http://localhost:5001/api`. The backend defaults to port 5001 because macOS AirPlay Receiver occupies port 5000.

```env
PORT=5001
NODE_ENV=development

# Leave blank to trigger SQLite automatic fallback:
DATABASE_URL=

JWT_SECRET=YOUR_JWT_SECRET
ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
FRONTEND_URL=http://localhost:3000
DEFAULT_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
```

---

## 💾 Database Schema

Tables created automatically on start-up (PostgreSQL or SQLite):
- **`users`**: Registers user emails and JSON preferences.
- **`oauth_credentials`**: Encrypted access/refresh tokens.
- **`conversations`**: Chat thread records.
- **`messages`**: Dialogue history.
- **`automations`**: Scheduled cron workflows.
- **`automation_logs`**: Durations, statuses, and outputs.
- **`activity_logs`**: Unified logs showing AI operations.

---

## 🤖 Registered AI Tools (Function Calling)

Gemini has access to these declarations:
1. **`read_emails`**: Summarizes Gmail inbox content.
2. **`send_email`**: Dispatches HTML emails to recipients.
3. **`archive_email`**: Archives threads.
4. **`delete_email`**: Trashes messages.
5. **`summarize_email`**: Fetches full email body for AI summaries.
6. **`list_events`**: Lists Calendar schedules.
7. **`create_calendar_event`**: books event blocks on the calendar.
8. **`delete_calendar_event`**: Removes meetings.
9. **`create_sheet`**: Initializes new spreadsheets.
10. **`append_sheet`**: Appends tabular data rows.
11. **`read_sheet_data`**: Reads specific sheet cells range.

---

## ⚡ Running Locally

Open two separate terminal instances in the project folder:

### Start the Backend Server:
```bash
cd backend
npm install
npm run build
npm start   # Runs on http://localhost:5001
```

### Start the Next.js Frontend:
```bash
cd frontend
npm install
npm run build
npm start   # Runs on http://localhost:3000
```

Open `http://localhost:3000`, click **Connect Workspace** and authorize your Google account; the assistant can then act on your Gmail, Calendar and Sheets from the chat.
