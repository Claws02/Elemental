// ============================================================
// CREATURES — wildlife that the elements act on (data/creatures.js)
// ============================================================
//
// Combat here is the world, not a health bar: a creature is a physics body the
// elements already push (Water's stream, Air's wind), that thrown rocks and
// debris hit, that fire burns, and that has a small, readable mind:
//
//   charge   (Bristleback) walks up, winds up where you can see it, then
//            charges in a straight line. Into you: it hurts. Into a wall or a
//            boulder: it stuns itself, and is open.
//   pack     (Thornhound) circles at a distance and darts in to bite. Fears
//            fire: a flame near it and it breaks off; the last of a pack runs.
//   flyer    (Emberwing) cruises overhead and dives to drop a burning ember on
//            what's below (roofs, hay, you). Wet, it falls; a gust tumbles it.
//
// Every creature can FLEE (hurt enough, frightened, alone). A creature driven
// off is SPARED; one killed is KILLED; both go in the ledger with who did it.
//
// Scene objects of type `creature` are groups (a species, a count, a spread).
// A hidden group arrives when revealed (the flock at dusk). Group signals:
// `gone` (every member dead or fled), `engaged` (they have seen you).
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { seeded } from '../engine/Kit.js';
import { EventBus, EV } from '../core/EventBus.js';
import { SPECIES, ELITE, YOUNG, tierFor } from '../data/creatures.js';
import { ICE, MUD, EARTH } from '../data/elements.js';
import { CREATURE_MODELS } from '../art/CreatureModels.js';
import { BEHAVIOURS } from './Behaviours.js';
import { Ground } from '../world/Ground.js';
import { npcModel } from '../story/Npc.js';
import { HeroAnimator } from '../art/HeroModel.js';

// A Wielder is a person (the hero's rig in their order's colours), animated as one.
function personModel(look) {
    const rig = npcModel(look);
    rig.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { root: rig.root, parts: {}, rig, anim: new HeroAnimator(rig) };
}

