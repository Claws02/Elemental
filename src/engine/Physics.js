// ============================================================
// PHYSICS — cannon-es, divided into tiers and held to a budget (§37, §54, §55)
// ============================================================
//
// Nothing is simulated at full fidelity just because it exists. Every body is
// registered with a TIER:
//
//   static        terrain, ruin walls, pillars. Mass 0, never moves.
//   interactive   rocks, barrels, crates. Dynamic, sleeps when still.
//   destructible  wall pieces, planks. Static until broken, then debris.
//   debris        broken pieces. Dynamic, BUDGETED: past the cap the oldest
//                 are frozen where they lie (the "cached world state" step).
//   player        the hero's capsule.
//
//   elemental     a fireball in flight or in the hand: a small dynamic
//                 sphere, so it can hit things. Fire itself (heat, spread,
//                 flames) is FireSystem's own cheap simulation, not cannon's.
//
// Cosmetic things (grass, particles) never touch cannon.
//
// cannon-es 0.20 (the maintained fork of cannon.js), from vendor/ via lib.js.
// ============================================================

import { CANNON } from './lib.js';

export const TIER = { STATIC: 'static', INTERACTIVE: 'interactive', DESTRUCTIBLE: 'destructible', DEBRIS: 'debris', PLAYER: 'player', ELEMENTAL: 'elemental' };

// The starting budget from §55. To be profiled on real phones, not trusted.
export const BUDGET = {
    debris: 40,          // simultaneously-simulated broken pieces
    killY: -25,          // anything below this has left the world
};

let world = null;
const entries = new Set();
const debrisQueue = [];     // oldest first
let mats = null;

export function init() {
    world = new CANNON.World();
    world.gravity.set(0, -22, 0);          // heavier than 9.8: throws read as weighty at game scale
    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 8;
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0.1;

    mats = {
        ground: new CANNON.Material('ground'),
        stone:  new CANNON.Material('stone'),
        wood:   new CANNON.Material('wood'),
        rock:   new CANNON.Material('rock'),
        player: new CANNON.Material('player'),
    };
    const cm = (a, b, friction, restitution) => world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction, restitution }));
    cm(mats.rock, mats.ground, 0.55, 0.12);
    cm(mats.rock, mats.stone, 0.5, 0.18);
    cm(mats.rock, mats.wood, 0.5, 0.08);
    cm(mats.rock, mats.rock, 0.5, 0.15);
    cm(mats.wood, mats.ground, 0.6, 0.05);
    cm(mats.wood, mats.wood, 0.6, 0.02);
    // The hero slides along walls instead of sticking to them.
    cm(mats.player, mats.ground, 0.0, 0.0);
    cm(mats.player, mats.stone, 0.0, 0.0);
    cm(mats.player, mats.wood, 0.0, 0.0);
    cm(mats.player, mats.rock, 0.0, 0.0);
    return world;
}

export function getWorld() { return world; }
export function material(name) { return mats[name]; }

/**
 * Register a body (and optionally the mesh that follows it).
 * Returns the entry; keep it to change tier or remove later.
 */
export function add({ body, mesh = null, tier, id = null, data = {} }) {
    const e = { body, mesh, tier, id, data, spawn: null };
    body.userData = e;               // cannon bodies are plain objects; this is how collisions find their entry
    world.addBody(body);
    entries.add(e);
    if (tier === TIER.INTERACTIVE) e.spawn = { p: body.position.clone(), q: body.quaternion.clone() };
    if (tier === TIER.DEBRIS) _enqueueDebris(e);
    return e;
}

export function remove(e) {
    if (!entries.has(e)) return;
    world.removeBody(e.body);
    entries.delete(e);
    const i = debrisQueue.indexOf(e);
    if (i >= 0) debrisQueue.splice(i, 1);
    e.mesh?.parent?.remove(e.mesh);
}

/** Turn a static destructible piece into simulated debris. */
export function toDebris(e, mass) {
    const b = e.body;
    b.type = CANNON.Body.DYNAMIC;
    b.mass = mass;
    b.updateMassProperties();
    b.linearDamping = 0.05;
    b.angularDamping = 0.2;
    b.allowSleep = true;
    b.sleepSpeedLimit = 0.25;
    b.sleepTimeLimit = 0.6;
    b.wakeUp();
    e.tier = TIER.DEBRIS;
    _enqueueDebris(e);
}

/**
 * Put a piece back: static again, at `pos`/`quat` (plain {x,y,z}/{x,y,z,w}),
 * re-added to the world if it had fallen out of it. For rebuilt structures.
 */
export function restore(e, pos, quat, tier = TIER.DESTRUCTIBLE, mass = 0) {
    const b = e.body;
    const i = debrisQueue.indexOf(e);
    if (i >= 0) debrisQueue.splice(i, 1);
    b.type = mass > 0 ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC;
    b.mass = mass;
    b.updateMassProperties();
    if (mass > 0) b.wakeUp();
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.position.set(pos.x, pos.y, pos.z);
    b.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    b.aabbNeedsUpdate = true;
    if (!b.world) world.addBody(b);
    entries.add(e);
    e.tier = tier;
    delete e.data.frozen;
    if (e.mesh) { e.mesh.position.set(pos.x, pos.y, pos.z); e.mesh.quaternion.set(quat.x, quat.y, quat.z, quat.w); }
}

function _enqueueDebris(e) {
    debrisQueue.push(e);
    while (debrisQueue.length > BUDGET.debris) _freeze(debrisQueue.shift());
}

// Past the budget, the oldest debris stops being simulated and stays exactly
// where it lies. It still collides (as a static body) so nothing falls
// through it.
function _freeze(e) {
    const b = e.body;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.type = CANNON.Body.STATIC;
    b.mass = 0;
    b.updateMassProperties();
    e.tier = TIER.STATIC;
    e.data.frozen = true;
}

export function step(dt) {
    if (!world) return;
    // Cover a 100 ms frame at the 1/60 fixed step without slow motion.
    world.step(1 / 60, Math.min(dt, 0.1), 6);
    for (const e of entries) {
        const b = e.body;
        if (b.type === CANNON.Body.STATIC) continue;
        if (b.position.y < BUDGET.killY) { _outOfWorld(e); continue; }
        if (e.mesh && b.sleepState !== CANNON.Body.SLEEPING) {
            e.mesh.position.copy(b.position);
            e.mesh.quaternion.copy(b.quaternion);
        }
    }
}

// A rock thrown out of the world comes back where it started; debris that
// falls out is simply gone.
function _outOfWorld(e) {
    if (e.tier === TIER.INTERACTIVE && e.spawn) {
        e.body.position.copy(e.spawn.p);
        e.body.quaternion.copy(e.spawn.q);
        e.body.velocity.set(0, 0, 0);
        e.body.angularVelocity.set(0, 0, 0);
        e.data.respawned = (e.data.respawned || 0) + 1;
    } else if (e.tier !== TIER.PLAYER) {
        remove(e);
    }
}

export function stats() {
    const s = { total: entries.size, awake: 0, static: 0, interactive: 0, destructible: 0, debris: 0, player: 0 };
    for (const e of entries) {
        s[e.tier] = (s[e.tier] || 0) + 1;
        if (e.body.type !== CANNON.Body.STATIC && e.body.sleepState !== CANNON.Body.SLEEPING) s.awake++;
    }
    return s;
}

export function all() { return entries; }
