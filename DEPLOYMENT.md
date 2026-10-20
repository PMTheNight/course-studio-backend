# Live deployment

Deployed and checked on 20 October 2026.

- Website: https://course-studio-web-lovat.vercel.app
- Backend: https://course-studio-api.vercel.app
- Frontend dashboard: https://vercel.com/pmthenight/course-studio-web
- Backend dashboard: https://vercel.com/pmthenight/course-studio-api

Both Vercel production builds succeeded. The frontend forwards `/api` to the backend and uses first-party secure session cookies. Backend production settings include MONGODB_URI, MONGODB_DB, JWT_SECRET and FRONTEND_ORIGINS. Database credentials and signing secrets are not included in this source package.

MongoDB Atlas uses the existing active FREE Cluster0 in Project 0. Database `course_studio` has an application user `course_studio_app` restricted to readWrite on that database. The user explicitly approved resuming the free cluster and a non-expiring `0.0.0.0/0` network entry for Vercel connectivity. That network entry permits connection attempts from all IPv4 addresses to the project; database authentication and user permissions still apply.

Three students, three teachers and three sample courses were seeded. See README for demonstration credentials. Browser testing enrolled student1 in Modern Web Development; this enrollment is intentionally retained for demonstration.

## Live verification

- Chrome: student sign-in, course detail, successful enrollment, disabled duplicate button, My learning, and session restoration after reload.
- API through the public frontend proxy: all six accounts sign in, teacher-name search, duplicate enrollment returns 409, owning teacher can access details, another teacher receives 404, current-session lookup, logout, and revoked-cookie rejection.
- Public frontend and backend return 200 without Vercel authentication.
- Local full suite: 13 tests passed, including concurrency; see VERIFICATION.md.

Deployment used the official Vercel CLI. Source repositories: https://github.com/PMTheNight/course-studio-backend and https://github.com/PMTheNight/course-studio-frontend. Automatic deployment integration has not been configured. Future source edits require another CLI deployment or a Git integration. Student name/ID and the required examination recording remain submission tasks.
