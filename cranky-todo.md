# Cranky — Feature TODO / Backlog

Ideas discussed but not yet built, with enough detail to pick up cold later.

## 1. Barista notification ("order ticket")

**Idea:** when a drink is logged, the selected barista gets pinged with the order — so someone can request from their phone and whoever's on barista duty gets buzzed.

**Status:** Tabled (not built).

**Options considered:**

- **ntfy push — recommended.** Barista installs the ntfy app (iOS/Android), subscribes to a private, unguessable topic. Apps Script sends one UrlFetch POST to `https://ntfy.sh/<topic>`. Free, no keys, no signing, no CORS. A real phone push.
- **Email the barista.** Free via MailApp/GmailApp in Apps Script; lands as a phone notification. Zero dependency; good fallback. Needs each barista's email.
- **Twilio SMS.** Real texts, works UK + US. ~£1–2/mo for a number + pennies/text. Needs a Twilio account and auth token stored in Script Properties.
- **Pushover.** Polished, ~$5 one-time per platform, needs app token + user key.
- **Telegram.** Free, reliable, but needs a bot token + each barista's chat_id.
- **True web push from the Cranky app itself.** Nicest UX (notification says "Cranky"), but sending requires ES256-signed VAPID + an encrypted payload, which Apps Script can't do cleanly — would need an extra dispatcher (e.g., a Cloudflare Worker). iOS also requires the app be added to the Home Screen (PWA). Highest maintenance.
- **Email-to-SMS carrier gateways.** Rejected — US-carrier-only, increasingly deprecated, and effectively unavailable on UK carriers.

**Recommendation:** ntfy for a genuine push with near-zero setup; email as the no-dependency fallback.

**Prereqs / notes:**

- Need a barista → contact/target mapping stored in the Sheet (new column on a baristas tab, or a small mapping tab), editable on the Maintenance page. Today baristas are just names in the Options tab with no contact info.
- The message wording is copy — must be drafted and approved before shipping (user is strict about on-screen/outgoing text).
- Any secret (Twilio token, etc.) goes in Script Properties, never in the static frontend.

## 2. Photo-to-beans (scan the bag)

**Idea:** on "Add new beans," snap a photo of the bag and auto-fill Name / Roaster / Notes / Grams for review before saving.

**Status:** Tabled (not built).

**Approach:**

