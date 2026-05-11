# PHStock — Cold Storage Inventory Ledger

A full-stack web application for managing potato cold storage inventory. Built to replace a paper register system for a potato export business operating across multiple cold storage locations.

---

## What it does

PHStock tracks the daily movement of potato bags across cold storage locations — recording intake, outflow, grades, weights, and reference numbers. It generates live stock snapshots, period reports, and a digital version of the traditional paper register.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Charts | Recharts |
| Backend | Python + FastAPI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |

---

## Features

### Dashboard
- Live current stock snapshot per location and grade
- Donut chart showing grade breakdown
- Stacked bar chart showing stock by location
- KPI cards: total stock, grade A bags, grade count, active locations
- Line chart showing intake and outflow over the last 7 days

### Add Entry
- Record intake or outflow movements
- Select cold storage location and grade
- Input bag count, unit weight (auto-calculates total weight)
- Reference number and remarks fields
- Date defaults to today in IST (Asia/Kolkata)
- Workers are locked to their assigned location

### History
- **Movements view** — every individual intake/outflow entry
- **Register view** — daily ledger aggregated by date + location + grade, matching the paper register format (Opening → New Stock → Total → Sold → Closing)
- Filters: location, grade, date range, movement type
- Search by grade, location, date, reference number
- Pagination (10 entries per page)
- Admin can edit and delete entries

### Reports
- Period filters: daily, weekly, monthly, custom date range
- Location filter
- KPI summary: total in, total out, net change
- Bar charts: intake by grade, outflow by grade
- PDF export

### User Management (Admin only)
- Create worker and admin accounts with username + password
- Assign workers to specific cold storage locations
- Workers can only view and add entries for their assigned location
- Delete accounts

---

## Roles

| Role | Access |
|---|---|
| Admin | Full access — all pages, edit/delete entries, user management |
| Worker | Add Entry only, locked to assigned location |

---

## Project Structure

```
PHStock/
├── frontend/          # React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AddEntry.jsx
│   │   │   ├── History.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── UserManagement.jsx
│   │   │   └── Login.jsx
│   │   ├── components/
│   │   │   └── Toast.jsx
│   │   ├── App.jsx
│   │   ├── supabaseClient.js
│   │   └── index.css
│   └── .env           # VITE_SUPABASE_URL, VITE_SUPABASE_KEY
│
└── backend/           # FastAPI app
    ├── main.py
    ├── requirements.txt
    └── .env           # SUPABASE_URL, SUPABASE_SERVICE_KEY
```

---

## Database Schema

```
locations          — cold storage sites
grades             — potato grades (A, B, C, D, etc.)
profiles           — user roles and location assignments
inbound_shipments  — truck arrivals (date, location, ref number, remarks)
inbound_items      — grade breakdown per shipment
outbound_shipments — export departures (date, location, ref number, remarks)
outbound_items     — grade breakdown per shipment
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Supabase project

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env`:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_KEY=your_anon_key
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Create `backend/.env`:
```
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
```

---

## Deployment

- **Frontend** → Vercel (auto-deploys on push to main)
- **Backend** → Render (auto-deploys on push to main)

Add environment variables in each platform's dashboard.

---

## Login

Usernames are used instead of emails. Internally stored as `username@phstock.local`. Workers only see the Add Entry page for their assigned location. Admins see everything.

---

## Built by

Suzan Tadha — BS Computer Science, University of Illinois Chicago
