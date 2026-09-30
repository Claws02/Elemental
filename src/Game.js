// ============================================================
// GAME — one scene, played (the bootstrap, as a function)
// ============================================================
//
// Wires the independent systems together and runs the loop. Each system owns
// its own state; this file only decides the ORDER things happen in a frame:
//
//   intent (what the finger means) → channel (forces on what is held)
//     → earth (sensing) → player (velocity) → physics step
//     → fire (contacts recorded in the step, burning, spread) → water (stream, orbs) → air (wind)
//     → the scene (structures, plates, wires, characters) → the story
//     → particles → camera → render
//
// startGame() plays a scene (src/scene/schema.js) and returns { stop }. The
// game page (main.js) calls it once; Elemental-Editor's Play button calls it
// with the scene being edited, and stop() when the player goes back to editing.
// ============================================================

import { THREE } from './engine/lib.js';
import * as Renderer from './engine/Renderer.js';
import * as Physics from './engine/Physics.js';
import { EventBus, EV } from './core/EventBus.js';
import { buildScene, wireScene } from './scene/Loader.js';
import { Interactables } from './world/Interactables.js';
import { PlayerController } from './player/PlayerController.js';
import { CameraRig } from './player/CameraRig.js';
import { Channel } from './elements/Channel.js';
import { EarthSystem } from './elements/EarthSystem.js';
import { FireSystem } from './elements/FireSystem.js';
import { WaterSystem } from './elements/WaterSystem.js';
import { AirSystem } from './elements/AirSystem.js';
import { FireFx } from './art/FireFx.js';
import { Intent } from './input/Intent.js';
import { Gestures } from './input/Gestures.js';
import { Hud } from './ui/Hud.js';
import { Progression } from './core/Progression.js';
import { Story } from './story/Story.js';
import { Session } from './core/SaveGame.js';
import { Ledger } from './core/Ledger.js';
import { Vitals } from './player/Vitals.js';
import { rememberScene } from './scene/Loader.js';
import { Creatures } from './creatures/Creatures.js';
import { Surges } from './elements/Surges.js';
import { Earthworks } from './elements/Earthworks.js';
import { Ice } from './elements/Ice.js';
import { Lava } from './elements/Lava.js';
import { Firestorm } from './elements/Firestorm.js';
import { Mud } from './elements/Mud.js';
import { Glide } from './elements/Glide.js';
import { FlameJet } from './elements/FlameJet.js';

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {HTMLElement} o.hudEl
 * @param {object} o.data       the scene
 * @param {Function} [o.onLink] catch the end card's buttons (href) instead of following them
 * @param {Session} [o.session]  the save session (none: a throwaway one that never writes)
 * @param {boolean} [o.fresh]     entering the scene anew (settings.resetProgress applies); false when coming back from a checkpoint
 * @param {string} [o.at]         arrive at the player start with this name
 * @param {object} [o.spawnAt]    arrive exactly here ({ x, z, facing }): a checkpoint
 * @param {string} [o.step]       resume the story at this step: a checkpoint
 * @param {Function} [o.onDeath]  the hero died: (cause) → the caller goes back to the checkpoint
 * @param {Function} [o.onTravel] an exit or the story leads to another scene: (sceneId, at)
 */
