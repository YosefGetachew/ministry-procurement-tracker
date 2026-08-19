# Ministry of Agriculture — Procurement Tracking System

A procurement planning, approval, progress-tracking, contract-follow-up, and reporting system,
built against **SDD v1.2** (`MoA_Procurement_Tracking_System_SDD_v1.2_Updated_Workflow_and_Diagrams.pdf`).
The implementation covers the core structural workflow plus STEP-aligned activity planning,
sector/project hierarchy, contract/payment controls, password change, dashboards, and PDF/XLSX reports.

- **Backend**: Node.js + Express + PostgreSQL (REST API) — the SDD specifies Next.js/Prisma/Passport
  (§4.2); this build keeps the repo's existing Express/node-pg/React-Vite stack instead, by explicit
  choice, and rebuilds the domain model and workflow to match the SDD on top of it.
- **Frontend**: React + Vite, role-aware (Officer / Director / Committee / Admin)
- **Database**: PostgreSQL, running locally

```
ministry-procurement-tracker/
├── backend/
│   ├── server.js
│   ├── constants.js            Categories, methods, stage templates, category fields (SDD §7.5/11.4)
│   ├── schema.sql               Table definitions: users, projects, plans, activities, stages,
│   │                             committee, contracts, payments, alerts
│   ├── seed.sql                  One demo user per role + a demo project/assignment
│   ├── middleware/{requireAuth,requireRole}.js
│   └── routes/{auth,projects,myProjects,officers,assignments,plans,stages,contracts,alerts,dashboard,admin}.js
├── frontend/
│   └── src/
│       ├── auth/AuthContext.jsx
│       ├── components/          Shared UI (Sidebar, Topbar, PlanDetailDrawer, StatusBadge…)
│       ├── views/{officer,director,committee,admin}/  One view per role screen
│       └── Dashboard.jsx        Composition root — role-scoped nav + data loading
├── docker-compose.yml            Optional: spins up PostgreSQL in a container
└── README.md
```

## 1. Prerequisites

