// ============================================================
// LOADER — a scene file becomes a world (docs/SCENES.md)
// ============================================================
//
//   buildScene(scene, data)   ground, then every object through the catalog
//                             (prefabs expanded into their pieces), then the
//                             links between objects (a plate's chain)
//   wireScene(world, sys)     tell the element systems what things are made
//                             of; hidden things are wired when revealed
//
// The WORLD it returns is what the rest of the game reads:
//
//   objects   id → instance (Catalog.js)          rocks, props   physics lists
//   braziers, basins, barricades, plates, npcs    by kind
//   barricade the first barricade (the HUD and the QA tests read it)
//   spawn     { x, z, facing }                   solids   camera blockers
//   update(dt, frame)    every instance's update, the wires, the reset aid
//   signal(id, name) · act(id, name) · reveal(id) · hide(id)
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { flagstoneFloor } from '../art/PropModels.js';
import { groundBase } from '../art/TownModels.js';
import { Terrain, decodeTerrain } from '../world/Terrain.js';
import { Ground } from '../world/Ground.js';
import { WaterBodies } from '../world/WaterBodies.js';
import { batchScenery } from '../world/Batcher.js';
import { STRUCTURAL } from '../world/Structure.js';
import { CATALOG, withDefaults, expandPrefab } from './Catalog.js';
import { Wires } from './Wires.js';
import { PropReset } from './PropReset.js';
import { whenHolds } from './when.js';
import { EventBus, EV } from '../core/EventBus.js';
import { STATE, SINK } from '../world/Destructible.js';

/** Every object, prefabs replaced by their pieces. */
export function flatObjects(data) {
    const out = [];
    for (const it of data.objects || []) {
        // A prefab is one structure (its walls, floors, roofs); what else it holds (a brazier, a banner) stands on its own.
        if (it.type === 'prefab') out.push(it, ...expandPrefab(withDefaults(it)).filter(pc => !STRUCTURAL.has(pc.type)));
        else out.push(it);
    }
    return out;
}

/**
 * @param {object} [o]
 * @param {Function} [o.flag]   name → a story flag's value (for showWhen)
 * @param {Function} [o.state]  id → a remembered world state
 */
export function buildScene(scene, data, { flag = () => undefined, state = () => null } = {}) {
    const st = data.settings || {};
    const world = {
        data, scene, solids: [], rocks: [], props: [], braziers: [], basins: [], barricades: [], plates: [], npcs: [],
        objects: new Map(), creatureGroups: [], creatures: null, spawns: {}, spawn: null, sys: null, rising: [], onExit: null, session: null,
    };

    // ---- ground: a height field (terrain scenes), or a flat floor ----------------------
    Ground.reset();
    world.waters = Ground.waters = new WaterBodies();
    if (st.terrain) {
        world.terrain = Ground.terrain = new Terrain(decodeTerrain(st.terrain)).build(scene);
    } else {
        const g = st.ground || { half: 14, style: 'flagstone' };
        scene.add(g.style === 'flagstone' ? flagstoneFloor(g.half) : groundBase(g.half, g.style));
        const ground = new CANNON.Body({ mass: 0, material: Physics.material('ground') });
        ground.addShape(new CANNON.Plane());
        ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        Physics.add({ body: ground, tier: TIER.STATIC, id: 'Ground', data: { ground: true } });
    }

    // ---- objects -----------------------------------------------------------------
    const ctx = { scene, world };
    // On terrain, an object's y is above the ground where it stands (water keeps its absolute level). A prefab
    // is seated once, at its own centre, before it becomes pieces: its walls must not follow the slope apart.
    const seated = !world.terrain ? data : { ...data, objects: (data.objects || []).map(o =>
        CATALOG[o.type]?.absolute ? o : { ...o, y: (o.y || 0) + Ground.height(o.x || 0, o.z || 0) }) };
    for (const raw of flatObjects(seated)) {
        const it = withDefaults(raw);
        if (it.showWhen && !whenHolds(it.showWhen, { flag, state })) continue;     // not in this world state
        const c = CATALOG[it.type];
        if (!c) { console.warn(`[scene] unknown type "${it.type}" (${it.id}): skipped`); continue; }
        if (world.objects.has(it.id)) console.warn(`[scene] duplicate id "${it.id}"`);
        const inst = c.spawn(ctx, it);
        Object.assign(inst, { id: it.id, type: it.type, item: it, wired: false, hidden: false });
        world.objects.set(it.id, inst);
    }
    for (const inst of world.objects.values()) inst.link?.(world);
    // A big scene's scenery: merged into a few meshes (world/Batcher.js).
    world.batches = [];
    if (world.terrain) batchScenery(scene, world);
    world.barricade = world.barricades[0] || null;
    world.spawn = world.spawns.start || Object.values(world.spawns)[0] || { x: 0, y: 0, z: 0, facing: Math.PI };

    // ---- behaviour -------------------------------------------------------------------
    world.wires = new Wires(world, data.wires || []);
    world.propReset = new PropReset(world, st.resetAfter || 0);

    world.signal = (id, name) => {
        const inst = world.objects.get(id);
        if (!inst) return false;
        if (name === 'visible') return !inst.hidden;
        return !!inst.signal?.(name, world.sys);
    };
    world.act = (id, name) => {
        const inst = world.objects.get(id);
        if (!inst) return console.warn(`[scene] no object "${id}" for action ${name}`);
        if (name === 'reveal') return world.reveal(id);
        if (name === 'hide') return world.hide(id);
        inst.act?.(name);
    };
    world.hide = id => _hide(world, world.objects.get(id));
    world.reveal = id => { const inst = world.objects.get(id); if (inst?.hidden) world.onReveal?.(id); _reveal(world, inst); };
    world.update = (dt, frame) => {
        for (const inst of world.objects.values()) if (!inst.hidden) inst.update?.(dt, frame);
        _rise(world, dt);
        world.wires.update();
        world.propReset.update(dt);
    };

    for (const inst of world.objects.values()) if (inst.item.hidden) world.hide(inst.id);
    return world;
}

