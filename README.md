> This repository contains the backend application at its root. Clone both repositories into sibling folders named `course-studio-backend` and `course-studio-frontend`. The `cd` commands below assume you start in their parent folder; if already inside a repository, skip its `cd` command. Vercel Root Directory is `.` for each repository.

# Course Studio — Online Course Service

A complete Next.js API, React/Vite frontend, and MongoDB course service. Continues the supplied [starter repository](https://github.com/pop2518hotmailcom/wad-final-2026-01) at commit `847e6e444b006dc3c014c92c4307be8c9e9083db`.

The original `next-backend/` and `react-frontend/` architecture, API paths, `HashRouter`, user context, Tailwind/Vite setup, and helper modules are retained and completed. Next.js was upgraded from 16.3.1 to 16.4.2 to address published vulnerabilities. The default starter landing page was replaced with an API information page; the unused starter image assets remain.

## Student information and submission

- Student name: **Phyo Min Khaing**
- Student ID: **6715185**
- Backend source repository: https://github.com/PMTheNight/course-studio-backend
- Frontend source repository: https://github.com/PMTheNight/course-studio-frontend
- Backend deployed URL: https://course-studio-api.vercel.app
- Frontend deployed URL: https://course-studio-web-lovat.vercel.app

## Test credentials

The live deployment is already seeded. For a new database, run the seed command below first. All six demo accounts use **`CourseDemo2026!`**. Login accepts the username or email, case-insensitively.

| Username | Email | Role |
| --- | --- | --- |
| student1 | student1@example.com | Student |
| student2 | student2@example.com | Student |
| student3 | student3@example.com | Student |
| teacher1 | teacher1@example.com | Teacher |
| teacher2 | teacher2@example.com | Teacher |
| teacher3 | teacher3@example.com | Teacher |

The seed also adds three courses belonging to different teachers. It is idempotent and preserves existing users, passwords, course edits and enrollments. If an existing database already contains these usernames, their passwords are not overwritten. Use a fresh database for grading. These are public demonstration credentials; do not put real student data in a deployment using them.

## Prerequisites

- Node.js **22.12 or newer**, npm; tested with Node 24.11.1.
- MongoDB 7+ locally, or a MongoDB Atlas connection string. Single-node MongoDB is sufficient; transactions/replica sets are not required.
- Network access for package installation. Automated tests and the disposable demo download a MongoDB binary on their first run.

## Quick disposable demo

No Atlas account or existing database is needed for a local demonstration. The demo runs a real temporary MongoDB server and seeds it. All demo changes disappear when it stops.

Terminal 1:

```sh
cd course-studio-backend
npm ci
npm run demo
```

Terminal 2:

```sh
cd course-studio-frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** and sign in using one of the accounts above. The backend runs at **http://127.0.0.1:3000**. Keep both terminals running. The demo uses Webpack with file polling to work in restricted macOS environments where Turbopack's filesystem watcher is unavailable. Production builds use the normal Next.js build command.

## Persistent local setup

### 1. Backend (`next-backend/`)

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=online_courses
JWT_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it and the database URI out of Git. Ensure MongoDB is running, then:

```sh
npm run seed
npm run dev
```

If macOS reports `unable to start FSEvent stream`, use `WATCHPACK_POLLING=true npm run dev -- --webpack`.

### 2. Frontend (`react-frontend/`)

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Defaults:

```dotenv
VITE_API_URL=/api
BACKEND_URL=http://localhost:3000
```

The Vite proxy forwards `/api` to Next.js. Keep `VITE_API_URL=/api`: this keeps the HttpOnly authentication cookie on the frontend's origin. It also avoids browser restrictions on third-party cookies between separate Vercel domains. `BACKEND_URL` configures the local Vite proxy; Vercel uses its rewrite configuration instead.

## Testing walkthrough

1. Sign in as **teacher1**. Only teacher1's courses appear. Create a course with two seats, multiple topics, a duration, a price, and status **Open**.
2. Open its details, edit fields, and confirm the student roster is empty. An empty course may be deleted after confirmation.
3. Sign out; sign in as **teacher2**. Teacher1's course is absent from this workspace. Direct attempts to read, update or delete it through the API fail.
4. Sign in as **student1**. Search using part of the course name or `teacher1`, view details and enroll. The course appears under **My learning**. Reloading preserves the login session. A second enrollment is rejected.
5. Enroll **student2** in the same course. **student3** now sees that the course is full; the API also rejects enrollment.
6. Sign back in as **teacher1**. The course shows both students. Deleting it fails, and capacity cannot be reduced below the enrolled count.
7. Change the course to **Close**: it stays visible to students but cannot accept enrollment. Change to **Cancel**: it disappears from student discovery and My learning, and direct student access/enrollment fails. Existing enrollments remain stored and visible to its teacher; reopening restores student visibility.
8. Sign out. Protected requests fail; replaying the old session cookie also fails because the database session was revoked.

### Automated checks

```sh
cd course-studio-backend
npm run lint
npm run build
npm test
npm audit --omit=dev

cd ../course-studio-frontend
npm run lint
npm run build
npm audit
```

`npm test` starts an isolated, real MongoDB instance, seeds it, and starts the **built production API** on a random port. It does not read or modify the configured application database. Run `npm run build` first. `npm run test:unit` runs validation tests without MongoDB. Integration test binaries are cached under `/tmp/course-mongodb-binaries`; set `MONGOMS_DOWNLOAD_DIR` to override this for tests.

Tests cover six account logins, passwords/cookies, session restoration and revocation, invalid authentication, spoofed headers, role enforcement, cross-teacher access, validation, search, all statuses, roster privacy, CORS, deletion restrictions, idempotent seeding, 30 competing enrollment requests for one seat, 20 duplicate requests from one student, and concurrent capacity/deletion/status changes. CI runs lint, builds, and these tests.

## Architecture and data models

- `next-backend/src/app/api/`: existing login/logout, user, and course routes; added current-session and enrollment routes.
- `next-backend/src/lib/`: MongoDB connection pooling, JWT/session authentication, CORS, JSON responses and structured errors.
- `next-backend/src/models/`: course input/domain model and user/index initialization, using the starter's native MongoDB driver.
- `react-frontend/src/context/UserContext.jsx`: session restoration, login/logout and session expiry handling.
- `react-frontend/src/App.jsx`: HashRouter, student discovery/My learning, teacher workspace, details/roster, course creation/editing, login.

Collections:

| Collection | Key fields |
| --- | --- |
| users | `_id`, `username`, `email`, `passwordHash`, `role`, `createdAt` |
| courses | `_id`, `teacherId`, `name`, `duration`, `topics[]`, `price`, `maxStudents`, `status`, `studentIds[]`, timestamps |
| sessions | SHA-256 token hash `_id`, `userId`, `expiresAt` |
| loginAttempts | hashed account/window `_id`, `count`, `expiresAt` |

Unique indexes protect username/email; course indexes support teacher ownership and student membership. Session/login-attempt TTL indexes clean up expired records. The API checks session expiry directly and does not rely on TTL deletion timing. Seed creates these indexes. All new users are provisioned through seed; there is no public sign-up or role-changing endpoint.

### Concurrency rules

The course document is the single atomic boundary. Enrollment uses one `findOneAndUpdate` that requires `Open`, no existing student ID, and an array size below capacity; it adds the student with `$addToSet`. Capacity reduction checks the current array size in the update predicate. Delete requires an empty array in the delete predicate. Status changes update that same document. Thus concurrent operations serialize safely in MongoDB without a read-then-write window or separate enrollment counters. A concurrent close may occur immediately after a successful enrollment; that enrollment was valid at the moment it committed.

Input bounds are explicit: course name 120 characters; 1–30 topics of up to 100 characters; duration 1–3,650 whole days; capacity 1–10,000; price 0–1,000,000 USD with at most two decimals. Price is informational; no payment processing occurs.

### API reference

All endpoints except login require a valid HttpOnly `token` cookie. OPTIONS preflight does not require authentication. Errors have `{ "message": "..." }`; success responses use `{ user }`, `{ courses }`, `{ course }`, or `{ message }`.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ login, password }`; creates 8-hour session |
| POST | `/api/auth/logout` | Revokes session and clears cookie |
| GET | `/api/auth/me` | Current user |
| GET | `/api/user` | Current user only, as `{ users: [...] }` |
| GET | `/api/user/:id` | Own profile only |
| GET | `/api/course?q=...` | Teacher's own courses; students see non-cancelled courses; optional literal case-insensitive name/teacher search |
| GET | `/api/course?enrolled=true` | Student's non-cancelled enrolled courses |
| POST | `/api/course` | Teacher creates course; ownership comes from authentication |
| GET | `/api/course/:id` | Details; only owning teachers receive student roster |
| PUT | `/api/course/:id` | Owning teacher replaces all editable fields |
| PATCH | `/api/course/:id` | Owning teacher updates selected editable fields |
| DELETE | `/api/course/:id` | Owning teacher deletes only an empty course |
| POST | `/api/course/:id/enroll` | Student atomically reserves a seat |

Course body example:

```json
{
  "name": "Modern Web Development",
  "duration": 15,
  "topics": ["React", "Next.js", "MongoDB"],
  "price": 149,
  "maxStudents": 12,
  "status": "Open"
}
```

Never send ownership or student arrays: the API rejects protected fields. Status codes: 400 validation, 401 authentication, 403 role/origin/own-profile restriction, 404 unavailable/not-owned course, 409 duplicate/full/closed/capacity/delete conflict, 413 body too large, 415 wrong content type, 429 sign-in limit, 503 infrastructure/configuration failure. Login allows up to 30 attempts per normalized identifier in a 15-minute window using shared MongoDB counters. Production Internet services should add platform-level abuse controls appropriate to their traffic.

## Deployment: two projects on Vercel

Both projects are deployed and connected to MongoDB Atlas. See [DEPLOYMENT.md](DEPLOYMENT.md) for the live configuration. The following steps describe reproducing the deployment.

1. Create a MongoDB database and database user with read/write access to the application database. Configure network access for your deployment. Set `MONGODB_URI` and `MONGODB_DB` on the backend. Do not put them into frontend variables.
2. Import the backend source into Vercel with root **`.`** in the backend repository, framework **Next.js**, Node 24.x, install `npm ci`, build `npm run build`. Set `JWT_SECRET` to a new random secret of at least 32 characters and `FRONTEND_ORIGINS` to the exact frontend HTTPS origin (comma-separated origins are supported, no trailing slash/wildcards). Deploy and note its URL.
3. Run `npm run seed` from `next-backend/` with `.env.local` pointing to that same persistent MongoDB database. The seed is a one-time provisioning command, not an HTTP endpoint or build step.
4. In `react-frontend/`, run `npm run configure:vercel -- https://YOUR-BACKEND.vercel.app`. This replaces the explicit placeholder in `vercel.json` with a real external API rewrite. Commit that file before deploying. Do not deploy the placeholder as if it were a working URL.
5. Import frontend source with root **`.`** in the frontend repository, framework **Vite**, Node 24.x, install `npm ci`, build `npm run build`, output **`dist`**. Set `VITE_API_URL=/api`. HashRouter requires no SPA catch-all rewrite; the API rewrite forwards to the backend project.
6. Ensure `FRONTEND_ORIGINS` on the backend includes the final frontend origin, then redeploy the backend after environment changes. Authentication uses Secure, HttpOnly, SameSite=Lax cookies in production; the frontend proxy keeps them first-party. For direct cross-origin clients, the default Lax cookie requires same-site domains; use the supplied proxy for separate Vercel domains.
7. Verify login, reload, logout, course CRUD, search, enrollment and status changes on the public frontend. The public API page verifies only that Next.js is running, not database connectivity. The backend API must be reachable by the frontend rewrite; hosting authentication protection must not intercept those requests.
8. Record both deployed URLs and repository links above. If the submission requires separate repositories, publish each directory separately and copy this README into each. Keep secrets out of commits. Complete the required screen-recording submission separately.

### Verification and limitations

See [VERIFICATION.md](VERIFICATION.md) for actual check results and remaining deployment/submission requirements. Dependency locks are included. Database errors are returned without exposing connection strings. Account authorization always reloads the user's role from MongoDB, and each protected handler validates the session independently of the proxy. Student responses never contain other students' identities.
