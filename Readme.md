# Hospital Appointment Management System

A complete single-hospital appointment system with three roles:

- Patient: signup/login, browse doctors, view available slots, book and cancel appointments
- Doctor: login, manage availability, view appointments
- Admin: login, create, edit, delete, and manage doctors

Tech stack:

- Frontend: React + React Router
- Backend: Node.js + Express
- ORM: Prisma
- Database: PostgreSQL (Supabase-compatible)
- Auth: JWT

Assumption kept intentionally simple:

- Doctor availability is recurring until changed
- The doctor chooses one recurring mode at a time:
  - `DAILY`: the same blocks apply every day
  - `WEEKLY`: the same blocks apply only on selected weekdays
- Full-day day offs can be added as date-specific overrides
- Appointment slots are generated in 15-minute intervals from the active recurring blocks

## Folder Structure

```text
.
├── backend
│   ├── prisma
│   │   ├── migrations/20260323190000_init/migration.sql
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src
│   │   ├── config/env.js
│   │   ├── controllers
│   │   ├── lib/prisma.js
│   │   ├── middlewares
│   │   ├── routes
│   │   ├── services
│   │   ├── utils
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend
│   ├── src
│   │   ├── components
│   │   ├── context
│   │   ├── pages
│   │   ├── services
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
├── package.json
└── Readme.md
```

## Prisma Schema

Primary schema file:

- `backend/prisma/schema.prisma`

Normalized models:

- `User`: shared identity table for PATIENT, DOCTOR, ADMIN
- `Doctor`: one-to-one extension of `User` for doctor-specific data
- `DoctorAvailability`: doctor recurring availability blocks with `DAILY` or `WEEKLY` mode
- `DoctorDayOff`: doctor full-day date override for a specific day off
- `Appointment`: patient bookings against doctors for a specific date and time

Important data rules:

- `User.email` is unique
- `Doctor.userId` is unique
- indexes are added for doctor/date and patient/date lookups
- double booking is blocked in two layers:
  - service-level booking validation
  - database-level partial unique index in `migration.sql` for active doctor/date/time bookings
- a patient can hold only one appointment per date, and a booked same-day appointment must be cancelled before another one can be booked

## Environment Setup

Backend:

1. Copy `backend/.env.example` to `backend/.env`
2. Set `DATABASE_URL` to your PostgreSQL or Supabase pooled connection
3. Set `DIRECT_URL` to the direct PostgreSQL connection for Prisma migrations
4. Set `JWT_SECRET`
5. Keep `CLIENT_URLS` aligned with the frontend origin you use in the browser

Frontend:

1. Copy `frontend/.env.example` to `frontend/.env`
2. Set `VITE_API_URL` if your backend is not running on `http://127.0.0.1:5001/api`

## Run Locally

Install dependencies:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Prepare Prisma and seed the admin user:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

Start both apps in separate terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Default seeded admin values come from `backend/.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Backend API Summary

Base URL: `/api`

Auth:

- `POST /auth/signup` - patient signup only
- `POST /auth/login` - login for patient, doctor, or admin

Admin:

- `GET /admin/doctors` - list doctors
- `POST /admin/doctors` - create doctor account
- `PUT /admin/doctors/:id` - update doctor account details
- `DELETE /admin/doctors/:id` - delete doctor account, recurring availability, day offs, and linked appointments

Doctor:

- `GET /doctor/schedules` - list recurring availability blocks and the active mode
- `POST /doctor/schedules` - replace recurring availability with the submitted daily or weekly setup
- `DELETE /doctor/schedules/:id` - remove one recurring availability block if no booked slot depends on it
- `GET /doctor/day-offs` - list future day offs
- `POST /doctor/day-offs` - add a full-day override for one date
- `DELETE /doctor/day-offs/:id` - remove a day off
- `GET /doctor/appointments` - list own appointments

Patient:

- `GET /patient/doctors` - list doctors
- `GET /patient/doctors/:doctorId/slots?date=YYYY-MM-DD` - list open slots for a doctor on today or a future date based on recurring availability, day offs, existing bookings, and passed time for today
- `GET /patient/appointments` - list own appointments
- `POST /patient/appointments` - book an appointment on today or a future date if the patient has no other appointment on that same date
- `PATCH /patient/appointments/:id/cancel` - cancel own appointment

## Frontend Pages

- `/login`
- `/signup`
- `/patient`
- `/doctor`
- `/admin`

Role-based routing is enforced on the client and the server.

## Notes

- The system stays within the requested scope and does not include multi-tenant logic or external auth
- Booking is auto-confirmed immediately after validation
- A patient can have only one appointment per day
- Doctors are created by admins only
- Admin doctor deletion removes the doctor's recurring availability, day offs, and appointments through database cascades

## Deployment

Recommended split:

- Frontend on `Vercel`
- Backend on `Render`
- Database on `Supabase`

Live URLs:

- Frontend: `https://frontendojtsem2.vercel.app`
- Backend: `https://ojt-sem2.onrender.com`
- Backend health: `https://ojt-sem2.onrender.com/api/health`

### Frontend on Vercel

Project settings:

- Framework preset: `Vite`
- Root directory: `frontend`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Environment variables:

- `VITE_API_URL=https://ojt-sem2.onrender.com/api`

Notes:

- `frontend/vercel.json` is included so React Router routes rewrite to `index.html`
- after your backend is live on Render, redeploy the frontend with the final backend URL
- live frontend URL: `https://frontendojtsem2.vercel.app`

### Backend on Render

Create a `Web Service` with:

- Root directory: `backend`
- Runtime: `Node`
- Build command: `npm install && npm run prisma:deploy`
- Start command: `npm start`

Environment variables:

- `DATABASE_URL` = Supabase pooled connection string
- `DIRECT_URL` = Supabase direct connection string
- `JWT_SECRET` = strong random secret
- `PORT` = leave blank or set by Render automatically
- `CLIENT_URLS` = `https://frontendojtsem2.vercel.app`
- `SLOT_INTERVAL_MINUTES` = `15`
- `ADMIN_NAME` = your admin display name
- `ADMIN_EMAIL` = admin login email
- `ADMIN_PASSWORD` = admin login password

Notes:

- `backend/package.json` includes `postinstall: prisma generate`, so Prisma Client is generated during Render install
- `npm run prisma:deploy` applies Prisma migrations during the Render build
- if you later add a custom frontend domain, also add it to `CLIENT_URLS`
- live backend URL: `https://ojt-sem2.onrender.com`
