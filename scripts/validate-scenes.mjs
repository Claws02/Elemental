#!/usr/bin/env node
// ============================================================
// VALIDATE SCENES — every scenes/*.json against src/scene/validate.js
// ============================================================
//
// The same checks Elemental-Editor shows as you work, run in CI and before a
// scene pulled from the editor is committed.
//
// usage: node scripts/validate-scenes.mjs [scenes/one.json …]
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateScene } from '../src/scene/validate.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = process.argv.slice(2).length ? process.argv.slice(2)
    : fs.readdirSync(path.join(ROOT, 'scenes')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'scenes', f));

let errors = 0;
for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { console.log(`✗ ${path.basename(f)}: not JSON (${e.message})`); errors++; continue; }
    const probs = validateScene(data);
    const n = probs.filter(p => p.level === 'error').length;
    if (path.basename(f, '.json') !== data.id) probs.push({ level: 'error', where: 'scene', msg: `id "${data.id}" should match the file name` });
    errors += probs.filter(p => p.level === 'error').length;
    console.log(`${n ? '✗' : '✓'} ${path.basename(f)}: ${data.objects?.length ?? 0} objects, ${data.wires?.length ?? 0} wires, ${data.script ? (data.script.steps || []).length + ' steps' : 'no script'}`);
    for (const p of probs) console.log(`    ${p.level === 'error' ? 'ERROR' : 'warn '} ${p.where}: ${p.msg}`);
}
if (errors) { console.log(`SCENES FAIL (${errors} error${errors > 1 ? 's' : ''})`); process.exit(1); }
console.log('SCENES OK');
