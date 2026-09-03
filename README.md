# Caspian Diabesity Expo 2026 website

Static site + Vercel serverless functions. Push to `main` deploys production (diabesityexpo.com). diabesityexpo.in and www.diabesityexpo.in 301 to the .com.

## Revenue funnel (Sept 2026)

| Path | What it does |
| --- | --- |
| `POST /api/register` | Free pass. Saves to Supabase `registrations` and emails a copy via FormSubmit. |
| `POST /api/create-order` | Razorpay order (amounts fixed server-side). Saves a `pending_payment` row so abandoned checkouts can be followed up. |
| `POST /api/verify-payment` | Verifies the Razorpay signature and marks the row `paid`. |
| `POST /api/sponsor-lead` | Stall / sponsor / CSR enquiry into `sponsor_leads`. |
| `/admin` | Expo Desk: revenue tiles, registrants, abandoned checkouts, sponsor leads, WhatsApp follow-up links, CSV export. Passcode set on first visit (stored hashed in Supabase `admin_config`). |

Short links: `/register`, `/passes`, `/sponsor`, `/exhibit`.

### Data

Supabase project `diabesityexpo` (Caspian Branding org, Mumbai). Tables: `registrations`, `sponsor_leads`, `events`, `admin_config`; view `revenue_summary`. Row Level Security: the public key may only INSERT free registrations and sponsor leads; everything else goes through the service role on the server or the passcode-protected `admin_*` RPCs.

### Environment variables (Vercel, Production)

| Name | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Payments (set). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** for paid-pass rows (pending and paid) and for returning row ids. Without it, free registrations and sponsor leads are still saved; paid passes are only in Razorpay. Copy from Supabase > Project Settings > API keys, paste in Vercel, redeploy. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Optional overrides; defaults are baked in. |

### Analytics

GA4 `G-7XDYZ4FNXN` with events `generate_lead` (free pass, sponsor), `select_item`, `begin_checkout`, `purchase` (thanks page, once per payment id), `checkout_abandoned`, `payment_failed`, plus `data-track` clicks (CTAs, WhatsApp, prospectus). Vercel Web Analytics enabled; the same events are mirrored with `window.va`.

## Editing

- Venue: replace "venue announcement soon" in `index.html` (hero `.meta`) and the `location` block in the JSON-LD.
- Agenda and speakers: `#agenda` section.
- Pass prices: `api/create-order.js` (`PASSES`), `index.html` (cards, `PASS_PRICE`, JSON-LD offers), `thanks.html` (`price`).
- Prospectus PDF: `assets/CASPIAN-Diabesity-Expo-2026-Prospectus.pdf`.