const G = 22;                 // the world's gravity (Physics.init)
const FLEE_GONE = 32;         // metres from the hero at which a fleeing creature is gone
const TRUCE = { room: 12 };       // during a story task: how far wild creatures keep from the hero
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class Creatures {
    constructor({ scene, world, player, vitals, fire, channel, prog = null }) {
        Object.assign(this, { scene, world, player, vitals, fire, channel, prog });
        this.tier = prog ? tierFor(prog.might()) : 4;          // what the hero is ready for, as the scene loads
        this.all = [];
        this.time = 0;
        this.off = [
            // Stone raised under a creature: some kinds care (a shellback flips).
            EventBus.on(EV.EARTH_RAISED, e => { for (const c of this.all) c.B?.onRaised?.(c, e.x, e.z); }),
            EventBus.on(EV.EXPLOSION, e => {
                if (!e.pos) return;
                for (const c of this.all) {
                    const d = c.body.position.distanceTo(e.pos);
                    if (d < 4.5) c.react('fire', 45 * (1 - d / 4.5), e.cause || 'environment');
                }
            }),
        ];
        world.creatures = this;
    }

    dispose() { this.off.forEach(f => f()); }

    /** A group's members, spawned now (on load, or when a hidden group is revealed). */
    _spawnGroup(g) {
        g.spawned = true;
        const it = g.item, sp = SPECIES[it.species];
        if (!sp) return;
        // Tiers: a group the hero isn't ready for comes as its young (one tier short), or not yet at all.
        const need = it.tier === 'always' ? 0 : Number(it.tier) || sp.tier || 1;
        const young = need > this.tier;
        g.young = young;
        if (young && (need > this.tier + 1 || !sp.young)) { g.waiting = true; return; }
        const n = young ? Math.max(1, Math.ceil((it.count || 1) * YOUNG.count)) : (it.count || 1);
        const eliteOk = !young && (need + 1 <= this.tier || it.tier === 'always');
        for (let i = 0; i < n; i++) {
            const a = seeded(i * 7.1 + it.x) * Math.PI * 2, r = (it.spread || 2) * Math.sqrt(seeded(i * 3.3 + it.z));
            const pos = new THREE.Vector3(it.x + Math.cos(a) * r, (it.y || 0) + sp.radius + (sp.behaviour === 'flyer' ? sp.cruise[0] : 0), it.z + Math.sin(a) * r);
            const c = new Creature(this, sp, g, `${it.id}_${i + 1}`, pos, young ? 'young' : !!it.elite && eliteOk && i === 0);
            g.members.push(c);
            this.all.push(c);
        }
    }

    /** Stones thrown at the hero, still in the air: [{ s, c }] (a Stonebound's, Behaviours.js). */
    _flying() {
        const out = [];
        for (const c of this.all) for (const s of c.stones || []) if (!s.hit && !s.caught && s.t < 3 && s.entry.body.world && s.entry.body.velocity.length() > 2) out.push({ s, c });
        return out;
    }

    /** One in the air under the finger at (x, y), within `range` of the hero: detached from its thrower, or null. */
    catchable(x, y, camera, range) {
        const hero = this.player.position;
        let best = null, bd = EARTH.catch.pickPx;
        for (const f of this._flying()) {
            const p = f.s.entry.body.position;
            if (Math.hypot(p.x - hero.x, p.y - hero.y, p.z - hero.z) > range) continue;
            const q = new THREE.Vector3(p.x, p.y, p.z).project(camera);
            if (q.z > 1) continue;
            const d = Math.hypot((q.x + 1) / 2 * innerWidth - x, (1 - q.y) / 2 * innerHeight - y);
            if (d < bd) { bd = d; best = f; }
        }
        if (!best) return null;
        best.s.caught = best.s.hit = true;          // no harm now
        best.c.stones.splice(best.c.stones.indexOf(best.s), 1);
        return best.s;
    }

    /** Is a stone flying at the hero, close? (Time slows for it: Game.) */
    incoming() {
        const h = this.player.position;
        for (const { s } of this._flying()) {
            const p = s.entry.body.position, v = s.entry.body.velocity;
            const dx = h.x - p.x, dy = h.y + 0.9 - p.y, dz = h.z - p.z, d = Math.hypot(dx, dy, dz);
            if (d < EARTH.catch.slowRange && (dx * v.x + dy * v.y + dz * v.z) > 0) return true;
        }
        return false;
    }

    update(dt) {
        this.time += dt;
        for (const g of this.world.creatureGroups) if (!g.spawned && !g.inst.hidden) this._spawnGroup(g);
        for (const g of this.world.creatureGroups) if (g.spawned && g.item.vent) this._vent(g, dt);
        for (const c of this.all) c.update(dt);
        for (const c of this.all.filter(c => c.gone)) this._remove(c);
    }

    /** A struck mudling splits: two halves where it stood, at half its strength (they don't split again). */
    splitMudling(c) {
        const g = c.group;
        (g.splitGen ||= new Map());
        for (const s of [-1, 1]) {
            const id = `${c.id}_${s > 0 ? 'b' : 'a'}`;
            g.splitGen.set(id, 1);
            const pos = new THREE.Vector3(c.pos.x + s * 0.7, c.pos.y + 0.3, c.pos.z);
            const m = new Creature(this, c.sp, g, id, pos, false);
            m.maxHp = m.hp = c.hp / 2;
            m.engaged = true;
            m.model.root.scale.setScalar(0.72);
            g.members.push(m);
            this.all.push(m);
        }
        c.gone = true;
        EventBus.emit(EV.CREATURE, { id: c.id, species: c.group.item.species, to: 'split' });
    }

    // A vent keeps pouring out more (up to the group's count alive) until something blocks its mouth.
    _vent(g, dt) {
        const it = g.item;
        const blocked = [...Physics.all()].some(e => {
            if (e.data?.creature || e.data?.ground || e.tier === TIER.PLAYER) return false;
            const p = e.body.position;
            return Math.hypot(p.x - it.x, p.z - it.z) < 1.3 && p.y < Ground.height(it.x, it.z) + 3 && (e.body.mass > 3 || e.data?.column);
        });
        if (blocked && !g.buried) { g.buried = true; EventBus.emit(EV.CREATURE, { id: it.id, species: it.species, to: 'buried' }); }
        if (g.buried) return;
        g.ventT = (g.ventT ?? 2) - dt;
        if (g.ventT > 0 || this.alive(g).length >= (it.count || 1)) return;
        g.ventT = 2.5;
        const sp = SPECIES[it.species];
        const c = new Creature(this, sp, g, `${it.id}_v${++g.ventN || (g.ventN = 1)}`, new THREE.Vector3(it.x, (it.y || 0) + sp.radius + 0.2, it.z), false);
        g.members.push(c);
        this.all.push(c);
    }

    _remove(c) {
        Physics.remove(c.entry);
        c.model.root.parent?.remove(c.model.root);
        this.all.splice(this.all.indexOf(c), 1);
    }

    /** The members still standing and not running, in group `g`. */
    alive(g) { return g.members.filter(c => !c.gone && c.state !== 'dead' && c.state !== 'flee' && c.state !== 'off'); }
}