- Camera capture in the browser: `<input type="file" accept="image/*" capture="environment">`.
- Resize/compress client-side (~1024px JPEG → base64) to cut cost/payload.
- Send image → Apps Script → Apps Script calls a vision model (key in Script Properties) → returns structured JSON → pre-fill the Add-beans form → user confirms/edits → save. Routing through Apps Script keeps the API key server-side (a public GitHub Pages file can't hold a key) and avoids CORS.

**Provider options:** Anthropic Claude vision or Google Gemini (both good). Key must be server-side.

**What it can realistically extract:** name, roaster, tasting notes, and usually grams (250g / 340g / 12oz → convert). Grind is not on bags (it's the grinder setting) → stays manual.

**Free/keyless alternative:** Tesseract.js in-browser OCR — no key/cost, but rough: dumps raw text with no structured name/roaster/notes split.

**Tradeoffs:** small per-scan cost (fractions of a cent to ~1¢), one added dependency/key, a couple seconds latency (needs a loading state). Always confirm-before-save — models misread stylized bags.

## 3. Geographic globe/heatmap for beans by country

**Idea:** on Stats, a world-map choropleth (or literal spinning globe) highlighting which origin countries get drunk the most, instead of (or alongside) a flat chart.

**Status:** Tabled — a simpler "Drinks by country" pie chart shipped instead (Stats page, 4th card) as the practical interim version.

**Why tabled:** country is opt-in per bean, so most sessions will only ever have data for a handful of countries at once — a full world-map projection is a lot of rendering complexity (need real relative lat/lon positioning, a color-scale legend, small-screen readability) to highlight what's realistically 3-6 dots. The per-country outline paths already embedded in `index.html` (`COUNTRY_PATHS`, used for the bean-tile watermark) are each individually normalized/centered into their own 0-100 box — they'd need to be re-derived from the raw source GeoJSON with a shared projection to plot them at true relative positions for an actual map.

**If revisited:** re-fetch per-country boundaries (source used last time: `raw.githubusercontent.com/johan/world.geo.json/master/countries/<ISO3>.geo.json`), project all curated countries into one shared equirectangular viewport (not normalized per-country), and render as an SVG choropleth colored by drink count — same simplification/Douglas-Peucker approach already used for the watermark outlines.

## Project context (to regain footing)

**Architecture:** one static `index.html` on GitHub Pages + Google Apps Script (`Code.gs`) bound to a Google Sheet. Data over JSONP GET (sidesteps Apps Script CORS).

- Sheet tabs: `Log`, `Beans`, `Options`, `DrinkIcons`.
- Beans columns: `name | roaster | notes | grind | grams | opened | status | country | rating` — id = sheet row number (beans are archived, never deleted, so ids stay stable). `country` is picked from a curated 22-country dropdown (`COUNTRIES`/`COUNTRY_PATHS` in `index.html`) so it always has a matching silhouette; `rating` is 1-10, Maintenance-only.
- Options columns: `category | value` where category ∈ {drink, barista, person}.
- DrinkIcons columns: `drink | icon` — sparse, only holds manual overrides. Icon otherwise auto-guessed from the drink name by keyword (`guessDrinkIcon()`); override via a select on each drink row in Maintenance.
- Client caches `getData` in localStorage (stale-while-revalidate → instant reopens). Maintenance edits are optimistic (apply locally, sync in background, self-heal on failure). Grams floored at 0 on client and server. Grams/grind/rating edits commit on a debounce (don't rely on the flaky change/blur event); country/icon selects commit on change. Chart.js is lazy-loaded only on the Stats tab.
- `Code.gs` migrations are additive-only and idempotent (`ensureSetup()` adds new columns/sheets on first request post-redeploy, never rewrites existing rows) — verified by simulation before shipping, see git history around the country/rating commit for the dry-run approach if extending the schema again.

**Preview:** `cranky-preview.html` is generated from `index.html` by swapping the JSONP layer for an in-memory mock + Chart.js from cdnjs. Do not deploy it — it's only for iterating in-chat.

**Deploy model:** repo lives at `~/Desktop/cranky`, edited locally and pushed via git/Claude Code (moved off the GitHub-web-UI-only workflow). Pages auto-rebuilds on push to `main`. Apps Script updates via the script editor → Manage deployments → edit → New version (same `/exec` URL) — `Code.gs` changes here still need that manual redeploy step, git push alone doesn't touch the live Apps Script. Repo needs: `index.html`, `cranky-logo.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest`.

**Design language:** espresso `#211613`, cream `#F3E9DC`, tangerine accent `#FF7A3D`; Anton wordmark + Space Grotesk UI; mascot is the cranky/crying mug (`cranky-logo.svg`, also used for the confirmation splash and app icons). Elsewhere-Coffee-inspired. User is strict about copy — get sign-off on any new UI text. Baristas/people: Payal & Sameer.

**Recent changes (this session):**

- Beans gained `country` (curated 22-country dropdown) and `rating` (1-10) fields, editable in Maintenance. Order-page bean tiles show a faint silhouette of the bean's origin country as a background watermark; beans with no country set fall back to a minimalist globe icon instead of showing nothing.
- Drink tiles on Order now show a small minimalist cup icon above the name (demitasse/mug/wide-cup/iced-cup/frappe-cup, or a maple leaf specifically for anything with "maple" in the name) — auto-guessed from the drink name by keyword, overridable per-drink in Maintenance.
- Stats gained a 4th chart: "Drinks by country" pie, grouping beans with no country set under "Unspecified".

**Still open / pending:**

- User to send the final GitHub Pages URL so Claude can generate the QR code for the machine.
- Product question: when a bag hits 0g, currently the app still logs the order and leaves grams at 0 (no block). Open whether to add a gentle refill/pick-another-bag nudge (user asked to keep ordering unblocked earlier).
- Offered but not done: trim the `getData` payload (e.g., stop sending the full log to Order/Maintenance) if the background refresh lags once history grows.
