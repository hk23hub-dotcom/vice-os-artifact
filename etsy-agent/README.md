# HK23 Etsy Agent

Turns your generated listings (`../etsy-listings.json`) into real Etsy listings:
**create draft → upload image → (optionally) publish.** Zero dependencies (Node 20+, macOS `sips` for image conversion).

## Status gate
Your Etsy key (`hk23-auto-publisher`) is **"Pending Personal Approval"**. Nothing here can run against Etsy until the key is **active**. Everything below is ready to go the moment it is.

---

## One-time setup (you do this once the key is active)

### 1. Add your keystring
```bash
cd ~/vice-os-artifact/etsy-agent
cp config.example.json config.json
```
Open `config.json` and paste your **Keystring** (from the Etsy app page) into `"keystring"`.
*(config.json is gitignored — your key never gets committed.)*

### 2. Whitelist the callback URL on Etsy
On the Etsy app page (developers.etsy.com → Manage your apps → your app), make sure the **Callback / Redirect URL** includes:
```
http://localhost:3003/callback
```

### 3. Authorize your shop (OAuth — one click)
```bash
npm run oauth
```
It prints a URL and opens it. Click **"Allow"** in Etsy. Tokens get saved to `tokens.json` (gitignored). Done.

### 4. Pick your category id
```bash
npm run taxonomy            # lists "print" categories
npm run taxonomy digital    # or search another word
```
Copy the id for **Art & Collectibles > Prints > Digital Prints** (or whatever fits) into `config.json` → `listingDefaults.taxonomy_id`.

---

## Run it

**Preview (no writes):**
```bash
npm run publish:dry
```

**Create as drafts (safe — you review in Etsy before they go live):**
```bash
npm run publish
```

**Publish live automatically:** set `"publish": true` in `config.json` → `listingDefaults`, then `npm run publish`. Each listing is created, image uploaded, and activated. Already-published items are tracked in `.published.json` and skipped, so re-running only adds new ones.

---

## Going 24/7 in the cloud (later)
Once it works locally, the same `lib.js` + `publish.js` logic moves into a Vercel Cron function. The keystring + refresh token become Vercel **env secrets**, and a cron triggers `publish` on a schedule. (We wire this after the first successful local run.)

## Honesty / limits
- **Account, OAuth "Allow", and money are yours.** This code acts with *your* token; it never creates accounts or moves money on its own.
- WebP isn't accepted by Etsy → images are auto-converted to JPG via `sips` at publish time.
- For true digital *delivery* (buyer downloads a file), add the high-res file via Etsy's file-upload endpoint — a follow-up once listings are live.
- Etsy charges $0.20 per listing + fees on sale. Comply with Etsy's AI-art disclosure policy.
