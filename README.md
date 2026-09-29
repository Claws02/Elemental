# ELEMENTAL

A high-fantasy, physics-driven mobile action-adventure. You learn to move the elements, you believe you are becoming the world's hero, and the world remembers everything you break.

> "The game never lied to me. I lied to myself."

**Status: Phase 1 technical prototype.** One ruined courtyard, ten boulders, a timber barricade, and the Earth element: grab a rock with your finger, hold it, flick it, and watch the barricade come apart. The world records that you did it.

![The courtyard](docs/assets/courtyard.png)

## Run it

It's a static site with no build step:

```bash
python3 -m http.server 8140        # or: npm run serve
# open http://localhost:8140
```

On a phone on the same network, open `http://<your-computer's-IP>:8140` It plays in portrait or landscape.

| On a phone | At a desk | Does |
|---|---|---|
| Thumb in the bottom-left quarter | WASD / arrows (Shift: run) | Move |
| Touch a rock | Click a rock | Grab it (Earth) |
| Drag | Drag | Hold it and move it |
| Flick and let go | Flick the mouse and release | Throw it |
| Let go slowly | Release slowly | Drop it |
| Drag empty world | Drag empty world | Look around |
| Pinch | Mouse wheel | Zoom |

## Test it

```bash
npm run check      # module parse + dead private-helper check
npm run smoke      # the Phase 1 gate: boot, move, grab, flick, break, budget (needs a server on :8140)
npm run sheet      # model review screenshots → qa/shots/sheet-*.png
```

CI runs all three on every push (`.github/workflows/ci.yml`).

## Docs

| | |
|---|---|
| [`docs/DESIGN_BRIEF.md`](docs/DESIGN_BRIEF.md) | The full design document: story, systems, roadmap |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | The master checklist. One task at a time |
| [`docs/TECH_ARCHITECTURE.md`](docs/TECH_ARCHITECTURE.md) | The stack, the Unity → web mapping, the frame, physics tiers, risks |
| [`docs/ART_AND_MODELS.md`](docs/ART_AND_MODELS.md) | What Hundred Block Dash's 3D models teach, and the rules Elemental's models follow |

## Relationship to Hundred Block Dash

Elemental runs on [Hundred Block Dash](https://github.com/Claws02/HundredBlockDash)'s engine stack (three.js, cannon, Capacitor) and borrows its model technique. Elemental has since moved to three.js r186 and cannon-es (`docs/TECH_ARCHITECTURE.md` §9). The pieces were **copied and adapted** at HBD commit `2b56ae8`, not linked, so the two games evolve independently:

- `src/engine/Kit.js` ← HBD `src/engine/CityKit.js` (the `Kit` accumulator)
- `qa/parsecheck.sh` ← HBD `qa/parsecheck.sh` (first two phases)
- `scripts/build-web.js` ← HBD `scripts/build-web.js`
- `HeroAnimator` follows HBD's `CharacterAnimator` approach
