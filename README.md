# Wort

A brewing recipe designer and batch log. One HTML file, no build step, no framework —
which is what makes it cheap to ship as a web app, an Android app and a desktop app
from the same source.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The whole application — markup, styles and logic |
| `manifest.webmanifest` | Makes it installable ("Add to Home screen", "Install app") |
| `sw.js` | Service worker; caches the shell so it opens with no network |
| `icons/` | App icons, including a maskable one for Android |
| `capacitor.config.json` | Android wrapper config |
| `package.json` | Convenience scripts only — there are no runtime dependencies |

## Run it locally

Open `index.html` directly and it works, but the service worker and install prompt
need a real origin. So:

```bash
npm run serve        # http://localhost:8080
```

## Ship it as a website / PWA

Copy the folder to any static host over HTTPS — a subfolder of an existing site is fine.

```
https://yourdomain.com/wort/
```

On Android, Chrome offers **Install app**. On Windows, Chrome and Edge offer the same
from the address bar. Both give you a real window and launcher icon, and both run
offline after the first load.

This is the cheapest route and covers both platforms. Take the Capacitor and Tauri
steps below only if you want store distribution or native file access.

## Build the Android app

```bash
npm install
npx cap add android
npx cap sync
npx cap open android      # opens Android Studio; build or run from there
```

Requires Android Studio and a JDK. Capacitor wraps the same `index.html`, so any change
to the app is just `npx cap sync` away. Bump `version` in `package.json` and
`versionCode` in `android/app/build.gradle` before each release.

## Build the desktop app

Tauri produces a small native binary (a few MB, versus ~100 MB for Electron):

```bash
npm install
npx @tauri-apps/cli init    # frontendDist: ".", devUrl: "http://localhost:8080"
npx @tauri-apps/cli build
```

Requires Rust and, on Windows, the MSVC build tools and WebView2.

## Where the data lives

Right now: `localStorage`, on each device separately. The app also detects a
claude.ai host and syncs there if present, but that path does nothing in the
Capacitor or Tauri builds.

**Getting one database across PC and Android is the next piece of work.** The seam
is already in place — `save()`, `loadLocal()` and `connect()` in `index.html` are the
only functions that touch storage, so a sync backend slots in behind them without
touching the rest of the app.

The plan, when you're ready:

1. Move reads and writes to IndexedDB, keeping every record stamped with
   `updatedAt` and a `deleted` flag (tombstones, so a delete on one device
   propagates instead of being resurrected by the other).
2. Stand up Supabase or Firebase. Supabase is a plain Postgres with row-level
   security, which suits a records-and-relations app like this better.
3. Push and pull changed records on app open, on focus, and after each write,
   resolving by last-write-wins per record.
4. Keep every write local-first. Brew day happens in a garage with bad signal,
   and the app has to work there.

Until then, BeerXML export and import moves a library between devices by hand.

## Base recipes vs batches

Two separate collections, on purpose.

**Base recipes** are the reference library. Lock one and it goes read-only — the
fields grey out and nothing you do on a brew day can drift it. Unlocking is one
button, so it's a guard rail, not a cage. Imports from the Base recipes tab arrive
locked.

**Batches** are what actually happened. Brewing a base recipe deep-copies it into the
batch, with fresh row ids, so the two can never share an object. From then on you
change the batch freely: the grain you actually had, the mash temperature you actually
hit, the hop substitution you made at 15 minutes. The base stays as written.

A batch can be promoted back with *Save as base recipe*, which adds it to the library
locked — the way a recipe earns its place after it turns out well. *Reset to base*
goes the other way, replacing the batch's recipe while keeping the measurements and
the fermentation log.

Both sections import and export BeerXML independently.

## BeerXML

Importing into **Batches** also reads what BeerSmith recorded about the brew itself:
measured OG and FG, its own efficiency figure, the fermentation schedule (primary and
secondary days and temperatures, conditioning time), and tasting notes. Status is set
from the data — a batch with a final gravity comes in Packaged — and the packaging
date is worked out from the brew date plus the fermentation days.

Two corrections are applied on the way in. BeerSmith carries DATE over from whatever
recipe a brew was cloned from, so where a batch name starts with a date (`170624 - …`)
that date wins. And equipment items such as an immersion chiller, which BeerSmith
stores with a placeholder weight, are recorded as one item rather than "2.06 tsp".