export function startGame({ canvas, hudEl, data, onLink = null, session = null, fresh = true, at = 'start', spawnAt = null, step = null, onDeath = null, onTravel = null }) {
    EventBus.reset();
    const { renderer, scene, camera } = Renderer.init(canvas);
    Physics.init();

    const st = data.settings || {};
    const profile = st.profile === 'story' ? 'story' : 'sandbox';
    session ||= new Session(0, null, { persist: false });
    const prog = new Progression(profile, { session });
    if (st.resetProgress && fresh) prog.reset();
    Renderer.setMood(st.mood || 'day');
    const world = buildScene(scene, data, { flag: n => prog.flags[n], state: id => session.state(id) });
    const arrive = spawnAt || world.spawns[at] || world.spawn;
    const player = new PlayerController(scene, arrive, session.work.custom?.look || null);
    const cam = new CameraRig(camera);
    cam.solids = world.solids;
    cam.yaw = player.facing + Math.PI;
    cam.focus.set(arrive.x, 1.6, arrive.z);

    const interactables = new Interactables();
    const channel = new Channel({ camera, hero: player, prog });
    scene.add(channel.tether);
    const earth = new EarthSystem({ hero: player, rocks: world.rocks, channel, prog });
    const fx = new FireFx(scene, Renderer.quality.tier === 'mobile' ? { flames: 320, smoke: 120 } : { flames: 480, smoke: 160 });
    const fire = new FireSystem({ scene, fx, interactables, channel, hero: player, prog });
    const water = new WaterSystem({ scene, camera, interactables, channel, hero: player, fire, fx, solids: world.solids });
    const air = new AirSystem({ scene, camera, interactables, channel, hero: player, fire, solids: world.solids });
    const works = new Earthworks({ scene, hero: player, camera });
    wireScene(world, { interactables, fire, water });
    const forget = rememberScene(world, session);
    // Whose is it: a piece of a building answers for the building (Veyra_House_02_W1_P03 → Veyra_House_02).
    const ownerOf = id => {
        for (let s = String(id); s; s = s.includes('_') ? s.slice(0, s.lastIndexOf('_')) : '') {
            const o = world.objects.get(s);
            if (o) return o.item.owner || 'none';
        }
        return 'none';
    };
    const ledger = new Ledger(session, st.region || 'verdant', ownerOf);
    const vitals = new Vitals({ player, fire });
    const creatures = new Creatures({ scene, world, player, vitals, fire, channel });
    const ice = new Ice({ scene, fire, fx, creatures });
    const storm = new Firestorm({ fire, fx, creatures });
    const mud = new Mud({ scene, fire, creatures, player });
    const glide = new Glide({ player, prog, fire });
    const jet = new FlameJet({ scene, player, fire, fx, prog, creatures, interactables });
    const lava = new Lava({ scene, fire, fx, water, creatures, vitals, player });
    const surges = new Surges({ prog, player, fire, fx, water, world, creatures, vitals });
    let leaving = false;
    // A checkpoint: here, now, this step. Dying comes back to it; the save slot gets it.
    const checkpoint = () => {
        const p = player.body.position;
        const where = { scene: data.id, spawn: { x: +p.x.toFixed(2), z: +p.z.toFixed(2), facing: +player.facing.toFixed(3) }, step: story?.step || null };
        session.work.meta.scene = data.id;
        session.checkpoint(where);
        EventBus.emit(EV.CHECKPOINT, where);
        return where;
    };
    const travel = (to, where = 'start') => {
        if (leaving) return;
        leaving = true;
        session.work.checkpoint = { scene: to, at: where, spawn: null, step: null };
        session.work.meta.scene = to;
        session.checkpoint();
        onTravel?.(to, where);
    };
    world.onExit = (to, where) => travel(to, where);
    vitals.onDeath = cause => { if (!leaving) { leaving = true; hud.died?.(cause); setTimeout(() => onDeath?.(cause), 1600); } };
    const intent = new Intent({ camera, hero: player, channel, interactables, fire, earth, water, air, prog, works, ice, storm, mud, jet, creatures });
    const hud = new Hud(hudEl);
    hud.onLink = onLink;
    const story = data.script ? new Story({ world, script: data.script, prog, channel, fire, hud, player, scene, startStep: step, hooks: { checkpoint: () => checkpoint(), travel, ledger, session, mood: (n, secs) => Renderer.setMood(n, secs), douseAll: v => fire.douseAll(v?.by || 'environment'), surge: (el, o) => surges.surge(el, o),
        protect: v => { vitals.floor = v; }, flameSpill: v => { jet.spill = { target: v.target, radius: v.radius ?? 8, after: v.after || 0, cause: v.cause || 'awakening' }; } } }) : null;
    if (story) hud.story();
    // Cael's charm: refused, it stays in your pocket, and you can put it on any time. Once on, it stays on.
    const wearCharm = () => {
        if (story?.choosing || prog.flags.charm !== 'refused') return;
        hud.choices(['Put the charm on. It stays on.', 'Not now'], i => {
            hud.choices(null);
            if (i !== 0) return;
            prog.flags.charm = 'worn';
            prog._save();
            EventBus.emit(EV.CHARM, { worn: true });
            hud.log('The charm is on. What is wild in you goes still.');
            checkpoint();
        });
    };
    let charmShown;
    if (story && !spawnAt) {
        // The story opens looking at what the script names (Lesson I: Cael).
        const f = data.script.face && world.objects.get(data.script.face);
        if (f) {
            const c = f.item, p = player.body.position;   // the mesh has not synced yet
            player.facing = Math.atan2(c.x - p.x, c.z - p.z);
            player.rig.root.rotation.y = player.facing;
            cam.yaw = player.facing + Math.PI;
            cam.pitch = 0.22;
            cam.dist = 5.5;
            cam.focus.set(p.x, 1.6, p.z);
        }
    }

    // Arriving is a checkpoint: dying before the next one comes back here.
    if (!spawnAt) checkpoint();

    const input = new Gestures(canvas, {
        press: (x, y) => intent.press(x, y),
        second: (x, y) => intent.second(x, y),
        claims: (x, y) => prog.has('air') && air.onHero(x, y),
        drag: (x, y, t) => intent.drag(x, y, t),
        release: r => intent.release(r),
        orbit: (dx, dy) => cam.orbit(dx, dy),
        zoom: f => cam.zoom(f),
        stick: s => hud.stick(s),
    });

    const _size = new THREE.Vector2();
    const frameInfo = { held: null, hero: player.position };
    let last = performance.now(), raf = 0, running = true;
    function frame(now) {
        if (!running) return;
        // Capped at 0.1 s: Physics sub-steps cover that without slow motion, and
        // a longer hitch is treated as a pause rather than a teleport. Never
        // negative: the first rAF timestamp can predate `last`.
        const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
        last = now;
        EventBus.tick(dt);

        intent.update(dt);
        channel.update(dt);
        earth.update(dt);
        player.rig.setElement(intent.element);
        player.update(dt, input.moveVector(), cam.moveYaw, channel.pose());
        glide.update(dt);
        Physics.step(dt);
        glide.after();
        works.update(dt);
        ice.update(dt);
        lava.update(dt);
        mud.update(dt);
        fire.update(dt);
        water.update(dt);
        air.update(dt);
        frameInfo.held = channel.held?.entry || null;
        creatures.update(dt);
        jet.update(dt);
        world.update(dt, frameInfo);
        vitals.update(dt);
        surges.update(dt);
        if (charmShown !== prog.flags.charm) { charmShown = prog.flags.charm; hud.charm?.(charmShown === 'refused' ? wearCharm : null); }
        hud.vitals?.(vitals.danger);
        hud.health?.(vitals.health / 100);
        story?.update(dt);
        fx.update(dt, renderer.getDrawingBufferSize(_size).y);
        const held = channel.held?.entry.mesh.position || channel.aim?.pos || null;
        cam.update(dt, player.position, held);
        Renderer.updateMood(dt);
        Renderer.followSun(player.position);
        Renderer.render();

        hud.setElement(intent.element);
        hud.ring(intent.ring());
        const ri = Renderer.info();
        hud.update(dt, { calls: ri.calls, tris: ri.triangles, physics: Physics.stats(), barricade: world.barricade?.summary() || null, fire: fire.stats(), fx: fx.stats() });
        raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // QA handle: the tests drive the game through this, never through private state.
    const api = {
        ready: true,
        THREE, Physics, EventBus, world, room: world, player, channel, earth, fire, water, air, fx, intent, interactables, cam, input, prog, story, hud, data,
        session, ledger, vitals, creatures, surges, works, ice, lava, storm, mud, glide, jet, wearCharm, checkpoint, travel,
        renderInfo: () => ({ ...Renderer.info() }),
        throwRockAt(i, target, speed = 30) {
            const e = world.rocks[i];
            const dir = new THREE.Vector3(target.x, target.y, target.z).sub(e.mesh.position).normalize();
            channel.throwEntry(e, dir, speed);
        },
    };

    function stop() {
        running = false;
        cancelAnimationFrame(raf);
        story?.dispose();
        ledger.dispose();
        creatures.dispose();
        works.dispose();
        ice.dispose();
        lava.dispose();
        mud.dispose();
        vitals.dispose();
        forget();
        input.dispose();
        hud.dispose();
        EventBus.reset();
        Renderer.dispose();
    }
    return { stop, api };
}
