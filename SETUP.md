# Cranky — setup

Three pieces: a Google Sheet (database), an Apps Script (the API), and GitHub Pages (the site). ~15 minutes, one time.

## 1. Sheet + Apps Script (the backend)

1. Create a new Google Sheet. Name it whatever you like.
2. In the Sheet: **Extensions → Apps Script**.
3. Delete the placeholder code, paste in everything from **`Code.gs`**, and save (disk icon).
4. **Deploy → New deployment**. Click the gear → **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
   - **Deploy**, then authorize when prompted (you'll pass a "Google hasn't verified this app" screen — it's your own script; continue).
5. Copy the **Web app URL** (ends in `/exec`).

The `Log`, `Beans`, and `Options` tabs are created automatically the first time the app calls the script, and the drink list, baristas (Payal, Sameer) and people (Payal, Sameer) are seeded for you. You can change all of those later on the Maintenance page.

## 2. Wire up the site

1. Open **`index.html`**, find this line near the top of the `<script>`:
   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";
   ```
   Replace the placeholder with the `/exec` URL from step 1.

## 3. GitHub Pages (hosting)

1. New repo (e.g. `cranky`). Add **`index.html`** and **`cranky-logo.svg`** to the root.
2. **Settings → Pages →** deploy from the `main` branch, root folder.
3. Your site will be at `https://<you>.github.io/cranky/`. Open it on your phone to test.

## 4. QR code

Send me the final Pages URL and I'll generate a QR you can print for the machine. (Or any QR generator pointed at that URL works.)

---

### Good to know

- **Editing `Code.gs` later:** after any change, **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy**. The URL stays the same, so you don't need to touch `index.html` again.
- **CORS:** the app talks to Apps Script over JSONP, which is why there's no CORS configuration to wrestle with.
- **Access:** the Web app URL is unauthenticated — anyone who has the exact URL could write to your sheet. It's an unguessable link and the data is just coffee logs, but don't post the URL publicly.
- **Grind** is set per bag on the Maintenance page (0–10). New bags start with it blank.
- **Beans** are never deleted, only archived, so your history stays intact. Adjust grams up or down freely, or use −17.5g.
