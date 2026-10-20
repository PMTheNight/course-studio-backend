# Verification report

Verified on 20 October 2026 (Asia/Bangkok), using Node.js 24.11.1, Next.js 16.4.2 and Vite 8.2.1.

## Completed

- Correct starter cloned from `pop2518hotmailcom/wad-final-2026-01`, commit `847e6e444b006dc3c014c92c4307be8c9e9083db`. The earlier URL omitted the owner's first `p`.
- Read `INSTRUCTION.md`, starter README, backend agent instructions and installed Next.js route/proxy documentation. Retained the starter directories, API route architecture, React HashRouter, context and supporting tooling.
- Implemented authentication, secure cookie sessions, revocable logout, role checks, own-profile access and teacher ownership in backend handlers.
- Implemented validated course CRUD, student search by partial course/teacher name, course details, teacher roster, My learning and all Open/Close/Cancel behaviors.
- Enrollment, capacity reductions and deletion predicates operate atomically on one MongoDB document; concurrency tests exercise the actual database.
- Added six seeded accounts, three sample courses, environment examples, two-project Vercel proxy configuration, disposable local demonstration, documentation and CI.

## Executed checks

| Check | Result |
| --- | --- |
| Backend `npm run lint` | Pass |
| Backend `npm run build` | Pass |
| Backend `npm test` | **13 passed, 0 failed, 0 skipped** |
| Frontend `npm run lint` | Pass |
| Frontend `npm run build` | Pass |
| Backend `npm audit --omit=dev` | 0 vulnerabilities |
| Frontend `npm audit` | 0 vulnerabilities |
| `git diff --check` | Pass |

The tests start the production Next.js server and a real isolated MongoDB binary. Important scenarios include: six account logins; session cookies, restoration and revocation; invalid/expired tokens and spoofed headers; cross-role and cross-owner denial; field validation; literal case-insensitive search; course states; roster privacy; non-empty deletion; capacity reductions; CORS/preflight; idempotent seed; 30 requests competing for one seat; 20 duplicate requests by one student; and enrollment racing with capacity change, deletion and closing.

## Browser verification

Performed in Chrome against the local React frontend and Next.js backend using the disposable MongoDB demo:

- Student sign-in, search by teacher name, details, successful enrollment, disabled duplicate-enrollment button, My learning, and restored login after reload.
- Sign-out, teacher sign-in, owned-course list, enrolled-student roster, disabled deletion for an enrolled course.
- Created `Browser QA Workshop` through the form and changed it from Open to Close through the edit screen.
- Checked short-window sidebar visibility and fixed an inaccessible sign-out control.
- Checked mobile layout with a 390 CSS-pixel viewport: document content width was 380 pixels, with no horizontal overflow. Reset viewport afterward.
- Browser console inspection returned no warnings/errors at the time checked.

Screenshots are delivered beside the source folder as `course-studio-preview.png` and `course-studio-mobile.png`. The local preview uses temporary demo data, including the course created during browser testing. The default seed remains the three documented sample courses. Automated integration tests use their own isolated database and leave no application data behind.

## Remaining limitations / external requirements

1. **Deployed to Vercel and connected to Atlas.** Production frontend: https://course-studio-web-lovat.vercel.app; backend: https://course-studio-api.vercel.app. Production environment settings are configured privately. The frontend rewrite targets the real backend. Six accounts and three courses are seeded. Live Chrome sign-in, enrollment and session restoration were checked; live API checks are recorded in DEPLOYMENT.md.
2. **Source published in two repositories:** https://github.com/PMTheNight/course-studio-backend and https://github.com/PMTheNight/course-studio-frontend.
3. **Student name, ID and examination recording are not supplied.** README identifies these fields explicitly. No examination recording is fabricated.
4. **Backend development audit reports five high findings in one lint dependency chain:** `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` (GHSA-vfj7-8cjw-p6xm). npm's offered fix downgrades the Next.js ESLint configuration to version 14, so that incompatible change was not applied. Runtime/production dependency audit is clean. Recheck for an upstream compatible lint-tool fix before wider distribution.
5. Local filesystem notifications were unreliable in this environment. The disposable backend demo uses Webpack polling; Vite development polling is enabled. Production builds succeeded with the standard toolchains.

The source builds without database secrets; runtime login/course operations require configured MongoDB and JWT settings. The demo provides an immediate local alternative without persistent database setup.
