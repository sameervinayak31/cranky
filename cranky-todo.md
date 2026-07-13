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

**Architecture:** one static `index.html` on GitHub Pages + Google Apps Script (`Code.gs`) bound to a Google Sheet. Data over JSONP GET (sidesteps Apps Script CORS). Nav is 4 tabs: Order, Beans, Stats, Maintenance.

- Sheet tabs: `Log`, `Beans`, `Options`, `DrinkIcons`.
- Beans columns: `name | roaster | notes | grind | grams | opened | status | country | rating | process | variety | roastDate | cost` — id = sheet row number (beans are archived, never deleted, so ids stay stable). `country` is picked from a curated 22-country dropdown (`COUNTRIES`/`COUNTRY_PATHS` in `index.html`) so it always has a matching silhouette; `rating` is 1-10; `process`/`variety`/`roastDate`/`cost` (£) are all optional free-entry fields. Full bean editor lives on its own "Beans" tab now (moved out of Maintenance since the field count kept growing) — Maintenance kept just Drink types/Baristas/People.
- Log columns: `timestamp | barista | for | drink | bean | grams | mood` — `mood` is optional, one of `cranky|ded|good|hungry|jittery` (`MOODS` in `index.html`), picked on the Order page under "How you feeling," doesn't block ordering.
- Options columns: `category | value` where category ∈ {drink, barista, person}.
- DrinkIcons columns: `drink | icon` — sparse, only holds manual overrides. Icon otherwise auto-guessed from the drink name by keyword (`guessDrinkIcon()`); override via a select on each drink row in Maintenance.
- Client caches `getData` in localStorage (stale-while-revalidate → instant reopens), plus a manual force-refresh button (circular arrow icon, top-right of the topbar) for when a device's local cache feels stale after another device logged something. Maintenance/Beans edits are optimistic (apply locally, sync in background, self-heal on failure). Grams floored at 0 on client and server. Grams/grind/rating/cost edits commit on a debounce (don't rely on the flaky change/blur event); country/dates/icon selects commit on change; Name/Roaster/Notes/Process/Variety share one explicit Save button that appears once any of the five is dirty. Chart.js is lazy-loaded only on the Stats tab.
- `Code.gs` migrations are additive-only and idempotent (`ensureSetup()` adds new columns/sheets on first request post-redeploy, never rewrites existing rows) — verified by simulation before shipping every time the schema grows; see git history for the dry-run pattern (mock a `Sheet`/`Range` class in Python, replay the exact migration + read logic against a snapshot of the live sheet's current shape).

**Preview:** `cranky-preview.html` is generated from `index.html` by swapping the JSONP layer for an in-memory mock + Chart.js from cdnjs. Do not deploy it — it's only for iterating in-chat.

**Deploy model:** repo lives at `~/Desktop/cranky`, edited locally and pushed via git/Claude Code (moved off the GitHub-web-UI-only workflow). Pages auto-rebuilds on push to `main`. Apps Script updates via the script editor → Manage deployments → edit → New version (same `/exec` URL) — `Code.gs` changes here still need that manual redeploy step, git push alone doesn't touch the live Apps Script. Repo needs: `index.html`, `cranky-logo.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest`.

**Design language:** espresso `#211613`, cream `#F3E9DC`, tangerine accent `#FF7A3D`; Anton wordmark + Space Grotesk UI; mascot is the cranky/crying mug (`cranky-logo.svg`, also used for the confirmation splash and app icons). Elsewhere-Coffee-inspired. User is strict about copy — get sign-off on any new UI text. Baristas/people: Payal & Sameer.

**Recent changes (most recent session):**

- "Order up" is now optimistic — the splash shows immediately and the log write happens in the background (self-heals via refresh on failure), instead of waiting on the full JSONP round-trip. This was the main source of felt slowness. If the background write AND the follow-up self-heal refresh both fail, a persistent "Couldn't save your last order" banner appears (above the nav bar) with a Retry button, instead of relying solely on the easy-to-miss 1.1s toast. Retry re-syncs from the server rather than blindly resubmitting the order, since the original write might have actually succeeded and only the response was lost — resubmitting blind could double-log. `orderSyncFailed` flag is cleared by any successful `refresh()` call anywhere in the app, not just the banner's own Retry.
- Maintenance gained a "Drink log" popup listing recent orders with a delete button per entry. Deleting a log entry also refunds its grams to the matching bean (by name — silently skipped if that bean's since been renamed/deleted, since the log doesn't store a stable bean reference). New `deleteLog` Code.gs action; log entries now carry a stable `id` (sheet row number), same pattern as beans.
- Beans page: repeat bags (same name + roaster + country) now stack into one carousel position with a "‹ bag N of M ›" pager instead of each getting a full separate card. Archiving/saving/editing still targets the one bag currently showing, not the group.
- Roaster is now a datalist (type-ahead + free entry) pre-populated from every distinct roaster already in use, alpha sorted, instead of a bare text field — same idea as the curated country dropdown but open-ended since roasters aren't a fixed set.
- Country dropdown is now alpha sorted (was grouped loosely by region before).
- Force-refresh button in the topbar for cross-device staleness.
- Beans moved off Maintenance onto their own nav tab; gained `process`, `variety`, `roastDate`, and `cost` (£) fields (all optional). Bean card fields reordered/regrouped (Country/Roast date/Opened, then Grind/Grams/Cost, then rating) now that there's a full page for it.
- Name/Roaster/Notes weren't editable after bean creation — fixed, now inline-editable in the bean card with an explicit Save button that appears once you've changed something.
- "How you feeling" mood picker added to Order (Cranky/Ded/Good/Hungry/Jittery, optional, doesn't block ordering) — Cranky's icon is adapted from the app's own mascot face; others sourced from Tabler Icons for style consistency.
- iOS status-bar overlap fixed (`env(safe-area-inset-top)` — the app runs `black-translucent` status bar + standalone display, so content renders under the notch by default unless padded manually).
- Chart palette swapped from a bright rainbow to a muted terracotta/blue set.
- "Add new beans" moved from a standalone button into the Order page's Beans grid as a dashed/shaded tile equally sized to real bean tiles; the "for" category's custom-name `+` tile now shares that same dashed styling.

**Earlier session:**

- Beans gained `country` (curated 22-country dropdown) and `rating` (1-10) fields. Order-page bean tiles show a faint silhouette of the bean's origin country as a background watermark; beans with no country set fall back to a minimalist globe icon instead of showing nothing.
- Drink tiles on Order show a small minimalist cup icon above the name (demitasse/mug/wide-cup/iced-cup/frappe-cup, or a maple leaf specifically for anything with "maple" in the name) — auto-guessed from the drink name by keyword, overridable per-drink in Maintenance.
- Stats gained a 4th chart: "Drinks by country" pie, grouping beans with no country set under "Unspecified".

**Still open / pending:**

- User to send the final GitHub Pages URL so Claude can generate the QR code for the machine.
- Product question: when a bag hits 0g, currently the app still logs the order and leaves grams at 0 (no block). Open whether to add a gentle refill/pick-another-bag nudge (user asked to keep ordering unblocked earlier).
- Offered but not done: trim the `getData` payload (e.g., stop sending the full log to Order/Maintenance) if the background refresh lags once history grows.
- Coffee-expert product review surfaced more ideas not yet built: per-log 1-5 quick rating (distinct from the bean's own 1-10 rating), Payal-vs-Sameer head-to-head stats card, streaks/milestones, time-of-day/day-of-week heatmap, rotating fun-fact strip on Stats, roaster/origin "report card" (avg rating grouped by roaster or country), and a freshness badge on bean tiles once `roastDate` has real data in it ("Xd off roast").
- Reliability/perf audit (opus) fixed the two small obvious findings — server-side grams floor in `logDrink`/`updateBean`, and a double-tap guard (`guardedMutate`/`pendingBeanActions` in `index.html`) on the "−17.5g"/"Donezo"/"Restore" buttons. Deferred, needs discussion before fixing:
  - **Bean identity is the raw Sheet row number.** If a bean row is ever manually deleted in the Sheet (rather than archived via the app), every bean below it shifts and future edits silently hit the wrong bean. Not a code bug — an operating rule: never manually delete a bean row, archive only.
  - **Debounced field edits (grams/grind/rating/cost, 700ms) have no ordering guarantee over JSONP** — two rapid edits to the same field from the same device could theoretically land out of order (last *response*, not last *request*, wins). Low real-world odds for 2 users; would need a version/timestamp check to fully close.
  - **`ensureSetup()` isn't lock-protected** — two simultaneous first-requests in the seconds right after a redeploy could both try to create a not-yet-existing sheet and one would error. Only matters immediately post-deploy.
  - **Stats chart math (nested log scans, per-row bean lookup) will get visibly slower at thousands of logged drinks** — fine at current scale, worth revisiting if `getData`'s full-log-every-time issue (already tracked above) ever gets addressed at the same time.
  - Preview mock beans/log don't exercise every field (process/variety/roastDate/cost/mood) on the sample data, so "looks right in preview" isn't a full guarantee for those — worth padding out the mock sample data next time it's touched.
