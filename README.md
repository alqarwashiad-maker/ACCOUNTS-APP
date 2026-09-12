# Payflow Oman

Full-stack payroll starter based on the supplied salary workbook.

## Run locally

1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Set a real `SESSION_SECRET` before shared use.
4. Run `npm start` and open `http://localhost:3000`.

The seeded local account is `payroll@company.om` / `payflow`. Change it before deployment with a proper user-management flow. Data is stored in `data/payflow.sqlite`.

## Android WebAPK / installable web app

The app includes `manifest.webmanifest`, `sw.js`, and a branded icon. Deploy the full stack over HTTPS, open the URL in Chrome on Android, then choose **Install app**. Chrome will create the Android WebAPK automatically. Opening `index.html` directly with `file://` cannot create a WebAPK and cannot call the backend APIs.

## Backend included

- Password hashing with Node `scrypt`, HTTP-only session cookie, and Helmet security headers.
- SQLite persistence for users, employees, payroll runs, salary payments, and audit events.
- Authenticated dashboard and payment APIs.
- Server-side net salary calculation; the browser display is not trusted.
- Working-days or calendar-days proration, editable period days, earnings, deductions, and social security.

Before production, have an Oman payroll specialist confirm wage protection, leave, overtime, end-of-service, social protection, deduction limits, and nationality-specific rules. Add CSRF protection, rate limiting, encrypted backups, MFA, approval permissions, bank-file controls, and automated tests before handling real payroll.
