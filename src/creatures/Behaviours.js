// ============================================================
// BEHAVIOURS — the rest of Aerath's bestiary (the world bible, phase 5)
// ============================================================
//
// Each creature's mind, and its answer to the elements, follows from what it
// physically is, so a player can work it out:
//
//   tank      Shellback      shrugs off hits; stone raised under it flips it
//                            onto its back, and on its back it is soft
//   swarm     Cindermite     pours from a vent toward heat; lure it with a hot
//                            stone; water kills it; block the vent and no more come
//   lumber    Mudling        swallows thrown stones; struck hard it splits in
//                            two; fire bakes it brittle, then a stone shatters it
//   swim      Brinecoil      stays in its water; shocks anyone wading near it,
//                            and whoever draws a stream from its water; ice pins it
//   kite      Gale-kite      glides high, dives, climbs out of reach; wind or a
//                            thrown weight brings it down to the ground for a while
//   freezer   Frostmaw       freezes the path behind you shut; its bite chills;
//                            fire thaws it slow and clumsy
//   guard     Glass-wight    holds its post; fire bounces back at you; only a
//                            heavy blow lands (and shatters it)
//   sentinel  Lantern        binds you in its light; put its rune lamps out with
//             Sentinel       a careful stream; hit it hard and it raises the alarm
//   shifter   Wellspawn      changes element every few seconds; only the
//                            opposite of what it is now can hurt it
//
// A behaviour is { init, update, react, weakness, hold, pose, own, onRaised }
// (Creatures.js calls them). `react` may return a new amount, or null (no effect).
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { OPPOSITE } from '../data/creatures.js';
import { Ground } from '../world/Ground.js';

const G = 22;
const _v = new THREE.Vector3();
const toward = (c, p) => _v.set(p.x - c.pos.x, 0, p.z - c.pos.z);

// Walk up and strike when in reach, every attack.every seconds.
function brawl(c, dt, move, speed, dist, { knock = 3, onHit = null } = {}) {
    const hero = c.sys.player.position, a = c.sp.attack;
    const d = toward(c, hero);
    if (dist > c.sp.reach * 0.8) move(d.normalize(), speed);
    else { c.body.velocity.x *= 0.8; c.body.velocity.z *= 0.8; c._face(Math.atan2(d.x, d.z), 6 * dt); }
    c.nextAttack -= dt;
    if (c.nextAttack <= 0 && c._reach()) {
        c.nextAttack = a.every;
        c._hitHero(a.damage, d.normalize(), a.knock ?? knock);
        onHit?.();
    }
}