class Creature {
    constructor(sys, sp, group, id, pos, elite) {
        Object.assign(this, { sys, sp, group, id, elite });
        const k = elite === 'young' ? YOUNG : elite ? ELITE : { hp: 1, damage: 1, scale: 1, speed: 1 };
        this.young = elite === 'young';
        this.elite = elite === true;
        this.maxHp = this.hp = sp.hp * k.hp;
        this.dmgK = k.damage * (group.item.damage ?? 1);
        this.speedK = k.speed;
        this.state = 'idle';
        this.t = 0;                 // seconds in this state
        this.engaged = !!group.item.aggressive;
        this.hitBy = null;          // who last hurt it: the ledger's "cause"
        this.scared = 0;
        this.soaked = 0;
        this.tumble = 0;
        this.frozen = 0;            // seconds left locked in ice (Water + Air)
        this.mired = 0;             // in mud (Earth + Water): Mud sets it each frame it wades
        this.home = pos.clone();
        this.facing = seeded(pos.x * 3.1) * Math.PI * 2;
        this.orbitDir = seeded(pos.z) > 0.5 ? 1 : -1;
        this.nextAttack = 1 + seeded(pos.x + pos.z) * 2;
        this.gone = false;
        this.impacts = [];

        this.model = sp.person ? personModel(sp.person) : CREATURE_MODELS[group.item.species](sp.look);
        this.model.root.scale.setScalar(k.scale * (sp.person ? this.model.root.scale.x : 1));
        this.model.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
        sys.scene.add(this.model.root);

        const r = sp.radius * k.scale;
        // The hero's material: no friction, so it walks by its own steering, not by rolling.
        const body = new CANNON.Body({ mass: sp.mass * k.scale, fixedRotation: true, linearDamping: sp.behaviour === 'flyer' ? 0.4 : 0.1, material: Physics.material('player') });
        body.addShape(new CANNON.Sphere(r));
        body.position.set(pos.x, pos.y, pos.z);
        body.allowSleep = false;
        this.body = body;
        this.entry = Physics.add({ body, tier: TIER.INTERACTIVE, id, data: { creature: this, radius: r } });
        this.entry.spawn = null;
        body.addEventListener('collide', e => this._onCollide(e));
        // The rest of the bestiary (creatures/Behaviours.js): its own mind, its own answer to the elements.
        this.B = BEHAVIOURS[sp.behaviour] || null;
        this.B?.init?.(this);
    }

    get pos() { return this.body.position; }

    // Runs inside the physics step: only record it.
    _onCollide(e) {
        const other = e.body.userData;
        if (!other || other.tier === TIER.PLAYER || other.data?.creature) return;      // bumping each other or the hero isn't a hit
        const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
        const thrown = other.data?.thrownBy && performance.now() - (other.data.thrownAt || 0) < 6000;
        // A hit is something moving INTO it (a thrown rock, falling debris), not it running into a stone at rest.
        const v = e.body.velocity, moving = Math.hypot(v.x, v.y, v.z);
        this.impacts.push({ speed: Math.min(speed, moving), mass: e.body.mass, static: e.body.type === CANNON.Body.STATIC, bump: speed, cause: thrown ? other.data.thrownBy : 'environment' });
    }

