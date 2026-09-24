# Scale Sitter

The public page for Lucas's reptile sitting service. It lives inside the Reptile Log site so it can use the same species data.

Live address (this is what the poster QR points at, so do not rename the folder):
https://hiddenbranch.github.io/reptilelog/sitter/

## Files
- `index.html` the page
- `config.js` every setting: name, contact details, days Lucas can't take, services, drop-off, what you say no to
- `scales.svg` the scale band at the top
- The page also reads `../species.js` from Reptile Log for the care cards. If that file is ever missing the page still works; visitors just type their animal in.

## Putting it live
On GitHub, open the `reptilelog` repository, choose Add file, Upload files, and drag in the whole `sitter` folder (the folder itself, not its contents). Commit. It is live within a few minutes. Nothing in the app changes, so no version bump is needed.

## Day to day: edit `config.js` on GitHub (pencil icon)
- **Contact**: set `phone` and `email`. Use a parent-owned number and inbox. Until one is set, the send buttons stay hidden and a yellow setup note shows.
- **Days Lucas can't take** (booked, family trips, anything): inside `unavailable: [ ]`, add `'2026-11-26',` for one day or `'2026-12-20 to 2026-12-27',` for a stretch. No reason shows on the page; the days are struck out as "not available". Open the page afterwards and check the calendar. If a typo breaks the file, the page says so at the top.
- **Area**: set `area` to your neighborhood name.
- **What Lucas keeps**: fill in `keeps`, for example `'Bearded dragon, 3 years'`.
- **Drop-off**: `dropOff: true` adds "Drop-off at your house" as a choice on the request, with two questions for you to review (enclosure size, and mites or illness lately). `dropOffNote` is the paragraph visitors read about it. `false` hides it all.
- **Rehoming**: `rehoming: false` hides that section.
- `decline` lists species that get a polite no. `askFirst` lists species you want to meet first. All monitors are treated as meet-first.

## How requests arrive
The page has no server and stores nothing. The visitor picks animals and dates, the page writes the message, and the buttons open the visitor's own text or email app with it filled in. You get a normal text or email and reply from your own phone.

The page is marked `noindex`, so search engines should leave it alone; people reach it from the poster.

## Before printing posters
Upload the folder, fill in `config.js`, then scan the QR on the poster PDF from your screen and send yourself a test request by text and by email.