export const BEHAVIOURS = {
    // ---- Shellback -----------------------------------------------------------------------------------
    tank: {
        init: c => { c.flipped = 0; },
        update: (c, dt, move, speed, dist) => brawl(c, dt, move, speed, dist, { knock: 6 }),
        weakness: (c, kind) => (c.sp.weak[kind] ?? 1) * (c.flipped > 0 ? c.sp.weak.flipped / Math.max(0.05, c.sp.weak[kind] ?? 1) : 1),
        // Stone rising under it tips it over.
        onRaised: (c, x, z) => {
            if (Math.hypot(c.pos.x - x, c.pos.z - z) > 1.7 || c.flipped > 0) return;
            c.flipped = c.sp.flipTime;
            c.body.velocity.y += 5;
            EventBus.emit(EV.CREATURE, { id: c.id, species: 'shellback', to: 'flipped', cause: 'player' });
        },
        hold: (c, dt) => {
            if (c.flipped <= 0) return false;
            c.flipped -= dt;
            c.body.velocity.x *= 0.9; c.body.velocity.z *= 0.9;
            return true;
        },
        pose: (c, dt, T) => {
            const r = c.model.root;
            if (c.flipped > 0) { r.rotation.z = Math.PI; r.position.y += c.sp.radius * 1.6; c.model.parts.legs?.forEach((l, i) => { l.rotation.x = Math.sin(T * 12 + i) * 0.8; }); }
        },
    },

    // ---- Cindermite ------------------------------------------------------------------------------------
    swarm: {
        own: true,
        update: (c, dt, move, speed, dist) => {
            // The warmest thing it can sense: a hot stone, a fire, or the hero holding fire; else the hero.
            const F = c.sys.fire, p = c.pos;
            let best = null, bd = c.sp.sense;
            for (const t of F.heatables) {
                const h = t.entry.data.heat || 0, q = t.mesh.position, d = Math.hypot(q.x - p.x, q.z - p.z);
                if (h > 0.3 && d < bd) { bd = d; best = q; }
            }
            for (const f of F.flammables.values()) {
                if (!f.burning) continue;
                const q = f.thing.pos(), d = Math.hypot(q.x - p.x, q.z - p.z);
                if (d < bd) { bd = d; best = q; }
            }
            if (best) {
                c.lured = true;
                const d = toward(c, best), l = d.length();
                if (l > 0.9) move(d.normalize(), speed); else { c.body.velocity.x *= 0.7; c.body.velocity.z *= 0.7; }      // feeding on the heat
                return;
            }
            c.lured = false;
            if (c.engaged || c.group.item.aggressive) brawl(c, dt, move, speed, dist, { knock: 1 });
            else c._wander(dt, move, speed);
        },
        pose: (c, dt, T) => { c.model.root.position.y += Math.abs(Math.sin(T * 18 + c.home.x)) * 0.05; },
    },

    // ---- Mudling ---------------------------------------------------------------------------------------------
    lumber: {
        init: c => { c.bake = 0; c.baked = 0; c.gen = c.group.splitGen?.get(c.id) || 0; },
        update: (c, dt, move, speed, dist) => brawl(c, dt, move, speed * (c.baked > 0 ? 0.5 : 1), dist, { knock: 4 }),
        react: (c, kind, amount) => {
            if (kind === 'fire') {
                c.bake += amount;
                if (c.bake >= c.sp.bakeAt && c.baked <= 0) { c.baked = c.sp.bakeTime; c.bake = 0; EventBus.emit(EV.CREATURE, { id: c.id, species: 'mudling', to: 'baked' }); }
                return amount;
            }
            if (kind === 'impact' && c.baked <= 0) {
                // Soft: the stone sinks in. A hard blow splits it in two (once).
                if (amount > 8 && c.gen === 0 && c.sp.splits && !c.split) { c.split = true; c.sys.splitMudling(c); }
                return null;
            }
            return amount;
        },
        weakness: (c, kind) => kind === 'impact' && c.baked > 0 ? c.sp.weak.baked : (c.sp.weak[kind] ?? 1),
        hold: (c, dt) => { if (c.baked > 0) c.baked -= dt; return false; },
        pose: c => {
            const m = c.model.ownMaterials?.body;
            if (m && c.baked > 0) m.color.setHex(c.sp.look.baked);
            else if (m && !c.flash) m.color.setScalar(1);
        },
    },

    // ---- Brinecoil -----------------------------------------------------------------------------------------------
    swim: {
        own: true,
        init: c => { c.pool = Ground.water(c.home.x, c.home.z); c.shockT = 1; },
        update: (c, dt, move, speed, dist) => {
            const b = c.body, pool = c.pool || Ground.water(c.pos.x, c.pos.z);
            if (!pool || !Ground.water(c.pos.x, c.pos.z)) {
                // Out of water: it flops, and drowns in air.
                c.hp -= 6 * dt;
                if (c.hp <= 0) c._die();
                return;
            }
            // Swim just under the surface.
            b.velocity.y += G * dt + (pool.level - 0.25 - b.position.y) * 4 * dt - b.velocity.y * 2 * dt;
            const hero = c.sys.player.position, W = c.sys.world.waters;
            const heroIn = c.sys.player.wading > 0 && W.at(hero.x, hero.z) === pool;
            let goal = c.home;
            if ((c.engaged || c.group.item.aggressive) && dist < c.sp.sense) goal = W.nearest(pool, hero);
            const d = toward(c, goal);
            if (d.length() > 1) move(d.normalize(), speed); else c._wander(dt, move, speed * 0.5);
            // Shock: the water around it is dangerous to wade, and a stream drawn from it carries the charge.
            c.shockT -= dt;
            if (c.shockT <= 0) {
                c.shockT = c.sp.attack.every;
                const s = c.sys.water?.stream;
                const streamFromHere = s && W.at(s.source.surface.x, s.source.surface.z) === pool && s.source.surface.distanceTo(c.pos) < c.sp.attack.shock + 2;
                if ((heroIn && dist < c.sp.attack.shock) || streamFromHere) {
                    c.sys.vitals.hurt(c.sp.attack.damage * c.dmgK, 'shock', c.id);
                    c.flash = 0.3;
                    EventBus.emit(EV.CREATURE, { id: c.id, species: 'brinecoil', to: 'shock' });
                }
            }
        },
        pose: (c, dt, T) => { c.model.parts.tail && (c.model.parts.tail.rotation.y = Math.sin(T * 6) * 0.6); },
    },

    // ---- Gale-kite ----------------------------------------------------------------------------------------------
    kite: {
        init: c => { c.groundT = 0; },
        update: (c, dt, move, speed, dist) => c._fly(dt, move, speed, dist),
        react: (c, kind, amount) => {
            // Wind spills its air; a thrown weight knocks it out of the sky.
            if ((kind === 'wind' && amount > 0.4) || (kind === 'impact' && amount > 2)) { c.grounded = true; c.groundT = c.sp.groundTime; }
            return amount;
        },
        weakness: (c, kind) => (c.sp.weak[kind] ?? 1) * (c.grounded ? c.sp.weak.grounded : 1),
        hold: (c, dt) => {
            if (!c.grounded) return false;
            c.groundT -= dt;
            c.body.velocity.x *= 0.85; c.body.velocity.z *= 0.85;
            if (c.groundT <= 0) { c.grounded = false; c.body.velocity.y += 6; }
            return true;
        },
        pose: (c, dt, T) => {
            const w = c.model.parts.wings;
            if (w) w.forEach((j, i) => { j.rotation.z = (i ? -1 : 1) * (c.grounded ? Math.sin(T * 20) * 0.5 : Math.sin(T * 2.5 + i) * 0.25); });
            if (c.grounded) c.model.root.rotation.x = 0.3;
        },
    },

    // ---- Frostmaw -----------------------------------------------------------------------------------------------
    freezer: {
        init: c => { c.wallT = c.sp.wallEvery; c.thawed = 0; },
        update: (c, dt, move, speed, dist) => {
            const slow = c.thawed > 0 ? 0.4 : 1;
            brawl(c, dt, move, speed * slow, dist, { onHit: () => { c.sys.player.mired = Math.max(c.sys.player.mired || 0, c.sp.attack.chill); } });
            // Shut the way behind you: an ice wall across your path, at your back.
            c.wallT -= dt * slow;
            if (c.wallT <= 0 && dist < 14 && c.sys.ice) {
                c.wallT = c.sp.wallEvery;
                const hero = c.sys.player.position, d = toward(c, hero).normalize();
                const P = new THREE.Vector3(hero.x + d.x * 3, 0, hero.z + d.z * 3);
                P.y = Ground.height(P.x, P.z) + 0.2;
                const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(3);
                c.sys.ice.freeze(P.clone().add(side), P.clone().sub(side), 'creature');
                EventBus.emit(EV.CREATURE, { id: c.id, species: 'frostmaw', to: 'walled' });
            }
        },
        react: (c, kind, amount) => { if (kind === 'fire' && amount > 0.5) c.thawed = c.sp.thawTime; return amount; },
        weakness: (c, kind) => (c.sp.weak[kind] ?? 1) * (kind === 'impact' && c.thawed > 0 ? c.sp.weak.thawed : 1),
        hold: (c, dt) => { if (c.thawed > 0) c.thawed -= dt; return false; },
        pose: c => { const m = c.model.ownMaterials?.body; if (m && c.thawed > 0 && !c.flash) m.color.setRGB(0.75, 0.85, 0.95); },
    },

    // ---- Glass-wight --------------------------------------------------------------------------------------------
    guard: {
        own: true,
        update: (c, dt, move, speed, dist) => {
            const hero = c.sys.player.position;
            const fromHome = Math.hypot(hero.x - c.home.x, hero.z - c.home.z);
            if (fromHome < c.sp.guardRange || (c.engaged && fromHome < c.sp.guardRange * 1.6)) { c.engaged = true; brawl(c, dt, move, speed, dist); }
            else {
                c.engaged = false;
                const d = toward(c, c.home);
                if (d.length() > 0.8) move(d.normalize(), speed * 0.6); else { c.body.velocity.x *= 0.8; c.body.velocity.z *= 0.8; }
            }
        },
        react: (c, kind, amount, cause) => {
            if (kind === 'fire') {
                // It bounces back.
                const hero = c.sys.player.position;
                if (cause === 'player' && Math.hypot(hero.x - c.pos.x, hero.z - c.pos.z) < 14 && amount > 0.2) {
                    c.sys.vitals.hurt(amount * c.sp.reflects, 'fire');
                    c.flash = 0.15;
                    EventBus.emit(EV.CREATURE, { id: c.id, species: 'glasswight', to: 'reflected' });
                }
                return null;
            }
            if (kind === 'impact') return amount >= c.sp.shatterAt ? amount : null;
            return null;
        },
    },

    // ---- Lantern Sentinel ---------------------------------------------------------------------------------------
    sentinel: {
        own: true,
        init: c => { c.lamps = c.sp.lamps; c.wet = 0; },
        hold: c => c.state === 'off',
        update: (c, dt, move, speed, dist) => {
            const hero = c.sys.player.position;
            const d = toward(c, hero);
            c._face(Math.atan2(d.x, d.z), 3 * dt);
            c.body.velocity.x *= 0.8; c.body.velocity.z *= 0.8;
            c.binding = dist < c.sp.sense && (c.engaged || c.group.item.aggressive || c.group.alarm);
            if (c.binding) {
                // The binding light: it holds you, and wears you down.
                c.sys.player.mired = Math.max(c.sys.player.mired || 0, 0.3);
                c.sys.vitals.hurt(c.sp.attack.damage * c.dmgK * dt, 'light', c.id);
            }
        },
        react: (c, kind, amount, cause) => {
            if (kind === 'water') {
                // A careful stream puts its lamps out, one at a time.
                c.wet += amount;
                if (c.wet >= c.sp.lampWater && c.lamps > 0) {
                    c.wet = 0; c.lamps--;
                    EventBus.emit(EV.CREATURE, { id: c.id, species: 'sentinel', to: 'lamp', left: c.lamps });
                    if (c.lamps === 0) {
                        c._to('off');
                        c.binding = false;
                        EventBus.emit(EV.CREATURE, { id: c.id, species: 'sentinel', to: 'disabled', cause });
                    }
                }
                return null;
            }
            if (kind === 'impact' && amount >= c.sp.alarmAt && !c.group.alarm) {
                // Brute force: it calls for help.
                c.group.alarm = true;
                EventBus.emit(EV.CREATURE, { id: c.id, species: 'sentinel', to: 'alarm', cause });
                EventBus.emit(EV.ALARM, { id: c.id, x: c.pos.x, z: c.pos.z, cause });
            }
            return null;
        },
        pose: (c, dt, T) => {
            const L = c.model.parts.lamps || [];
            L.forEach((m, i) => { m.visible = i < c.lamps; m.scale.setScalar(c.binding ? 1.2 + Math.sin(T * 10) * 0.1 : 1); });
        },
    },

    // ---- Wellspawn ----------------------------------------------------------------------------------------------
    shifter: {
        init: c => { c.form = 'fire'; c.shiftT = c.sp.shiftEvery; c.sys.recolourWell?.(c); },
        update: (c, dt, move, speed, dist) => {
            c.shiftT -= dt;
            if (c.shiftT <= 0) {
                c.shiftT = c.sp.shiftEvery;
                c.form = { fire: 'water', water: 'earth', earth: 'air', air: 'fire' }[c.form];
                EventBus.emit(EV.CREATURE, { id: c.id, species: 'wellspawn', to: 'shift', form: c.form });
            }
            brawl(c, dt, move, speed * (c.form === 'air' ? 1.5 : c.form === 'earth' ? 0.7 : 1), dist, { knock: c.form === 'air' ? 9 : 3 });
            // Fire form scorches what burns around it.
            if (c.form === 'fire' && Math.random() < dt * 0.5) {
                for (const f of c.sys.fire.flammables.values()) if (!f.burning && !f.burned && f.thing.pos().distanceTo(c.pos) < 1.6) { c.sys.fire.ignite(f.thing, 'creature'); break; }
            }
        },
        weakness: (c, kind) => kind === OPPOSITE[c.form] ? 3 : 0,
        pose: (c, dt, T) => {
            const cols = { fire: 0xff6a1a, water: 0x3aa0d8, earth: 0xb0884a, air: 0xd8f5e8 };
            const m = c.model.parts.core?.material;
            if (m && c._shown !== c.form) { c._shown = c.form; m.color?.setHex(cols[c.form]); m.emissive?.setHex(cols[c.form]); }
            if (c.model.parts.core) c.model.parts.core.rotation.y = T * 2;
        },
    },
};
