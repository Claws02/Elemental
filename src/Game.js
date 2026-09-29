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
import { EventBus } from './core/EventBus.js';
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

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {HTMLElement} o.hudEl
 * @param {object} o.data       the scene
 * @param {Function} [o.onLink] catch the end card's buttons (href) instead of following them
 * @param {boolean} [o.persist] save progress to the device (the game: yes; the editor: no)
 */
export function startGame({ canvas, hudEl, data, onLink = null, persist = true }) {
    EventBus.reset();
    const { renderer, scene, camera } = Renderer.init(canvas);
    Physics.init();

    const st = data.settings || {};
    const profile = st.profile === 'story' ? 'story' : 'sandbox';
    const prog = new Progression(profile, { persist: persist && profile === 'story' });
    if (st.resetProgress) prog.reset();
    const world = buildScene(scene, data);
    const player = new PlayerController(scene, world.spawn);
    const cam = new CameraRig(camera);
    cam.solids = world.solids;
    cam.yaw = player.facing + Math.PI;
    cam.focus.set(world.spawn.x, 1.6, world.spawn.z);

    const interactables = new Interactables();
    const channel = new Channel({ camera, hero: player, prog });
    scene.add(channel.tether);
    const earth = new EarthSystem({ hero: player, rocks: world.rocks, channel, prog });
    const fx = new FireFx(scene, Renderer.quality.tier === 'mobile' ? { flames: 320, smoke: 120 } : { flames: 480, smoke: 160 });
    const fire = new FireSystem({ scene, fx, interactables, channel, hero: player, prog });
    const water = new WaterSystem({ scene, camera, interactables, channel, hero: player, fire, fx, solids: world.solids });
    const air = new AirSystem({ scene, camera, interactables, channel, hero: player, fire, solids: world.solids });
    wireScene(world, { interactables, fire, water });
    const intent = new Intent({ camera, hero: player, channel, interactables, fire, earth, water, air, prog });
    const hud = new Hud(hudEl);
    hud.onLink = onLink;
    const story = data.script ? new Story({ world, script: data.script, prog, channel, fire, hud, player, scene }) : null;
    if (story) {
        hud.story();
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

    const input = new Gestures(canvas, {
        press: (x, y) => intent.press(x, y),
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
        Physics.step(dt);
        fire.update(dt);
        water.update(dt);
        air.update(dt);
        frameInfo.held = channel.held?.entry || null;
        world.update(dt, frameInfo);
        story?.update(dt);
        fx.update(dt, renderer.getDrawingBufferSize(_size).y);
        const held = channel.held?.entry.mesh.position || channel.aim?.pos || null;
        cam.update(dt, player.position, held);
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
        input.dispose();
        hud.dispose();
        EventBus.reset();
        Renderer.dispose();
    }
    return { stop, api };
}
