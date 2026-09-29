# vendor/

Self-hosted engine libraries, loaded as globals by `index.html`. Copied from
Hundred Block Dash's `vendor/` (commit 2b56ae8) so both games run on the same
engine versions.

| File | Library | Version | Licence |
|---|---|---|---|
| `three.min.js` | three.js | r128 (2021) | MIT, header in file |
| `cannon.min.js` | cannon.js | 0.6.2 | MIT, header in file |

r128 is the last line that ships a UMD global build comfortably; three.js
dropped the global build after r160. Upgrading means moving to ES-module
imports across the codebase. See `docs/TECH_ARCHITECTURE.md` (risks).
