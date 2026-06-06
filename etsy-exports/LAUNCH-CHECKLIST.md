# HK23 Etsy — Manual Launch Checklist

Everything you need to go live and sell **today**, without the API key. The agent automates this later; this gets you selling now.

## ✅ What's already prepared for you
| Asset | Where |
|-------|-------|
| **High-res art (243 JPGs, 1856×2464)** | `~/Desktop/HK23-Etsy-Fullres/` — upload these as listing photos + the buyer's download file |
| **Listing text** (title, 13 tags, description, price) | http://localhost:8765/etsy-studio.html — COPY buttons |
| **Shop About / policies / FAQ** | `etsy-exports/SHOP-COPY.md` |
| **10 quick preview JPGs (624px)** | `etsy-exports/HK23-mj-01..10.jpg` (backup / fast option) |

---

## Step 1 — Finish opening the shop (~10 min)
- Complete: **Shop preferences → Name → How you'll get paid → Billing → Security**.
- Set **Country = Chile**, **Currency = USD** (wider reach for digital art).
- Don't overthink the name — you can change it later.

## Step 2 — Brand the shop (~10 min)
- Paste the **Announcement** and **About** from `SHOP-COPY.md`.
- Add a banner + logo (use any HK23 art from `~/Desktop/HK23-Etsy-Fullres/`).
- Set **Shop policies** from `SHOP-COPY.md` (digital = no returns, instant delivery, personal-use license).

## Step 3 — Publish your first listings (~3 min each)
For each piece (start with 3–5 of your strongest):
1. Etsy → **Create a listing**.
2. **Photos:** upload the matching high-res JPG from `~/Desktop/HK23-Etsy-Fullres/`.
3. **Title / Tags / Description:** copy from **etsy-studio.html** (the COPY buttons).
4. **Type:** Digital · **Category:** Digital Prints · **Who made it:** I did.
5. **Price:** as shown in the studio ($6–8.50).
6. **Digital file (the download):** attach the same high-res JPG (or a print bundle).
7. **Publish.** 🎉

## Step 4 — You're live
Share your shop link. You're selling.

---

## When the API key activates
1. `cd ~/vice-os-artifact/etsy-agent` → paste keystring in `config.json`
2. `npm run oauth` → click Allow
3. `npm run taxonomy` → set the Digital Prints id in config
4. `npm run publish` → the agent publishes the rest **automatically**.

The manual listings you made by hand stay live; the agent just adds the rest and runs on schedule.

---

## Tips to sell faster
- **Bundle option:** offer a "set of 3 prints" listing at a higher price — boosts average order.
- **Consistency:** publish a few listings per week; Etsy rewards active shops.
- **SEO:** the titles/tags are already keyword-optimized — don't water them down.
- **Mockups (later):** framed-on-a-wall mockups convert better than raw art; we can generate these next.