- [Node.js](https://nodejs.org) 18 or later (`node -v` to check)
- PostgreSQL 14+ running locally — either:
  - an existing local install, **or**
  - [Docker](https://www.docker.com/) (use the included `docker-compose.yml`)

## 2. Set up the database

**Option A — you already have PostgreSQL installed:**

```bash
createdb moa_procurement
psql -d moa_procurement -f backend/schema.sql
psql -d moa_procurement -f backend/seed.sql
```

**Option B — use Docker (no local PostgreSQL needed):**

```bash
docker compose up -d
# wait a few seconds for the container to start, then:
psql -h localhost -p 5434 -U postgres -d moa_procurement -f backend/schema.sql
psql -h localhost -p 5434 -U postgres -d moa_procurement -f backend/seed.sql
# password is "postgres" when prompted
```

`schema.sql` is a **breaking rewrite** — it drops and recreates every table (fine for a demo
database; there's no migration path from the old flat Plan/Procurement model).

For an existing SDD v1.2 database, apply the non-destructive additions instead:

```bash
psql -d moa_procurement -f backend/migrate-sdd-v1.2-compliance.sql
```

## 3. Run the backend

### Recommended: start the complete application

From the project root, use one command to start both the API and the web app:

```bash
npm start
```

Open **http://localhost:5173**. Keep this terminal open while using the application. If either
service stops unexpectedly, the combined runner stops the other service too, so the application
cannot be left in a misleading frontend-only state.

### Alternative: start each service separately

```bash
cd backend
cp .env.example .env
# edit .env if your PostgreSQL credentials differ from the defaults, and set JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste the output as JWT_SECRET= in .env
npm install
npm run dev
```

You should see:
```
Ministry of Agriculture procurement API running on http://localhost:4000
```

Verify it's connected: open http://localhost:4000/api/health — it should return `{"status":"ok","database":"connected"}`.

## 4. Run the frontend separately

In a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — you'll land on a sign-in screen (Vite proxies `/api` to
`http://localhost:4000`, so there's nothing else to configure).

### Signing in

`seed.sql` creates one account per role plus a full five-member committee, all with the password
**`changeme123`**:

| Email | Name | Role |
|---|---|---|
| admin@moa.gov.et | System Administrator | Admin |
| director@moa.gov.et | Tsegaye Alemu | Procurement Director |
| abebe.kassa@moa.gov.et | Abebe Kassa | Procurement Officer (assigned to the demo project) |
| selamawit.tesfaye@moa.gov.et | Selamawit Tesfaye | Procurement Officer (unassigned — demonstrates the authorization denial path) |
| meron.girma@moa.gov.et / dawit.alemayehu@moa.gov.et / hana.yohannes@moa.gov.et / bereket.solomon@moa.gov.et / rahel.getachew@moa.gov.et | — | Management Committee (5 active members) |

**Change or remove these accounts before any real use.** Admins can create/deactivate users and
change roles from the **Users** screen; insert users directly via SQL with
`INSERT INTO users (name, email, password_hash, role) VALUES ('Name', 'email@example.com',
crypt('a-real-password', gen_salt('bf')), 'officer');`.

## Using the system

Navigation is role-scoped (SDD §11.1) — each account only sees the screens its role can act on:

- **Officer** — My Projects (read-only, Director-assigned) → Plans (create a category-specific plan,
  add activities — the procurement method auto-generates the activity's stage roadmap — then submit
  to the Director) → once a plan is **Finally Approved**, its Plan Detail view lets you set/replan
  stage target dates and register contracts & payments → Alerts.
- **Director** — Projects (create projects, assign Officers) → Plans (Ministry-wide list; open a
  `SUBMITTED_TO_DIRECTOR` plan to Approve/Return/Reject — Return and Reject require a comment; the
  same Plan Detail view shows live committee vote tallies for plans further along) → Alerts.
- **Endorsing Committee Member** — independently votes on Director-approved plans. Three approvals
  advance a plan to Ministry Management; three rejections stop it.
- **Ministry Management Member** — provides final approval, with an optional comment, or rejection,
  with a mandatory reason.
- **Admin** — registers and manages both committee types. Registration generates a temporary password,
  sends an invitation, and requires the member to change it at first sign-in.

### Committee invitation email

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM`, and
`APP_LOGIN_URL` in `backend/.env` for live delivery. Without SMTP, development invitations are written
to `backend/outbox/` as `.eml` files and are not externally delivered.

### Defaults used for the SDD's open decisions (§20.2)

The SDD explicitly leaves several business rules for the Ministry to confirm. This build picks a
default for each so the workflow isn't blocked — override in `backend/routes/plans.js` /
`backend/constants.js` once the Ministry decides:

| Decision | Default used |
|---|---|
| Committee rejection rule | Three rejection votes reject the plan |
| Committee scope | One Ministry-wide committee, exactly 5 active members |
| Multiple roles | One role per user account |
| Approved-plan amendments | After Final Approval, plan/activity core fields lock; only stage tracking, replanning, and contract/payment registration remain editable |
| Reference pattern | Plan: `{ProjectCode}-{FiscalYear}-{CategoryCode}-{seq}`. Activity: `{PlanReference}-A{seq}` |
| Official report columns | STEP-aligned preview plus PDF/XLSX exports; final labels/order still require Procurement Directorate confirmation |

## API reference

All endpoints are served from `http://localhost:4000`. Everything except `/api/health`, `/api/meta`,
and `/api/auth/*` requires a valid session cookie (sign in via `POST /api/auth/login` first); most
routes are further role-gated (see `backend/middleware/requireRole.js` and each route file).

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` \| `/logout` | Session lifecycle |
| POST | `/api/auth/change-password` | Replace a temporary password |
| GET | `/api/auth/me` | Current signed-in user (incl. role) |
| GET | `/api/meta` | Categories, methods, stage templates, category fields, statuses |
| GET/POST/PUT | `/api/projects` | Director: list/create/update projects |
| GET | `/api/my-projects` | Officer: active assigned projects |
| GET | `/api/officers` | Director: active Officers, for the assignment picker |
| POST | `/api/projects/:id/assignments`, PATCH `/api/assignments/:id` | Director: assign/deactivate an Officer |
| GET/POST/PUT | `/api/plans` | Officer: create/edit category-specific plans in assigned projects |
| POST | `/api/plans/:id/activities` | Officer: add an activity (generates its stage roadmap from the method template) |
| POST | `/api/plans/:id/submit` | Officer: submit to the Director |
| POST | `/api/plans/:id/director-review` | Director: Approve (→ committee) / Return / Reject |
| POST | `/api/plans/:id/votes` | Committee: cast one Approve/Reject vote |
| POST | `/api/plans/:id/management-decision` | Ministry Management: final approve/reject |
| GET | `/api/plans/:id/approval-summary` | Director decision + committee tally |
| PATCH | `/api/stages/:id`, POST `/api/stages/:id/replan` | Officer: track/replan a stage (post-approval) |
| GET/POST | `/api/suppliers`, `/api/contracts`; POST `/api/contracts/:id/payments` | Officer registers contracts/payments |
| GET | `/api/alerts`; PATCH `/api/alerts/:id/read` | Recipient-scoped workflow notifications |
| GET | `/api/dashboard` | Role-scoped summary counts |
| GET | `/api/reports/:code/preview`, `/api/reports/:code/export` | Preview and export PDF/XLSX reports |
| GET/POST/PATCH | `/api/admin/users`, `/api/admin/committees` | Admin committee registration and membership |
| GET | `/api/health` | Backend + database health check |

## Remaining SDD items

Items still requiring a later implementation or Ministry decision:

- Ethiopian/Gregorian dual-entry calendar conversion (§9); canonical Gregorian storage is implemented.
- Scheduled overdue/contract-due alert refresh jobs; delay is currently calculated on read.
- Full configurable Admin UI for methods, stage templates, controlled values and reference patterns.
- Final Procurement Directorate approval of official report column labels/order.
- The SDD-selected Next.js/TypeScript/Prisma/Passport/Argon2 stack; this repository deliberately
  retains its existing React-Vite/Express/node-postgres/JWT-cookie/bcrypt implementation while
  enforcing the specified business workflow.

## Notes for production use

- Set `NODE_ENV=production` so session cookies are marked `Secure`, and serve the app over HTTPS
- Rotate `JWT_SECRET` and every seeded demo account's password
- Use environment-specific `.env` files and a managed PostgreSQL instance
- Run `npm run build` in `frontend/` and serve the static output behind a real web server (e.g. nginx) rather than Vite's dev server