    /** An element acts on it. `amount` is in damage before its weaknesses. */
    react(kind, amount, cause = 'environment') {
        if (this.state === 'dead' || this.gone) return;
        if (this.B?.react) { amount = this.B.react(this, kind, amount, cause); if (amount === null) return; }
        if (this.sp.fears.includes(kind) && amount > 0.02) this.scared = Math.max(this.scared, 3);
        if (kind === 'water' && this.sp.soakedFalls && amount > 0.01) this.soaked = 3;
        if (kind === 'wind' && this.sp.behaviour === 'flyer' && amount > 0.5) this.tumble = 1;
        const w = (this.B?.weakness ? this.B.weakness(this, kind) : (this.sp.weak[kind] ?? 1)) * (this.state === 'stunned' ? this.sp.weak.stunned || 1 : 1) * (this.frozen > 0 && kind === 'impact' ? ICE.shatter : 1);
        // A fragile flock (a first fight): any real hit, of any kind, kills.
        const dmg = this.group.item.fragile && amount > 0.02 ? this.hp + 1 : amount * w;
        if (cause === 'player') { this.engaged = true; this.hitBy = 'player'; }
        if (dmg <= 0.01) return;
        this.hp -= dmg;
        this.flash = 0.15;
        if (this.hp <= 0) this._die();
    }

