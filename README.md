# EMS Console (Enterprise Management System)

An enterprise-style full-stack Employee Management System with strong workflow control across:
- Task lifecycle and approvals
- Meeting operations and attendance
- Review governance and performance snapshots
- Community feed, notices, and notifications
- Auditability and operational dashboards

This project is designed as a **working operations console**, not a basic CRUD app.

## Why This Project Is Different

Most student EMS projects stop at add/edit/delete employee flows.  
This system models real operational behavior:

- Approval-first workflows for sensitive task modifications
- SLA-aware request handling (pending, approved, executed, expired)
- Separate admin and employee control planes with role-specific actions
- Review acknowledgement and thread-based comment governance
- Operational analytics for quality, reliability, and response behavior
- Live counters + timeline-oriented visibility across modules

## Core Capabilities

### 1) Task Management & Oversight
- Full task lifecycle: assigned, accepted, in-progress, completed, verified, failed, reopened, declined, withdrawn, archived
- Admin-initiated and employee-initiated modification requests
- Request SLA windows and expiry handling
- Reopen and extension workflows
- Task discussion logs and activity timeline
- Request center with filtered queues

### 2) Meetings
- Create/schedule/reschedule/cancel meetings
- Recurrence support and template-based meeting creation
- Attendee RSVP and attendance marking
- Notes, action items, discussion, and recordings
- Meeting analytics and status tracking

### 3) Reviews & Performance
- Performance snapshots per employee
- Review publishing with edit windows
- Employee acknowledgement + comment threads
- Historical and current failure pattern analysis
- KPI and SLA composition visuals

### 4) Communication Layer
- Admin notices with audience targeting
- Community feed, comments, polls, and reactions
- In-app notifications and category-based views
- Contextual popups for pending actions

### 5) Governance & Audit Orientation
- Request IDs in backend logs
- Capability-aware operations for sensitive actions
- History and timeline visibility for key decisions

## Tech Stack

### Frontend
- React 18
- Vite
- React Router
- Tailwind CSS
- Recharts

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- Nodemailer (for email integrations)

## Project Structure

```text
.
├─ src/                     # React frontend
├─ backend/                 # Express API + business logic
│  ├─ routes/
│  ├─ middleware/
│  ├─ utils/
│  └─ scripts/
├─ uploads/                 # Uploaded assets (community/meeting files)
└─ README.md
```

## Quick Start

## Prerequisites
- Node.js 18+
- MongoDB (local or cloud)

## 1) Install dependencies

Frontend root:
```bash
npm install
```

Backend:
```bash
cd backend
npm install
```

## 2) Configure environment

Create `backend/.env` with at least:

```env
PORT=4000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

# Auth behavior
ALLOW_PUBLIC_ADMIN_SIGNUP=true
ENABLE_ADMIN_BOOTSTRAP=false

# Optional SLA/runtime controls
REOPEN_SLA_DAYS=2
MOD_REQUEST_SLA_CHECK_MINUTES=15
REOPEN_SLA_CHECK_MINUTES=15
ROUTE_DEBUG=false
```

If email is enabled, also set:
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `EMAIL_SECURE`

## 3) Run backend

```bash
cd backend
npm run dev
```

## 4) Run frontend

```bash
npm run dev
```

App URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- API Health: `http://localhost:4000/api/health`

## Scripts

### Frontend
- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build

### Backend
- `npm run dev` - run with nodemon
- `npm run start` - run with node
- `npm run repair:employee-ownership:dry` - ownership check (dry run)
- `npm run repair:employee-ownership:apply` - ownership repair

## Recommended Production Hardening

- Set `ALLOW_PUBLIC_ADMIN_SIGNUP=false`
- Enforce strong JWT secret rotation policy
- Lock CORS to trusted frontend domains
- Add rate limits for login/post/comment endpoints
- Enable periodic backups and retention policy
- Monitor request/error logs centrally

## Who This Is For

- B.Tech/MCA final-year major project showcase
- Internal operations dashboard prototype
- Workflow-oriented admin-employee platform demo

## Final Note

This project demonstrates both UI/UX depth and backend workflow rigor:
- not just CRUD
- not just charts
- but controlled, auditable, SLA-aware enterprise behavior.
