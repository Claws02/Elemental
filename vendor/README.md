# vendor/

Self-hosted engine libraries as ES modules. Nothing imports them directly
except `src/engine/lib.js`, which re-exports them as `THREE` and `CANNON`.

| File | Library | Version | Licence |
|---|---|---|---|
| `three.module.min.js` + `three.core.min.js` | three.js | r186 (npm `three@0.186.1`) | MIT, `LICENSE-three.txt` |
| `cannon-es.min.js` | cannon-es | 0.20.0 | MIT, `LICENSE-cannon-es.txt` |

## How these were made

three.js stopped shipping minified builds, so both are minified here with
esbuild (no other change), keeping the licence headers:

```bash
npm pack three@0.186.1 cannon-es@0.20.0   # then untar
npx esbuild@0.25 package/build/three.core.js   --minify --format=esm --legal-comments=inline --outfile=three.core.min.js
npx esbuild@0.25 package/build/three.module.js --minify --format=esm --legal-comments=inline --outfile=three.module.min.js
sed -i 's|from"./three.core.js"|from"./three.core.min.js"|' three.module.min.js
npx esbuild@0.25 package/dist/cannon-es.js     --minify --format=esm --outfile=cannon-es.min.js
```

three.js addons (GLTFLoader for the Phase 6 characters) import the bare
specifier `'three'`; vendor them the same way, rewriting that import to
`./three.module.min.js`.

## History

Until 2026-09-29 Elemental ran three.js r128 and cannon.js 0.6.2 as globals,
copied from Hundred Block Dash. `docs/TECH_ARCHITECTURE.md` §9 records the
upgrade.
