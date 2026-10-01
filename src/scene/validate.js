// ============================================================
// VALIDATE — is a scene file sound? (the loader, the editor, CI)
// ============================================================
//
// Pure data checks, no three.js, so node (scripts/validate-scenes.mjs) and
// Elemental-Editor run exactly what the game would. Returns a list of
// problems: { level: 'error' | 'warn', where, msg }. Errors would break the
// game; warnings are probably mistakes.
// ============================================================

import { FORMAT, TYPES, CONDITIONS, ACTIONS, REACTION_EVENTS, GROUND_STYLES, MOOD_NAMES, REGION_NAMES, signalsOf, actionsOf } from './schema.js';
import { PREFABS, expandPrefab } from '../data/prefabs.js';
import { parseWhen } from './when.js';

export function validateScene(data) {
    const out = [];
    const err = (where, msg) => out.push({ level: 'error', where, msg });
    const warn = (where, msg) => out.push({ level: 'warn', where, msg });
    if (!data || typeof data !== 'object') { err('scene', 'not an object'); return out; }
    if (data.format !== FORMAT) err('scene', `format should be ${FORMAT}`);
    if (!data.id || !/^[\w-]+$/.test(data.id)) err('scene', 'id must be letters, digits, - or _');
    const g = data.settings?.ground;
    if (g && !GROUND_STYLES.includes(g.style)) err('settings', `unknown ground style "${g.style}"`);
    const st = data.settings || {};
    if (st.mood && !MOOD_NAMES.includes(st.mood)) err('settings', `unknown mood "${st.mood}" (${MOOD_NAMES.join(', ')})`);
    if (st.region && !(st.region in REGION_NAMES)) err('settings', `unknown kingdom "${st.region}" (${Object.keys(REGION_NAMES).join(', ')})`);

    // ---- objects -------------------------------------------------------------
    const ids = new Map();
    const objs = Array.isArray(data.objects) ? data.objects : (err('scene', 'objects must be a list'), []);
    const all = [];
    for (const o of objs) {
        all.push(o);
        if (o?.type === 'prefab') {
            if (!PREFABS[o.prefab]) err(o.id, `unknown building "${o.prefab}"`);
            else all.push(...expandPrefab(o));
        }
    }
    let spawns = 0;
    for (const o of all) {
        const where = o?.id || '(no id)';
        if (!o?.id) { err(where, 'an object has no id'); continue; }
        if (ids.has(o.id)) err(where, 'two objects share this id');
        ids.set(o.id, o);
        const t = TYPES[o.type];
        if (!t) { err(where, `unknown type "${o.type}"`); continue; }
        for (const k of ['x', 'z']) if (typeof o[k] !== 'number' || !isFinite(o[k])) err(where, `${k} must be a number`);
        if (o.type === 'spawn') spawns++;
        for (const [k, f] of Object.entries(t.props)) {
            const v = o[k];
            if (v === undefined) continue;
            if ((f.kind === 'number' || f.kind === 'int') && (typeof v !== 'number' || v < f.min || v > f.max)) warn(where, `${f.label} ${v} is outside ${f.min}–${f.max}`);
            if (f.kind === 'select' && !f.options.includes(v)) err(where, `${f.label} "${v}" is not one of ${f.options.join(', ')}`);
        }
    }
    const spawnNames = all.filter(o => o.type === 'spawn').map(o => o.name || 'start');
    if (spawns === 0) err('scene', 'no player start');
    else if (!spawnNames.includes('start')) warn('scene', 'no player start named "start": the first one is used');
    for (const n of new Set(spawnNames)) if (spawnNames.filter(x => x === n).length > 1) err('scene', `two player starts are named "${n}"`);
    for (const o of all) {
        if (o.showWhen) for (const c of parseWhen(o.showWhen)) if (c.bad) err(o.id, `"Only when" can't read "${c.bad}"`);
        if (o.type === 'exit' && !o.to) warn(o.id, 'an exit that goes nowhere: set "Goes to scene"');
    }
    for (const o of all) {
        for (const [k, f] of Object.entries(TYPES[o.type]?.props || {})) {
            if (f.kind !== 'ref' || !o[k]) continue;
            const r = ids.get(o[k]);
            if (!r) err(o.id, `${f.label}: no object "${o[k]}"`);
            else if (f.types && !f.types.includes(r.type)) err(o.id, `${f.label}: "${o[k]}" is a ${r.type}, not ${f.types.join(' or ')}`);
        }
    }
    const isObj = id => ids.has(id);
    const sig = (where, obj, name) => {
        if (!isObj(obj)) return err(where, `no object "${obj}"`);
        const t = ids.get(obj).type;
        if (!signalsOf(t).includes(name)) err(where, `a ${t} has no signal "${name}" (it has: ${signalsOf(t).join(', ') || 'none'})`);
    };
    const act = (where, obj, name) => {
        if (!isObj(obj)) return err(where, `no object "${obj}"`);
        const t = ids.get(obj).type;
        if (!['reveal', 'hide'].includes(name) && !actionsOf(t).includes(name)) err(where, `a ${t} can't "${name}" (it can: ${actionsOf(t).join(', ') || 'nothing'})`);
    };

    // ---- wires ---------------------------------------------------------------
    const wireIds = new Set();
    for (const w of data.wires || []) {
        const where = `wire ${w.id || '(no id)'}`;
        if (!w.id) err(where, 'a wire has no id');
        if (wireIds.has(w.id)) err(where, 'two wires share this id');
        wireIds.add(w.id);
        if (!['all', 'any'].includes(w.mode || 'all')) err(where, 'mode is all or any');
        if (!(w.inputs || []).length) warn(where, 'no inputs: it never fires');
        for (const i of w.inputs || []) sig(where, i.obj, i.signal);
        for (const a of [...(w.do || []), ...(w.undo || [])]) act(where, a.obj, a.action);
    }

    // ---- script ----------------------------------------------------------------
    const s = data.script;
    if (s) {
        if (s.speaker && (!isObj(s.speaker) || ids.get(s.speaker).type !== 'npc')) err('script', `the speaker "${s.speaker}" is not a character in the scene`);
        if (s.face && !isObj(s.face)) err('script', `opens facing "${s.face}", which isn't in the scene`);
        const stepIds = new Set((s.steps || []).map(x => x.id));
        const cond = (where, c) => {
            if (!c || typeof c !== 'object') return err(where, 'empty condition');
            const [k, v] = Object.entries(c)[0] || [];
            if (!CONDITIONS[k]) return err(where, `unknown condition "${k}"`);
            if (['all', 'any'].includes(k)) (v || []).forEach(x => cond(where, x));
            else if (k === 'not') cond(where, v);
            else if (k === 'held' && v !== '*' && !isObj(v)) err(where, `holding: no object "${v}"`);
            else if (k === 'heldFor' && !isObj(v?.obj)) err(where, `held steady: no object "${v?.obj}"`);
            else if (k === 'signal') sig(where, v?.obj, v?.name);
            else if (k === 'wire' && !wireIds.has(v)) err(where, `no wire "${v}"`);
            else if (['broken', 'burned'].includes(k) && !isObj(v?.obj)) err(where, `no object "${v?.obj}"`);
        };
        const acts = (where, list) => {
            for (const a of list || []) {
                const [k, v] = Object.entries(a || {})[0] || [];
                if (!ACTIONS[k]) { err(where, `unknown action "${k}"`); continue; }
                if (k === 'do') act(where, v?.obj, v?.action);
                if (k === 'reveal' || k === 'hide') [].concat(v).forEach(id => { if (!isObj(id)) err(where, `${k}: no object "${id}"`); });
                if (k === 'card' && v && !s.card) warn(where, 'shows the end card, but the script has none');
            }
        };
        const next = (where, n) => { if (n && n !== 'done' && !stepIds.has(n)) err(where, `goes to "${n}", which isn't a step`); };
        const seen = new Set();
        for (const st of s.steps || []) {
            const where = `step ${st.id || '(no id)'}`;
            if (!st.id) err(where, 'a step has no id');
            if (seen.has(st.id)) err(where, 'two steps share this id');
            seen.add(st.id);
            if (st.mark && !isObj(st.mark)) err(where, `marks "${st.mark}", which isn't in the scene`);
            acts(where, st.do);
            for (const w of st.waiting || []) { cond(where, w.when); acts(where, w.do); }
            if (st.until) { cond(where, st.until); acts(where, st.then?.do); next(where, st.then?.next); }
            for (const e of st.ends || []) { cond(where, e.when); acts(where, e.do); next(where, e.next); }
            for (const c of st.choices || []) { if (!c.label) err(where, 'a choice has no words'); acts(where, c.do); next(where, c.next); }
            if (!st.until && !(st.ends || []).length && !(st.choices || []).length) warn(where, 'never ends: give it "until", an ending or choices');
        }
        for (const r of s.reactions || []) if (!REACTION_EVENTS[r.on]) err('script', `unknown reaction "${r.on}"`);
    }
    return out;
}
