# fixitnerd.com
Website containing services for 3D printing, IT support, software development, and tutoring.

## Setup & Deployment
1) Create a Supabase project.
2) Run `supabase/schema.sql` then `supabase/rls.sql` in the Supabase SQL editor.
3) Create Netlify environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PUBLIC_KEY`
   - `EMAIL_PROVIDER`
   - `RESEND_API_KEY`
   - `SENDGRID_API_KEY`
   - `EMAIL_FROM`
   - `ADMIN_NOTIFY_EMAIL`
   - `ADMIN_EMAILS`
   - `FEATURE_AI_PREVIEWS`
   - `FEATURE_CUSTOMER_ACCOUNTS`
   - `NETLIFY_SITE_URL`
4) Enable Netlify Identity and invite admin emails in the Identity tab.
5) Add the Stripe webhook URL:
   `https://<NETLIFY_SITE_URL>/.netlify/functions/stripe-webhook`
6) Test checklist:
   - Submit a request on `/request.html` and confirm Supabase records are created.
   - Verify the confirmation email and admin notification email.
   - Log into `/admin/login.html` and confirm queue loads.
   - Build an estimate, save it, and send the invoice.
   - Pay through Stripe Checkout and confirm the status updates to PAID.
   - Confirm `/request-status.html` shows estimate and payment status.
