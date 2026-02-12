# FixItNerd

Customer request intake, admin estimates, Stripe Checkout, and a Kanban queue built with plain HTML/CSS/JS, Netlify Functions, and Supabase.

## Project structure
```
/
  index.html
  pricing.html
  request.html
  request-status.html
  /admin/
    login.html
    queue.html
    request.html
  /account/
    login.html
    orders.html
  /assets/
    css/
    js/
  /netlify/functions/
  /supabase/
```

## Setup
### 1) Create a Supabase project
- Create a new project in Supabase.
- In SQL editor, run `supabase/schema.sql` then `supabase/rls.sql`.
- Optional: create a Storage bucket for future file uploads.

### 2) Configure Netlify environment variables
Copy `.env.example` into Netlify environment settings. Do not expose secret keys in the frontend.

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_FROM`
- `ADMIN_EMAILS` (comma-separated allowlist) or `ADMIN_NOTIFY_EMAIL`
- `NETLIFY_SITE_URL`

Optional:
- `SUPABASE_ANON_KEY` (for future client-side Supabase use)
- `STRIPE_PUBLIC_KEY`
- `EMAIL_PROVIDER` (`resend` or `sendgrid`)
- `RESEND_API_KEY` / `SENDGRID_API_KEY`
- `FEATURE_AI_PREVIEWS`
- `FEATURE_CUSTOMER_ACCOUNTS`

### 3) Configure Stripe webhook
Create a webhook endpoint in Stripe pointing to:
`https://<NETLIFY_SITE_URL>/.netlify/functions/stripe-webhook`

Subscribe to at least:
- `checkout.session.completed`

### 4) Configure Netlify Identity
- Enable Netlify Identity.
- Invite admin emails (must match `ADMIN_EMAILS` or `ADMIN_NOTIFY_EMAIL`).
- Admin pages are protected with JWT verification in functions.

## End-to-end flow checklist
1. Open `/request.html`, submit a request.
2. Confirm customer receives a confirmation email and a status link.
3. Log in at `/admin/login.html`.
4. Review queue at `/admin/queue.html`.
5. Open a request, add estimate line items, save.
6. Send invoice and confirm Stripe Checkout link is created.
7. Complete payment in Stripe; webhook marks request as `PAID`.
8. Confirm customer/admin receive payment emails.

## Feature flags
- `FEATURE_AI_PREVIEWS`: When true, admin can request AI previews for 3D printing. The function currently returns a stub response until image generation is configured.
- `FEATURE_CUSTOMER_ACCOUNTS`: When true, customer account pages can be wired to authentication. Currently placeholder pages are provided.

## Local development
Run Netlify dev server:
```
/opt/buildhome/node-deps/node_modules/.bin/netlify dev
```

## Notes
- Public request tracking is handled via `public_id` through Netlify Functions.
- Admin operations only use Supabase service role key through functions.
