# Reptile Log (PWA) v1.0, companion to the Reptile Keeper's Log Book

Feeding, weight, shed, enclosure and health logs per animal; feeding due dates; care reports for a vet or an owner; a sitter handoff built from each animal's profile; log book page photos filed by page code. Installs to a phone, works offline, nothing leaves the phone until you share it.

## Deploy (GitHub Pages, 10 minutes)
Same steps as AV Field Tools: new repository, upload `index.html`, `core.js`, `app.js`, `sw.js`, `manifest.webmanifest` and `icons/`, enable Pages from the main branch root. HTTPS from Pages is what makes the camera, share sheet and offline mode work.

## The accounts phase (the holiday-care business)
What exists today is single-phone. The business version needs three things, in this order:
1. **Accounts and sync.** Supabase (Postgres, auth, storage, row-level security) on its free tier covers hundreds of users. Tables: owners, animals, entries, pages, sitter_invites. Owners invite a sitter by email; the sitter logs against the owner's animals from their own phone; the owner sees entries as they land. Row-level security rules do the privacy work; no custom server.
2. **Roles.** Owner (full), sitter (log and read the care instructions for assigned animals, nothing else), vet (read a shared report link). The app's existing entry forms and handoff text are the sitter's screens already.
3. **Money.** Subscription per owner through Lemon Squeezy (merchant of record) or Stripe, or bundled into a care-service booking. If the service is your own home business, the app is also your operations tool: each client is an owner, you are the sitter, and the daily entries are the proof of care.

Before running a care business from a home in Round Rock: check Williamson County and city rules on animal boarding at a residence, get liability insurance that names reptiles, and use a written boarding agreement that covers emergency vet authorization and spending limits. Venomous animals and dangerous wildlife permits are a separate world; stay out of it.

## Species data (prepopulated)
`species.js` holds 82 species (13 snakes, 8 geckos, 10 other lizards, 39 monitors, 5 tortoises, 3 turtles, 4 amphibians kept alongside) with warm, cool, basking and night temperatures, humidity including shed humidity, UVB level, adult and juvenile feeding intervals, diet, supplement routine, adult size, lifespan and a keeper note about the thing that usually goes wrong. Picking a species on the animal form offers the presets and fills the targets, interval, diet, supplements and UVB with one tap. Enclosure readings that drift off an animal's target are flagged as you type. The Reference tab has the whole set as a searchable guide.

Monitors get their own group because their husbandry is genuinely different: basking figures are surface temperatures under the lamp (120 to 155F), read with an infrared gun, and almost all of them want deep moist substrate and an enclosure far larger than a comparable lizard. The app widens the basking tolerance in proportion to the target, so a 155F surface is not flagged over a 7-degree swing, and shows an IR-gun reminder on the enclosure form for any animal with a high basking target. Species where the law may restrict ownership (Nile and Asian water monitors) say so in the note.

Every row was sanity-checked programmatically: hot above cool, basking at or above hot, night at or below cool, humidity in a plausible band, adult interval at or above juvenile, basking below 170F, and no missing field. Values are mainstream published husbandry targets; the app says so wherever they appear.

## Species photos
Photos come from Wikimedia Commons, fetched the first time a species is opened and then stored on the phone (`photos.js` holds the helpers, `app.js` the flow). The app asks Wikipedia for the article's lead image, then asks Commons for that file's licence and author. Only free licences are shown (CC0, CC BY, CC BY-SA, public domain, GFDL); non-commercial, no-derivatives and fair-use images are withheld. Every photo carries a credit line with the author, the licence, and links to the Commons page and the licence text, which is what CC BY and CC BY-SA require. Settings has a toggle to stop loading photos, a credits page listing every photo in use, and a cache clear.

`wiki` on each species is the Wikipedia article title; where the common name in the app is not the article name there is a mapping at the bottom of `species.js`. If a species shows no photo, the article either has no free lead image or the title needs adjusting there. If it shows the wrong kind of image (a range map, a museum specimen), that is the article's lead image; the fix is a better `wiki` title pointing at a species article, and a per-species override is on the list for a later version.

## Licensing (no merchant of record)
Keys are ECDSA P-256 signatures checked on the device by `license.js`. There is no payment provider in the loop, no server, and no network call at activation. `PUBLIC_KEY` in `app.js` is a placeholder until you run `node tools/keygen.mjs init` in the licensing folder and paste the printed public key in. See `SELLING.md` there for the Stripe setup, what Texas and other states actually require, and the optional Cloudflare Worker that issues keys automatically for $0 a month.

## Updating
Run `node bump.mjs 1.2.3` (any new version number) before uploading. It stamps the version into every script URL, `app.js` and `sw.js`, so no browser or GitHub Pages cache can serve a stale file. Then upload everything. On a phone that already has the app: Settings, Check for updates and reload; the version line confirms.

## What the app does today
- Log: two-tap feeding with result and supplement, weight, shed, enclosure readings against the animal's targets, health entries with photos. Feeding status badge (ok, due, overdue) from the animal's interval.
- Animals: profiles with targets, UVB date, feeding interval and everything a sitter needs (diet, refusal plan, water, misting, meds, handling, do-not list, call-me-if, vet). Species presets fill the interval and diet.
- Scan: photograph a log book page; the RLB1 page code is read and the page filed under the animal.
- Report: care report over 14 to 365 days with weight trend, feeding count and refusals, health entries; or the sitter handoff. Share sheet, copy, or a zip with the CSV and photos.
- Reference: species targets, signs to watch, the emergency list, feeding and supplements, prey weights, quarantine, sitter rules; tools for temperature, mass, prey percentage and next feeding date.

## Testing
`node test.js` (core) and `node smoke.js` (headless UI walk; needs `npm install jsdom fake-indexeddb`).
