# Caspian Diabesity Expo 2026 Website

Fast static site for diabesityexpo.com with Razorpay pass checkout, built for the
Caspian Healthcare Foundation. Same stack as caspianobesity.com: static pages plus
two Vercel serverless functions, deployed from GitHub with auto-deploy.

## What is in here

| File | Purpose |
|---|---|
| `index.html` | The whole site (single page, inline CSS/JS): hero, five points of view, offerings, track record, agenda, passes with Razorpay checkout, sponsor section, FAQ, footer |
| `thanks.html` | Post-payment confirmation page |
| `terms.html`, `privacy.html`, `refund.html` | Policy pages (Razorpay compliance) |
| `api/create-order.js` | Creates a Razorpay order server-side (amounts fixed in code: ₹499 / ₹1,999) |
| `api/verify-payment.js` | Verifies the payment signature (HMAC SHA256) |
| `assets/og-image.jpg` | WhatsApp/social link preview card (replace with real artwork any time) |
| `assets/CASPIAN-Diabesity-Expo-2026-Prospectus.pdf` | Sponsor prospectus download |
| `favicon.svg`, `robots.txt`, `sitemap.xml` | Basics |

## Deploy (about 20 minutes)

1. **GitHub**: create a repo (e.g. `oratorkhizer/diabesityexpo-site`) and push these files.
2. **Vercel**: Add New Project → import the repo (team "Caspian Branding" works fine).
   Before deploying, add Environment Variables:
   - `RAZORPAY_KEY_ID` = the Foundation's live key id
   - `RAZORPAY_KEY_SECRET` = the Foundation's live secret
   Deploy. Make one small test payment once live, then refund it from the Razorpay dashboard.
3. **GoDaddy DNS** (cutover, do this last):
   - In the Vercel project → Settings → Domains → add `diabesityexpo.com` and `www.diabesityexpo.com`.
   - In GoDaddy DNS for diabesityexpo.com: change the `A` record for `@` to `76.76.21.21`,
     and the `CNAME` for `www` to `cname.vercel-dns.com`. Remove the old hosting records.
   - The old WordPress hosting can stay paid until you confirm the new site is live, then cancel it.
     (Take a WordPress export first if you want the old content archived.)
4. **Free pass form**: the form posts to FormSubmit (oratorkhizer@gmail.com).
   The first submission triggers a confirmation email from formsubmit.co : click it once and
   all later registrations flow to your inbox.

## Content you should update

- **Venue**: search for "venue announcement soon" in `index.html` once the hall is booked
  (also update the JSON-LD `location` block near the top).
- **Gallery**: eight real photos from the 2025 edition are in `assets/gallery/` (g1-g8). To swap one, replace the file and keep the name
  (or edit the `figure` tags in the gallery section). The hero background is `assets/hero.jpg`.
- **Agenda and speakers**: the agenda is marked provisional; update by October.
- **Analytics**: add your GA4 tag in `<head>` when ready (left out deliberately, no fake IDs).
- **Refund cutoff**: 31 October 2026 is set in the FAQ, tickets note and `refund.html`. Keep in sync.

## Notes

- Pass prices are enforced server-side in `api/create-order.js`. Prices: Priority ₹499, Family ₹1,999 (set server-side). Changing a price means editing
  that file and the matching copy in `index.html`.
- Every payment lands in the Foundation's Razorpay account with the buyer's name, phone and
  pass type saved in the order notes (visible in the Razorpay dashboard, exportable to Excel).
- No cookies, no trackers by default. localStorage is not used.
