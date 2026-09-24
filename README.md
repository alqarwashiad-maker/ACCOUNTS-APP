# Qarwashi Core

A Next.js operations workspace for AL QARWASHI INTERNATIONAL TRADING SPC covering HR, attendance, payroll, WPS preparation, invoicing, and executive reporting.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard or [http://localhost:3000/login](http://localhost:3000/login) for the login surface.

## Included foundation

- Role-aware workspace navigation for Overview, People, Attendance, Payroll, and Invoices
- Responsive dashboard with payroll forecast, collection progress, alerts, employee payroll status, and capacity insights
- Interactive seeded views with search, period selection, filters, export feedback, and action feedback
- Backend route at `/api/dashboard` for the dashboard payload
- Login route ready to connect to an auth provider and persistent database

## Deploy through GitHub to Vercel

1. Create a GitHub repository and push this folder.
2. In Vercel, choose **Add New Project** and import the repository.
3. Keep the detected framework as **Next.js** and deploy with the default build command.
4. Add production auth/database environment variables when the backend is connected.

The current workspace deliberately uses local seed data so the user experience is immediately reviewable. The API route is the boundary for replacing those seeds with PostgreSQL/Prisma or a managed backend, and the login page is the boundary for Auth.js, Clerk, or another identity provider.