    /** Locked in ice for `secs`: no moving, no attacking; a flyer drops; a hard hit does more (ICE.shatter). */
    freeze(secs, cause = 'environment') {
        if (this.state === 'dead' || this.gone || this.sp.behaviour === 'freezer') return;     // a frostmaw is made of it
        secs = this.sp.frozenFor || secs;
        this.frozen = Math.max(this.frozen, secs);
        if (cause === 'player') { this.engaged = true; this.hitBy = 'player'; }
        if (!this.ice) {
            this.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(this.entry.data.radius * 1.35 / this.model.root.scale.x, 0),
                new THREE.MeshPhongMaterial({ color: 0xcfefff, transparent: true, opacity: 0.55, emissive: 0x2a6a8a, emissiveIntensity: 0.4, flatShading: true, shininess: 90 }));
            this.model.root.add(this.ice);
        }
        this.ice.visible = true;
        EventBus.emit(EV.FROZEN, { id: this.id, secs, cause });
    }

    _die() {
        this._to('dead');
        this.body.fixedRotation = false;
        this.body.updateMassProperties();
        this.body.angularVelocity.set(2, 0, 1);
        EventBus.emit(EV.CREATURE, { id: this.id, species: this.group.item.species, to: 'dead', cause: this.hitBy || 'environment' });
    }

    _flee(why) {
        if (this.state === 'flee' || this.state === 'dead') return;
        this._to('flee');
        this.fleeWhy = why;
    }

    _to(s) { this.state = s; this.t = 0; }

    update(dt) {
        const sp = this.sp, b = this.body, hero = this.sys.player.position;
        this.t += dt;
        this.scared = Math.max(0, this.scared - dt);
        this.soaked = Math.max(0, this.soaked - dt);
        this.tumble = Math.max(0, this.tumble - dt);

        // What the physics step recorded.
        for (const i of this.impacts.splice(0)) {
            if (!i.static && i.speed > 4) this.react('impact', i.speed * Math.min(i.mass, 30) * 0.35, i.cause);
            if (this.state === 'charging' && i.bump > 4 && (i.static || i.mass > 20)) { this._to('stunned'); b.velocity.set(0, 0, 0); }   // a wall or a boulder stops a charge
        }
        if (this.state === 'dead') {
            if (this.t > 2.5) this.gone = true;
            this._pose(dt);
            return;
        }

        const flyer = sp.behaviour === 'flyer' || !!sp.flies;
        if (this.frozen > 0) {
            this.frozen -= dt;
            b.velocity.x = 0; b.velocity.z = 0;           // gravity still has it: a frozen bird falls
            if (this.frozen <= 0 && this.ice) this.ice.visible = false;
            this._pose(dt);
            return;
        }
        // Flyers hold themselves up, unless wet or tumbling.
        if (flyer && !this.soaked && !this.tumble && !this.grounded) b.velocity.y += G * dt;
        // A state its own kind holds it in (a shellback on its back, a sentinel gone dark).
        if (this.B?.hold?.(this, dt)) { this._pose(dt); return; }

        // Standing in fire.
        if (this.sys.fire.burningNear(b.position, 1.1)) this.react('fire', 14 * dt, 'environment');

        _d.set(hero.x - b.position.x, 0, hero.z - b.position.z);
        const dist = _d.length();
        // A truce while the player is at a story task (Story.truce): the creatures it isn't
        // about back off and go home; they take it up again once the task is done.
        const truce = this.sys.truce, calm = !!truce && !truce.has(this.group.item.id) && this.state !== 'flee';
        if (calm) { this.engaged = false; this.group.engaged = false; this.state = 'idle'; }
        else if (dist < sp.sense && (this.engaged || this.group.item.aggressive)) this.group.engaged = true;
        if (this.group.engaged) this.engaged = true;

        // Leaving: hurt enough, frightened, alone, or a wet bird on the ground.
        if (this.state !== 'flee') {
            if (this.hp < this.maxHp * sp.fleeAt) this._flee('hurt');
            else if (this.scared > 2.5 && sp.behaviour !== 'pack') this._flee('afraid');
            else if (sp.fleeAlone && this.engaged && this.sys.alive(this.group).length === 1 && this.group.members.length > 1) this._flee('alone');
            else if (flyer && this.soaked > 0 && Ground.above(b.position) < sp.radius + 0.3) this._flee('soaked');
        }

        const speed = sp.speed * this.speedK;
        const mud = this.mired > 0 && !(flyer && Ground.above(b.position) > 1.4) ? MUD.slow : 1;
        this.mired = Math.max(0, this.mired - dt);
        const move = (dir, v, turn = 6) => {       // steer the body along the ground at speed v
            v *= mud;
            const k = Math.min(1, 8 * dt);
            b.velocity.x += (dir.x * v - b.velocity.x) * k;
            b.velocity.z += (dir.z * v - b.velocity.z) * k;
            this._face(Math.atan2(dir.x, dir.z), turn * dt);
        };

        switch (this.state) {
        case 'flee': {
            _v.set(b.position.x - hero.x, 0, b.position.z - hero.z).normalize();
            if (!flyer || this.soaked) move(_v, speed * 1.2);
            else { move(_v, speed * 1.2); b.velocity.y += (8 - Ground.above(b.position)) * dt; }
            if (dist > FLEE_GONE || this.t > 12) {
                this.gone = true;
                EventBus.emit(EV.CREATURE, { id: this.id, species: this.group.item.species, to: 'fled', cause: this.hitBy || (this.engaged ? 'player' : 'environment'), why: this.fleeWhy });
            }
            break;
        }
        default:
            if (calm) this._keepOff(dt, move, speed, dist);
            else if (this.B?.own) this.B.update(this, dt, move, speed, dist);
            else if (!this.engaged) this._wander(dt, move, speed);
            else if (this.B) this.B.update(this, dt, move, speed, dist);
            else if (sp.behaviour === 'charge') this._charge(dt, move, speed, dist);
            else if (sp.behaviour === 'pack') this._pack(dt, move, speed, dist);
            else if (flyer) this._fly(dt, move, speed, dist);
        }
        if (Ground.above(b.position) < -20) this.gone = true;
        this._pose(dt);
    }

    /** The truce: give the hero room (TRUCE.room), then drift home. */
    _keepOff(dt, move, speed, dist) {
        if (dist < TRUCE.room) {
            _v.set(this.pos.x - this.sys.player.position.x, 0, this.pos.z - this.sys.player.position.z).normalize();
            move(_v, speed * 0.6, 3);
            if (this.sp.behaviour === 'flyer' || this.sp.flies) this.body.velocity.y += (Math.max(this.home.y, this.pos.y) + 2 - this.pos.y) * dt;
        } else this._wander(dt, move, speed);
    }

    _wander(dt, move, speed) {
        const home = this.home;
        const a = this.sys.time * 0.3 + seeded(home.x) * 6;
        _v.set(home.x + Math.cos(a) * 2 - this.pos.x, 0, home.z + Math.sin(a) * 2 - this.pos.z);
        if (_v.length() > 0.3) move(_v.normalize(), speed * 0.3, 2);
        if (this.sp.behaviour === 'flyer') this.body.velocity.y += (home.y - this.pos.y) * 2 * dt - this.body.velocity.y * 1.5 * dt;
    }

    // ---- charge: wind up, then commit to a straight line --------------------------------
    _charge(dt, move, speed, dist) {
        const sp = this.sp, c = sp.charge, b = this.body, hero = this.sys.player.position;
        const toHero = _d.clone().normalize();
        if (this.state === 'idle' || this.state === 'approach') {
            this.state = 'approach';
            if (dist > 9) move(toHero, speed);
            else { this._to('windup'); b.velocity.set(0, b.velocity.y, 0); }
        } else if (this.state === 'windup') {
            this._face(Math.atan2(toHero.x, toHero.z), 5 * dt);
            b.velocity.x *= 0.8; b.velocity.z *= 0.8;
            if (this.t > c.windup) { this.chargeDir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); this._to('charging'); }
        } else if (this.state === 'charging') {
            move(this.chargeDir, c.speed * this.speedK, 0.5);
            if (this._reach() && !this.hitThisCharge) {
                this.hitThisCharge = true;
                this._hitHero(sp.attack.damage, this.chargeDir, sp.attack.knock);
            }
            if (this.t > c.time) { this.hitThisCharge = false; this._to('recover'); }
        } else if (this.state === 'stunned') {
            b.velocity.x *= 0.9; b.velocity.z *= 0.9;
            if (this.t > c.stun) this._to('recover');
        } else if (this.state === 'recover') {
            b.velocity.x *= 0.85; b.velocity.z *= 0.85;
            if (this.t > 1.2) this._to('approach');
        }
    }

    // ---- pack: circle, dart in, break off from fire ----------------------------------------
    _pack(dt, move, speed, dist) {
        const sp = this.sp, b = this.body, hero = this.sys.player.position;
        const fireNear = this.sys.fire.burningNear(b.position, 3.5) || (this.sys.channel.held?.element === 'fire' && dist < 5);
        if (fireNear) this.react('fire', 0.05, 'environment');       // afraid, not hurt
        const toHero = _d.clone().normalize();
        if (this.state === 'lunge') {
            move(this.lungeDir, sp.attack.lunge * this.speedK, 1);
            if (this._reach() && !this.bit) { this.bit = true; this._hitHero(sp.attack.damage, this.lungeDir, 3); }
            if (this.t > 0.45) { this._to('circle'); this.nextAttack = sp.attack.every * (0.7 + seeded(this.sys.time) * 0.6); }
            return;
        }
        if (this.scared > 0) {                                           // back off from the flame
            _v.copy(toHero).multiplyScalar(-1);
            move(_v, speed * 0.9);
            return;
        }
        this.state = 'circle';
        // Hold a ring around the hero, walking round it.
        const ring = sp.circle;
        const tangent = new THREE.Vector3(-toHero.z, 0, toHero.x).multiplyScalar(this.orbitDir);
        const radial = toHero.clone().multiplyScalar((dist - ring) * 0.6);
        _v.copy(tangent).add(radial);
        if (_v.lengthSq() > 0.01) move(_v.normalize(), speed * 0.6);
        this._face(Math.atan2(toHero.x, toHero.z), 6 * dt);
        this.nextAttack -= dt;
        if (this.nextAttack <= 0 && dist < ring + 2) { this.lungeDir = toHero.clone(); this.bit = false; this._to('lunge'); }
    }

    // ---- flyer: cruise, dive on a target, drop an ember, climb --------------------------------
    _fly(dt, move, speed, dist) {
        const sp = this.sp, b = this.body;
        if (this.soaked || this.tumble) return;               // falling or tumbling: no control
        const cruise = sp.cruise[0] + (sp.cruise[1] - sp.cruise[0]) * seeded(this.home.x);
        if (!this.target || this.targetDone) this._pickTarget();
        const tp = this.target ? this.target.pos() : this.sys.player.position;
        _v.set(tp.x - b.position.x, 0, tp.z - b.position.z);
        const flat = _v.length();
        if (this.state === 'dive') {
            _v.set(tp.x - b.position.x, tp.y + 0.6 - b.position.y, tp.z - b.position.z);
            const d = _v.length();
            _v.normalize().multiplyScalar(speed * 1.4);
            b.velocity.x += (_v.x - b.velocity.x) * Math.min(1, 6 * dt);
            b.velocity.y += (_v.y - b.velocity.y) * Math.min(1, 6 * dt);
            b.velocity.z += (_v.z - b.velocity.z) * Math.min(1, 6 * dt);
            this._face(Math.atan2(_v.x, _v.z), 8 * dt);
            if (d < sp.reach) {
                if (this.target) this.sys.fire.ignite(this.target, 'creature');
                else this._hitHero(sp.attack.damage, _v.clone().normalize(), 2);
                this.targetDone = true;
                this._to('climb');
            } else if (this.t > 3) this._to('climb');
            return;
        }
        // Cruise: circle the target at height, then dive.
        const tangent = new THREE.Vector3(-_v.z, 0, _v.x).normalize().multiplyScalar(this.orbitDir);
        const toward = _v.normalize().multiplyScalar(flat > 6 ? 1 : 0);
        move(tangent.add(toward).normalize(), speed * 0.8, 4);
        b.velocity.y += (cruise - Ground.above(b.position)) * 2.5 * dt - b.velocity.y * 1.5 * dt;
        this.nextAttack -= dt;
        if (this.nextAttack <= 0 && flat < 9) { this.nextAttack = sp.attack.every * (0.7 + seeded(this.sys.time + this.home.z) * 0.6); this._to('dive'); }
        else if (this.state !== 'climb' || this.t > 1.5) this.state = 'cruise';
    }

    // The nearest thing below that will burn and isn't burning yet; else the hero.
    _pickTarget() {
        this.targetDone = false;
        this.target = null;
        if (this.group.item.embers === false || !this.sp.attack.ember) return;     // a flock that only goes for you
        const p = this.pos;
        let best = null, bd = 22;
        for (const f of this.sys.fire.flammables.values()) {
            if (f.burning || f.burned || f.wet > 0) continue;
            const q = f.thing.pos(), d = Math.hypot(q.x - p.x, q.z - p.z);
            if (d < bd) { bd = d; best = f.thing; }
        }
        this.target = this.sp.attack.ember ? best : null;
    }

    _reach() {
        const hero = this.sys.player.position, p = this.pos;
        return Math.hypot(hero.x - p.x, hero.z - p.z) < this.sp.reach * (this.elite ? ELITE.scale : 1) + 0.4 && Math.abs(hero.y + 0.9 - p.y) < 1.6;
    }

    _hitHero(dmg, dir, knock) {
        if (this.sys.truce && !this.sys.truce.has(this.group.item.id)) return;      // a blow already falling when the truce began
        this.sys.vitals.hurt(dmg * this.dmgK, this.sp.name, this.id);
        const b = this.sys.player.body;
        b.velocity.x += dir.x * knock; b.velocity.z += dir.z * knock; b.velocity.y += knock * 0.3;
    }

    _face(want, k) {
        let d = want - this.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, k);
    }

    // Place the model on the body, and move its joints.
    _pose(dt) {
        const r = this.model.root, b = this.body, p = this.model.parts;
        const flyer = this.sp.behaviour === 'flyer';
        r.position.set(b.position.x, b.position.y - (flyer ? 0 : this.body.shapes[0].radius), b.position.z);
        if (this.state === 'dead') { r.quaternion.copy(b.quaternion); r.rotation.y += this.facing; r.scale.multiplyScalar(this.t > 1.8 ? 0.94 : 1); return; }
        r.rotation.set(0, this.facing, 0);
        const v = Math.hypot(b.velocity.x, b.velocity.z), T = this.sys.time;
        if (p.legs) p.legs.forEach((l, i) => { l.rotation.x = Math.sin(T * (4 + v * 1.6) + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI : 0)) * Math.min(0.7, v * 0.12); });
        if (p.wings) {
            const beat = this.soaked ? 0.1 : this.state === 'dive' ? 0.3 : 1;
            p.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(T * 14 * beat + i) * 0.7 * beat; });
            if (this.state === 'dive') r.rotation.x = 0.5;
        }
        // A person: walking, and whatever their behaviour has them doing with their hands.
        if (this.model.anim) this.model.anim.update(dt, { speed: v, channel: this.B?.channel?.(this) || null });
        this.B?.pose?.(this, dt, T);
        if (this.state === 'windup') r.rotation.x = -0.12 + Math.sin(T * 30) * 0.03;      // pawing the ground: a readable tell
        if (this.state === 'stunned') r.rotation.z = Math.sin(T * 6) * 0.15;
        const m = this.model.ownMaterials?.body;
        if (m) {
            this.flash = Math.max(0, (this.flash || 0) - dt);
            m.emissive.setRGB(this.flash > 0 ? 1 : 0, this.flash > 0 ? 0.4 : 0, 0);
            m.emissiveIntensity = this.flash > 0 ? 0.8 : 0;
            if (this.soaked) m.color.setScalar(0.6); else m.color.setScalar(1);
        }
    }
}