Import from the **Base recipes** tab to stock the library; import from the
**Batches** tab to log beers brewed elsewhere.

**Import** reads BeerXML 1.0 — what BeerSmith, Brewer's Friend, Brewfather and
BeerTools all export. It reads the recipe, fermentables, hops, yeast, equipment and
mash steps, and converts from BeerXML's metric units.

Two things to know:

- `.bsmx` is BeerSmith's own format, not BeerXML, and is not supported. In BeerSmith,
  select recipes and choose **File → Export → BeerXML**.
- Miscellaneous ingredients and water profiles land in the recipe notes rather than
  as structured data, because the app does not model them yet.

**Export** writes a BeerXML file that BeerSmith and the others will read back.

## Brew-day timer

Open a base recipe or a batch and press **Brew day**. The timer builds itself from
that recipe: one phase per mash step at its own target temperature, then the boil,
then any whirlpool stand.

Every hop and every misc item with a Boil or Whirlpool time becomes a trigger. The
boil phase lists them counting down, highlights each one as it comes due, beeps
twice, and lets you tick it off. Elapsed time is measured from wall-clock stamps and
saved to the device, so locking the phone, switching apps or reloading the page does
not drift the countdown, and the timer is still there when you come back.

Pressing Start also requests a screen wake lock where the browser supports it.

## Profiles

Equipment and mash profiles are fully editable on the Profiles tab. Each one collapses
to a summary line and opens to its whole field set — for equipment that is batch size,
boil time, efficiency, boil-off, trub and chiller loss, lauter deadspace, grain and hop
absorption, hop utilisation and tun capacity; for a mash it is grain temperature,
thickness, infusion and sparge temperatures, and an editable step list.

Both can be duplicated, which is the quick way to make a variant without retyping.
Editing a profile never reaches back into recipes already built on it — a recipe keeps
its own copy from the moment you load one in.

## Reading a recipe, then editing it

A recipe opens as something to read: name and style, the colour bar, the five style
gauges, the key figures, then the grain bill with proportion bars, the hop schedule
with per-addition IBU, the misc list, the mash steps with their infusion volumes, the
stock check, and every batch brewed from it. No input boxes anywhere.

A bar pinned to the bottom carries **Brew day** and **Edit**. Edit opens the form you
already know; its back button returns to the overview rather than to the library. New
and duplicated recipes open straight into edit, since there is nothing to read yet.

## Hot liquor tank plan

Under the mash schedule, on the recipe overview, and as a look-ahead on each brew-day
timer step: every draw of hot water in the order you need it, with its own
temperature.

| Heat | gal | °F |
|---|---|---|
| 1. Strike — Mash In | 3.92 | 170.9 |
| 2. Mash Out | 1.02 | 212 |
| 3. Sparge | 4.21 | 168 |
| Total into the HLT | 9.14 | |

Steps that raise temperature by direct heat or decoction add nothing, since no water
goes in. The total always matches Total water in the figures below it.

## Appearance

Dark by default, matching the instrument palette the mockups were drawn in:
background `#0E1419`, surface `#16202A`, text `#E3EBEF`, accent `#56C4D8`. The only
warm colour anywhere is the beer itself, computed from SRM.

The drawer offers **Dark**, **Light** and **Match system**. Earlier builds followed the
system setting with no way to override it, which meant a light desktop rendered a
completely different-looking app.

## Navigation

On a narrow screen the tab row collapses into a hamburger at the top left. The drawer
is available from every screen, the brew-day timer included, and lists each section
with its item count, the running timer with its live countdown, and the unit toggle.
Above 760px the tabs come back and the hamburger disappears.

## Inventory and the ingredient library

Inventory name fields draw on the same databases as recipes — the right one for each
category — so picking a name brings its unit with it and the row shows its figures:
alpha acid for hops, PPG and colour for fermentables, lab and attenuation for yeast.

The stock check on a recipe matches by meaning rather than by string. Library names
carry maltster and region, people stock plain names, and these all resolve:

| In the recipe | In your stock |
|---|---|
| Pale Malt: Brewers Malt, 2-row (Briess) | 2-row |
| Caramel Malt: Caramel Malt 60L (Briess) | Crystal 60 |
| Hallertauer Mittelfrüh (German) | hallertau |
| SafAle US-05 | US-05 |