export function wireScene(world, sys) {
    world.sys = sys;
    world.propReset.fire = sys.fire;
    for (const inst of world.objects.values()) if (!inst.hidden) _wire(world, inst);
}

// ---- remembering: persistent scenes keep what happened to their objects ----------------
//
// A scene with settings.persistent writes lasting changes to the save session
// by object id (a barricade Burned, a hay bale burned, a stone revealed, a gate
// open) and puts them back when the scene loads again.

export function rememberScene(world, session) {
    world.session = session;
    if (!world.data.settings?.persistent) return () => {};
    const set = (id, v) => { if (world.objects.has(id)) { session.setState(id, v); EventBus.emit(EV.WORLD_STATE, { id, state: v }); } };
    // Put back what the save remembers.
    for (const [id, inst] of world.objects) {
        const s = session.state(id);
        if (!s) continue;
        if (inst.restoreState) inst.restoreState(s);
        else if (inst.destructible) {
            if (s === STATE.BURNED || s === STATE.COLLAPSED) inst.destructible.collapseNow(s === STATE.BURNED);
            else if (s === 'Raised') inst.destructible.raiseNow();
            else if (s === 'Sunk') { inst.destructible.raiseNow(-SINK); inst.destructible.sunk = true; }
        } else if (s === 'burned' && inst.prop?.thing) world.sys.fire.markBurned(inst.prop.thing);
        else if (s === 'revealed' && inst.hidden) _revealNow(world, inst);
        else if (s === 'open') inst.openNow?.();
    }
    const off = [
        EventBus.on(EV.STRUCTURE_STATE, e => { if (['Raised', 'Sunk', STATE.COLLAPSED, STATE.BURNED].includes(e.to)) set(e.id, e.to); else if (e.cause === 'rebuilt') set(e.id, null); }),
        EventBus.on(EV.FIRE_OUT, e => { if (e.burnedOut) set(e.id, 'burned'); }),
    ];
    world.onReveal = id => set(id, 'revealed');
    world.onGate = (id, v) => set(id, v);
    return () => off.forEach(f => f());
}

function _revealNow(world, inst) {
    inst.hidden = false;
    for (const m of [inst.mesh, ...(inst.extra || [])].filter(Boolean)) world.scene.add(m);
    for (const s of inst.saved || []) Physics.restore(s.e, s.p, s.q, s.tier, s.tier === TIER.INTERACTIVE ? s.mass : 0);
    _wire(world, inst);
}

function _wire(world, inst) {
    if (inst.wired || !world.sys) return;
    inst.wired = true;
    inst.wire?.(world.sys);
}

// ---- hiding and revealing -------------------------------------------------------------
//
// A hidden object is out of the world: no mesh, no bodies, not wired to the
// elements. Revealed, it rises out of the ground where it was placed.

function _hide(world, inst) {
    if (!inst || inst.hidden) return;
    inst.hidden = true;
    inst.saved = inst.entries.map(e => ({ e, p: e.body.position.clone(), q: e.body.quaternion.clone(), tier: e.tier, mass: e.body.mass }));
    for (const e of inst.entries) Physics.remove(e);
    for (const m of [inst.mesh, ...(inst.extra || [])]) m?.parent?.remove(m);
    world.rising = world.rising.filter(r => r.inst !== inst);
}

function _reveal(world, inst) {
    if (!inst || !inst.hidden) return;
    inst.hidden = false;
    const meshes = [inst.mesh, ...(inst.extra || [])].filter(Boolean);
    for (const m of meshes) world.scene.add(m);
    // How far below the ground to start: the object's own height.
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const drop = Math.max(0.5, box.max.y - box.min.y) + 0.1;
    world.rising.push({ inst, meshes: meshes.map(m => ({ m, y: m.position.y })), drop, t: 0 });
    for (const { m, y } of world.rising.at(-1).meshes) m.position.y = y - drop;
}

function _rise(world, dt) {
    if (!world.rising.length) return;
    for (const r of world.rising) {
        r.t = Math.min(1, r.t + dt / 1.2);
        const k = 1 - (1 - r.t) ** 3;
        for (const { m, y } of r.meshes) m.position.y = y - r.drop * (1 - k);
        if (r.t >= 1) {
            for (const s of r.inst.saved || []) Physics.restore(s.e, s.p, s.q, s.tier, s.tier === TIER.INTERACTIVE ? s.mass : 0);
            _wire(world, r.inst);
        }
    }
    world.rising = world.rising.filter(r => r.t < 1);
}
