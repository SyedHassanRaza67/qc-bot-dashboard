

## Plan: Update Home Page

### Changes to `src/pages/Home.tsx`:

**1. Add Portfolio/Showcase Section** with the 5 uploaded images displayed as a visually appealing gallery between Features and Pricing sections. Images will be copied to `src/assets/portfolio/` and shown in a responsive grid with hover effects, rounded corners, and subtle shadows. Captions will describe each screen (Dashboard, Upload, Integrations, Call Detail, Analytics).

**2. Remove "10K+ Active Users" stat** from the stats array (line 83). Keep the other 3 stats.

**3. Add Contact/Book Demo Section** before the footer CTA with:
   - Email: raxahassan67@gmail.com (with mailto link)
   - WhatsApp: +92 3109360056 (with wa.me link)
   - Description highlighting: "Custom integrations with VICIdial, Ringba & other dialers. Live call QC monitoring. Real-time AI-powered quality control for your call center."
   - Mail and MessageCircle icons from lucide-react

**4. Redirect "Get Started" and "Start Free Trial" buttons** to WhatsApp instead of internal routes:
   - Hero "Get Started" button (line 138): `Link to` → `a href="https://wa.me/923109360056?text=Hi, I'm interested in Audio Analyzer AI"`
   - Pricing "Get Started" button: same WhatsApp link
   - Pricing "Start Free Trial" button: same WhatsApp link
   - Pricing "Contact Sales" button: same WhatsApp link
   - CTA "Start Free Trial" button (line 339): same WhatsApp link

**Files to create:**
- Copy 5 uploaded images to `src/assets/portfolio/`

**Files to modify:**
- `src/pages/Home.tsx` — all changes above

