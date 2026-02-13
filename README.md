# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

---

# EMS Console — Enterprise Management System

A workflow-driven full-stack Employee Management System built as an **operations console**, not a basic CRUD demo.
It models real enterprise behavior with approvals, SLAs, audit trails, and role-segregated control planes.

---

## 🚀 Key Differentiators

This project implements production-style operational controls:

* Approval-first task modification workflows
* SLA-aware request lifecycle (pending → approved → executed → expired)
* Separate admin and employee control planes
* Review acknowledgement with threaded discussion governance
* Failure pattern and performance analytics
* Timeline-based activity visibility across modules

---

## 🧩 Core Modules

### 1. Task Management & Oversight

* Full lifecycle: assigned → accepted → in-progress → completed → verified → failed → reopened → declined → archived
* Admin- and employee-initiated modification requests
* SLA windows with automatic expiry handling
* Reopen and extension workflows
* Task discussion logs and activity timeline
* Centralized request queue with filters

### 2. Meetings

* Schedule, reschedule, cancel meetings
* Recurrence and template-based creation
* RSVP and attendance tracking
* Notes, action items, and recordings
* Meeting analytics and status monitoring

### 3. Reviews & Performance

* Employee performance snapshots
* Review publishing with controlled edit windows
* Acknowledgement + threaded comments
* Failure pattern analysis
* KPI and SLA composition visuals

### 4. Communication Layer

* Targeted admin notices
* Community feed with comments, polls, reactions
* In-app categorized notifications
* Contextual pending-action prompts

### 5. Governance & Audit Orientation

* Request IDs in backend logs
* Capability-aware sensitive operations
* Historical timelines for key decisions

---

## 🛠 Tech Stack

### Frontend

* React 18
* Vite
* React Router
* Tailwind CSS
* Recharts

### Backend

* Node.js + Express
* MongoDB + Mongoose
* JWT Authentication
* Nodemailer (email integration)

---

## 📁 Project Structure

```
.
├─ src/          # React frontend (Vite)
├─ backend/      # Express API + business logic
│  ├─ routes/
│  ├─ middleware/
│  ├─ utils/
│  └─ scripts/
├─ uploads/      # Runtime uploaded assets (ignored in Git)
└─ README.md
```

---

## ⚙️ Local Setup

### Prerequisites

* Node.js 18+
* MongoDB (local or Atlas)

---

### 1️⃣ Install Dependencies

Frontend (root):

```bash
npm install
```

Backend:

```bash
cd backend
npm install
```

---

### 2️⃣ Environment Configuration

Create `backend/.env`:

```env
PORT=4000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

ALLOW_PUBLIC_ADMIN_SIGNUP=true
ENABLE_ADMIN_BOOTSTRAP=false

REOPEN_SLA_DAYS=2
MOD_REQUEST_SLA_CHECK_MINUTES=15
REOPEN_SLA_CHECK_MINUTES=15
ROUTE_DEBUG=false
```

Optional email settings:

```env
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
EMAIL_SECURE=
```

---

### 3️⃣ Run Backend

```bash
cd backend
npm run dev
```

---

### 4️⃣ Run Frontend

```bash
npm run dev
```

---

## 🌐 Local URLs

* Frontend → [http://localhost:5173](http://localhost:5173)
* Backend → [http://localhost:4000](http://localhost:4000)
* API Health → [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 📜 Available Scripts

### Frontend

* `npm run dev` — Vite dev server
* `npm run build` — Production build
* `npm run preview` — Preview build

### Backend

* `npm run dev` — Nodemon server
* `npm run start` — Node server
* `npm run repair:employee-ownership:dry` — Ownership audit (dry run)
* `npm run repair:employee-ownership:apply` — Ownership repair

---

## ☁️ Deployment Architecture

```
Frontend (Vercel) → Backend API (Render) → MongoDB Atlas
```

### Frontend (Vercel)

* Framework: Vite
* Build command: `npm run build`
* Output directory: `dist`
* Set environment variable:

  ```
  VITE_API_BASE_URL=https://your-render-backend-url
  ```

### Backend (Render)

* Root directory: `backend`
* Build command:

  ```bash
  npm install
  ```
* Start command:

  ```bash
  npm start
  ```
* Add environment variables from `.env`
* Ensure server uses:

  ```js
  const PORT = process.env.PORT || 4000;
  ```

### Database (MongoDB Atlas)

* Use cloud connection string in `MONGO_URI`
* Whitelist Render IP or allow `0.0.0.0/0` for testing

---

## 🔒 Production Hardening Checklist

* Disable public admin signup
* Enforce strong JWT secret rotation
* Restrict CORS to trusted frontend domains
* Apply rate limits on auth and write endpoints
* Enable centralized logging and backups

---

## 🎯 Target Use Cases

* B.Tech / MCA final-year major project
* Workflow-oriented admin console prototype
* Internal operations dashboard demo

---

## 📌 Summary

This system demonstrates:

* Workflow governance
* SLA-aware processing
* Role-based operational control
* Audit-ready timelines

It moves beyond CRUD into **enterprise-style operational design**.
---

## 👤 Author

**Jyoti Yadav**  
Owner & Developer — EMS Console  

GitHub: https://github.com/jyoti24703-netizen

---

## 📄 License

This project is developed for academic and demonstration purposes.