Matching is scoped to the ingredient's own category, so a Crystal hop never satisfies
a crystal malt. Anything short gets a **+** to add it to stock at the quantity you're
missing; **Add all** does the lot; **Shopping list** writes a plain text file grouped
by category.

## Brew session

Every batch has a **Brew session** panel for what actually happened, as against what
the recipe predicted: strike temperature, mash in and out, first runnings, pre-boil
volume and gravity, post-boil volume, volume transferred, pitch temperature, and a
timestamped log you can add to from the batch screen or from the timer itself.

Gravity samples take a temperature beside them and are corrected before anything is
derived from them, against whatever your hydrometer is calibrated at. A reading of
1.044 taken at 120 °F is really 1.055 — about eleven points, which is the difference
between a beer that hit its numbers and one that did not.

From those it derives three efficiencies, which are three different things:

| | Measured at | What it tells you |
|---|---|---|
| Mash | pre-boil gravity × pre-boil volume | how well the grain converted and rinsed |
| Kettle | OG × post-boil volume | **the figure the recipe model uses** |
| Brewhouse | OG × volume into the fermenter | what you actually got to ferment |

The gap between mash and kettle is boil-off measurement error. The gap between kettle
and brewhouse is everything you left behind in the kettle.

**Update equipment from these** writes the measured kettle efficiency and actual
boil-off rate back into the batch's equipment, so the next recipe built on that
profile starts from reality rather than a guess.

## Splitting a batch

One wort, two fermenters, different dry hops. **Split batch** on any batch asks for
two to four parts and their shares, then creates them as separate batches.

Each part gets a deep copy of the recipe with every quantity scaled by its share —
grain, hops, misc, and all the volumes. Because the sugar and the volume scale
together, **OG, FG, ABV, IBU, colour and BU:GU come out identical in every part and
identical to the parent**; only the batch size differs. A 60/40 split of a 5 gallon
batch gives 3 and 2 gallons at the same 1.064 and the same 65 IBU.

Each part carries forward the brew date, the measured OG and the whole brew session,
since all of that happened before the split. Each gets its own empty fermentation log.
From that point they are independent: change the dry hop on one, the yeast on the
other, add a secondary addition to just one of them.

The parent is marked **Split**. Parts do not appear as cards of their own on the batch
list — a split was one brew day, not three. Open the parent and they are tabs across
the top: **Whole batch**, then each part. The parent holds everything up to pitching;
the parts hold the dry hops, readings and final gravity.

Searching is the exception: a query that matches a part shows it, since hiding a
search result would be unhelpful. A split also counts once in a recipe's brew history.

## Miscellaneous ingredients

Water salts, finings, spices, lactose, and kit like an immersion chiller sit in their
own section with an amount, unit, use stage and time. Anything scheduled at Boil or
Whirlpool joins the timer automatically — which is how "sanitise the chiller with 15
minutes left" becomes something that beeps at you.

They round-trip through BeerXML. Since BeerXML has no unit for "1 tablet" or "1 tsp",
the real unit travels in DISPLAY_AMOUNT, which BeerSmith also reads.

## The arithmetic

| Quantity | Method |
|---|---|
| Gravity | Points per pound per gallon, efficiency applied to mashed grain only |
| Bitterness | Tinseth, referenced to post-boil volume, with form adjustments (pellet +10%, plug +5%, leaf none; first wort +10%) and an equipment-level utilisation factor |
| Hop stand | Half the stand time inside the Tinseth exponential |
| Diastatic power | °Lintner weighted across the grain bill; under 30 is flagged |
| Colour | Morey |
| Strike and step infusions | Standard 0.2 grain-to-water specific heat ratio |
| Attenuation | Apparent, from the first yeast listed |

Decoction pull volumes remain an approximation. Everything else was checked line by
line against the Brewing Recipe Template v5.0.6 workbook and agrees to within 0.05%
on its own worked example — pre-boil gravity, OG, MCU, SRM, Tinseth utilisation at
60 and 10 minutes, and total IBU.

The ingredient, yeast and style databases come from that workbook: 246 fermentables
with diastatic power, 148 hops with substitutions and flavour notes, 313 yeasts with
lab, flocculation and temperature range, and all 125 BJCP 2021 styles.

## Licence

Yours. Do what you like with it.
