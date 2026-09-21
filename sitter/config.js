/* Scale Sitter settings. This is the only file you need to edit.
   Edit it on GitHub (pencil icon), commit, and the page updates within a few minutes.
   Keep the quotes and commas as they are. Dates are always 'YYYY-MM-DD'. */
window.SCALE_SITTER = {

  // ---- Who and where ---------------------------------------------------
  name: 'Scale Sitter',
  tagline: 'Cold-blooded pets, warm-hearted care.',
  sitter: 'Lucas',                 // first name only
  area: '',                        // e.g. 'Teravista'. Shown as "your neighbor in Teravista". Leave '' to hide.

  // ---- Where requests go (use a parent-owned number and inbox) ---------
  phone: '',                       // e.g. '+15125550100'. Leave '' to hide the text button.
  email: '',                       // e.g. 'scalesitter@gmail.com'. Leave '' to hide the email button.

  // ---- Dates that are already taken -------------------------------------
  // A single day:  '2026-11-26'
  // A stretch:     ['2026-12-20', '2026-12-27']   (first day, last day)
  booked: [
  ],
  noticeDays: 2,                   // earliest bookable day is this many days from today
  monthsAhead: 12,                 // how far forward the calendar goes

  // ---- The opening paragraph, in Lucas's voice --------------------------
  intro: "I'm Lucas. We keep reptiles at home, so I know the routine: the right food on the right day, fresh water, and a warm side that is actually warm. While you're away I'll visit your animals at your home and keep everything the way you left it.",

  // ---- What Lucas keeps now (the "why trust him" list) -------------------
  // e.g. 'Bearded dragon, 3 years'. Leave the list empty to hide this block.
  keeps: [
  ],

  // ---- What a visit covers ----------------------------------------------
  services: [
    'Feeding on your schedule: insects, greens or frozen-thawed, the way you do it',
    'Fresh water, and misting if your animal needs it',
    'Warm side, cool side and humidity checked and written down',
    'Spot clean, and a look over lights, timers and lid latches',
    'A photo and a short note to you after every visit'
  ],

  // ---- What we say no to --------------------------------------------------
  wontDo: [
    'Venomous animals of any kind',
    'Giant constrictors and crocodilians',
    'Feeding live rodents'
  ],
  // Animals on the species list that get a polite "sorry, no" instead of an Add button
  decline: ['Reticulated python', 'Nile monitor', 'Asian water monitor', 'Crocodile monitor'],
  // Animals we want to meet before saying yes (every monitor is treated this way automatically)
  askFirst: ['Boa constrictor', 'Blood python', 'Carpet python', 'Green iguana', 'Argentine tegu', 'Tokay gecko', 'Sulcata tortoise'],

  // ---- The note from the parents ------------------------------------------
  parentsNote: "Lucas is supervised and supported by us, his parents, on every booking. One of us answers your messages, comes along to the meet-and-greet, and is on call during every visit. If you'd like to know more before you book, reach out to us directly.",

  // ---- Switches -------------------------------------------------------------
  boarding: false,                 // true once cages are set up at home: adds "or drop off at our house"
  rehoming: true                   // shows the "Need to rehome a reptile?" section
};
