# SlingMods: SEND IT

> Your parts are out for delivery. Probably.

A 2.5D stunt-delivery browser game: drive a real SlingMods three-wheeler with five wobbly parcels (and one optional
flamingo) to the delivery bay. Take the sensible road or the rooftop shortcut. Deliver at least three.

**Controls:** `W`/`↑` gas · `S`/`↓` brake (hold to reverse) · `A`/`D` nose up / nose down in the air · `R` retry ·
`Esc` pause · `H` horn. Gamepad: RT/LT, left stick pitch, hold LB+RB to retry. Touch pads on phones.

```bash
npm install
npm run dev     # http://localhost:5190
npm test
npm run build   # dist/ — static, works at a site root or nested (e.g. /arcade/send-it/)
```

**Vehicle models are not in this repo.** The Slingshot, Ryker, Spyder and rider GLBs are licensed/purchased
assets, so they're git-ignored. With a local checkout of the Three-Wheel Tour project beside this one, run
`npm run import-vehicles` to rebuild them into `public/assets/vehicles/` (the game shows a clear diagnostic if
they're missing). Everything else — code, courses, audio, UI — is here.

Stack: TypeScript, Vite, Three.js (rendering), Rapier 2D (physics). See `HANDOFF.md` for status, verification and
asset provenance.

Fictional arcade physics. Real-world riding rules still apply.
