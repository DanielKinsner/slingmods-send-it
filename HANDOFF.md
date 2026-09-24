# SEND IT — Handoff

_Last updated: 2026-09-24. Public repo: https://github.com/DanielKinsner/slingmods-send-it — the four model
GLBs (rider + 3 vehicles) are deliberately **not** in Git (purchased/licensed assets; purged from history too).
On a fresh clone run `npm run import-vehicles` with the Three-Wheel Tour checkout beside it. The live Vercel build
is deployed from this PC with `vercel deploy --prod` (see "Deploy" below), not from Git, so it keeps the models._

## Where it is and how to run it

Project: `C:\Users\SM - Dan\Documents\GitHub\SEND IT\slingmods-send-it`

```bash
npm install
npm run dev            # http://localhost:5190
npm test               # 30 rule + physics integration tests
npm run build          # static build in dist/ (relative base: works at / or /arcade/send-it/)
node scripts/serve-nested.mjs 5191   # serves dist/ at http://localhost:5191/arcade/send-it/
npm run bot -- sunset slingshot safe # headless playtest: course vehicle plan [preset]
npm run import-vehicles              # re-import vehicle/rider assets (read-only from Three-Wheel Tour)
```

Developer-only URL switches (never on by default): `?inspect=slingshot|ryker|spyder` (neutral-light model
view), `?bot=safe|shortcut|pool` (bot drives runs with gameplay inputs), `?dtmax=0.5` (catch-up in throttled
preview panes).

## Deploy (Vercel, from this PC)

Live: **https://slingmods-send-it.vercel.app** (project `daniel-kinsners-projects/slingmods-send-it`).

```bash
vercel build --prod --yes          # runs npm run build locally, models included
vercel deploy --prebuilt --prod --yes
```

The Vercel project is **disconnected from GitHub on purpose** (`vercel git disconnect`): a Git-triggered cloud
build would lack the git-ignored vehicle models and show the "vehicle not loaded" diagnostic. `.vercel/` is
git-ignored; on another machine run `vercel link` first (and disconnect Git again if it auto-connects).

## Verified this session

- **Tests:** `npm test` → 30/30 passed (scoring caps, exactly-once rewards, stamp rules, stunt anti-farming,
  flip detection, pending-stunt loss on fail, save sanitising + storage failure, rack layouts never overlap,
  equipment really changes physics; plus full-physics runs: safe pass, shortcut faster, pool failure,
  lost parcels not counted, recovery keeps identity/condition, clock waits for throttle, 20 retries don't grow
  the physics world).
- **Bot matrix (headless, gameplay inputs only):** every course passes its safe route with all three vehicles
  (5/5 parcels with "Low & Sensible"). Shortcuts pass for all vehicles on all courses except the heavy Spyder on
  Sunset's pool jump (falls in — by design it is "The Cargo Department").
  Typical times: safe ≈ 59–62 s, shortcut ≈ 38–52 s.
- **Production build** loads with every asset `200` under `/arcade/send-it/` (nested static server) and starts a
  run with the real Slingshot.
- **Screenshots** (real renders, not concept art): `docs/screens/` — neutral-light models (01–03), Sunset
  (10–14), Pier (20–22), HOA (30–32), Ryker/Spyder in play (40–42). Taken from the live game via a dev-only
  capture endpoint; they show the 3D frame without the DOM HUD.

## What's in the game

- **3 courses** (~350–450 m each): Sunset Express (warehouse → construction zone → rooftop/pool shortcut →
  beachfront → motel bay), Pier Pressure (snack-roof hops, low awning vs tall stacks, repair trench, arcade roofs,
  low-tide dock), HOA No (driveway crests, garage-roof shortcut over a valley with a koi pond, blind crest, narrow
  pad).
- **Real vehicles:** Slingshot 2026, Ryker 900 (default stock assembly), Spyder F3, each with the owner's fitted
  biker rider. Physics hulls/wheels/racks refitted to the measured models; collision is invisible.
- **Cargo:** 5 required parcels + optional flamingo, strapped (strain → snap), damage by impact, loose/lost
  states, slow-down pickup that restores the same parcel. Honest HUD (ON BOARD, never "delivered" mid-run).
- **Rules:** stop in the bay to deliver; ≥3 of 5 to pass; pool/wipeout/inverted/stuck/out-of-bounds fails; stunts
  bank on stable landing; 3 stamps; fictional Shop Credit awarded once per attempt; local saves
  (`slingmods-send-it-v1`).
- **Garage:** vehicle, 3 loading presets, suspension/tires/restraints (all change the simulation), cosmetic paint,
  live bounce test.
- **Comedy:** 123 voiced dispatcher lines (walkie-talkie filtered, cooldown + no-repeat), triggered by what actually
  happened (idling, reversing, crawling, speeding, honking, early losses, strap snaps, flips, pool...), slow-mo
  Incident Replay on failure, flying/floating helmet, proof-of-delivery photo, tracking history, "signed for by",
  fake customer review with stars, hold-music quips, ~40 gag signs.
- **Audio:** ElevenLabs-generated SFX (34), music loop + stings, voice; sampled engine loops crossfaded by RPM.
- **Input:** keyboard, gamepad (standard mapping), multi-touch pads; focus loss releases everything.

## Not done / not verified (honest list)

1. **Touch on a real phone and a physical controller were not tested** — code paths exist; only desktop
   keyboard/bot input were exercised.
2. **Frame rate not benchmarked in a visible window.** Measured: ~5 ms CPU per render + 0.07 ms per physics step
   on the RTX 4080 box. The in-app preview pane throttles hidden pages to ~2 fps, which is a tool artefact.
3. **Nobody has listened to the generated audio yet** (I can't hear). Dan should check the dispatcher voice, SFX
   levels and music by ear.
4. **Codex menu art: blocked, not made.** The Codex plugin (v1.0.2) sent `thread/name/set`, which the installed
   Codex CLI rejects (`unknown variant`), so the job never started. Fix: `npm install -g @openai/codex@latest`,
   then rerun the art brief (loading, three contract cards, dispatch and garage backgrounds; no text in images)
   into `public/assets/art/`. The UI works without it (contract cards use colour strips).
5. **Asset rights for public release are unresolved:** the rider is an owner-purchased character and the vehicle
   models come from Three-Wheel Tour sources; redistribution permission is not established. See
   `public/assets/vehicles/provenance.json`.
6. **Download size:** Spyder GLB is 13 MB after lossless-shape meshopt compression (from 31 MB); first load on a
   slow connection not measured. Vehicles lazy-load per choice.
7. Not built (expansion ideas from the plan): personal ghost, daily dispatch, special contracts, courses 4–12,
   mid-run achievement toasts, practice checkpoints.

## Decisions worth knowing

- Early in the session the vehicles were stylised procedural toys (per Dan's first message). Dan then asked for the
  real models; the procedural vehicle code was removed. A missing model now shows a diagnostic screen — never a
  substitute.
- Physics: Rapier 2D. Parcels and chassis use **soft CCD** — hard CCD against cargo riding on the deck clamped the
  whole vehicle's motion ("invisible walls"). Hulls are rounded to stop polyline-joint snags.
- Runs are ~60 s (safe) / ~40–50 s (shortcut), inside the plan's 60–95 s target on the safe route.
- The ElevenLabs key was only ever passed as an environment variable to `scripts/gen-audio.ts`; it is not in the
  repo or the build.

## Next highest-value task

Play all three courses by hand on the Windows PC with sound on and a controller, and list anything that feels
wrong (landings, braking distance, voice volume). Then decide on public-release rights for the rider/vehicle
assets before any deployment.
