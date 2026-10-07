// ============================================================
// Builds scenes/verdant.json: the Verdant Reach (world bible).
// Farmland, a river, old forest; Thornwick, a river-market town; the
// Lord-Warden's hall; the Sunken Loom (an Oruun ruin) in the river bend.
// Bristlebacks in the fields, Thornhounds in the forest, Emberwings.
//   node scripts/scenes/verdant.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, smooth, pathDist, exits, town, grow, people, scene, dock, river, bridgeAcross, HALF } from './lib/region.mjs';

const SEED = 21;
const L = new Land(240, 2, SEED);
// The river: north to south through the middle-west, a bend round the ruin.
const RIVER = [[-30, -125], [-36, -70], [-22, -30], [-30, 10], [-52, 40], [-44, 80], [-50, 125]];
const FLOOR = 5.5, LEVEL = 4.6;
L.shape((x, z) => {
    const rolling = 6.5 + fbm(x, z, 70, SEED) * 4 + fbm(x, z, 22, SEED + 5) * 0.8;
    const forest = smooth(0, 80, -x - z * 0.3) * 4;                         // the old forest rises in the south-west
    const bank = pathDist(RIVER, x, z);
    const w = smooth(12, 46, bank);                                         // a valley: the land settles to a floor near the river…
    return (rolling + forest) * w + FLOOR * (1 - w) - (1 - smooth(5, 12, bank)) * 3.4;   // …and the channel cut into it
});
// A ford downstream of the bridge: gravel bars across the river, shallow enough to wade (if the bridge burns,
// the way west is still open, only slower).
const FORD = { x: -43, z: 28, across: [30, 22] };
{
    const [ax, az] = FORD.across, al = Math.hypot(ax, az), ux = ax / al, uz = az / al;
    L.add((x, z, h) => {
        const dx = x - FORD.x, dz = z - FORD.z, along = dx * ux + dz * uz, off = Math.abs(-dx * uz + dz * ux);
        if (Math.abs(along) > 16 || off > 5) return 0;
        const k = 1 - smooth(2.5, 5, off), bed = LEVEL - 0.5;
        return h < bed ? (bed - h) * k : 0;
    });
}
// Thornwick on the east bank; farmland north-east; the forest south-west.
const TW = { x: 18, z: 4 };
const S = new Dresser(L, SEED);
const T = town(L, S, {
    id: 'Thornwick', x: TW.x, z: TW.z, r: 30, plazaR: 12,
    buildings: ['thornwick_hall', 'house', 'cottage', { type: 'timber_house', kind: 'house', cols: 5, depth: 4, rows: 3 }, 'cottage', 'house',
                { type: 'timber_house', kind: 'barn', cols: 6, depth: 5, rows: 3 }, 'cottage', 'smithy', 'house'],
    startAngle: -Math.PI / 2,
});
// The market in the plaza; a well; lamps.
for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; S.add(`Thornwick_Stall_${i + 1}`, 'stall', TW.x + Math.cos(a) * 7, TW.z + Math.sin(a) * 7, -a + Math.PI / 2, { width: 2.4, awning: ['red', 'ochre', 'green', 'blue'][i % 4], seed: i }, 2); }
S.add('Thornwick_Well', 'basin', TW.x, TW.z, 0, { seed: 4, owner: 'civilian' }, 2);
// A dock on the river below the town, and a bridge west over it.
const bridgeX = -26, bridgeZ = 4;
// The river, a sheet per stretch; the two that meet at the dam (THROAT, a bend of RIVER) stop there, so the water
// can stand higher above it than below while the slide holds (the Dry Mill, below).
const THROAT = 2;                                             // RIVER[THROAT] is where the slide came down
for (let k = 0; k < RIVER.length - 1; k++) {
    const [ax, az] = RIVER[k], [bx, bz] = RIVER[k + 1], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const pa = k === THROAT ? 0.6 : 22 * 0.3, pb = k + 1 === THROAT ? 0.6 : 22 * 0.3;
    const cx = (ax - ux * pa + bx + ux * pb) / 2, cz = (az - uz * pa + bz + uz * pb) / 2;
    S.add(`River_${k + 1}`, 'water', cx, cz, Math.atan2(bx - ax, bz - az), { kind: 'water', width: 22, depth: len + pa + pb, level: LEVEL });
}
dock(L, S, 'Thornwick_Dock', 0, 22, -1, 0, LEVEL);
S.add('Start', 'spawn', TW.x + 4, TW.z + 14, Math.PI, { name: 'start' }, 2);
// Roads: exits to the town, through the bridge.
const ends = exits('verdant', L, S, { banner: 'green', surface: 'dirt' });
for (const e of ends) {
    // The west road stops at each bank: the bridge carries it over the river (placed after, on the roads' ground).
    if (e.to === 'gate') { L.road([[e.x, e.z], [bridgeX - 17, bridgeZ]], 4.5, 'dirt'); L.road([[bridgeX + 9, bridgeZ], [TW.x - 12, TW.z]], 4.5, 'dirt'); }
    else L.road([[e.x, e.z], [(e.x + TW.x) / 2, (e.z + TW.z) / 2 + 6], [TW.x, TW.z]], 4.5, 'dirt');
}
// Thornwick's bridge: timber on posts. It can burn (the ford below is the other way over).
bridgeAcross(L, S, 'Thornwick_Bridge', bridgeX, bridgeZ, 1, 0, LEVEL, { width: 4, rise: 0.5, style: 'plank', seed: 2 });
L.paintCircle(TW.x, TW.z, 12, 'cobble');
L.paint((x, z, h, sl, cur) => Math.hypot(x - FORD.x, z - FORD.z) < 15 && Math.abs(h - (LEVEL - 0.5)) < 0.15 ? 'sand' : null);     // the ford's gravel            // the plaza over the roads' ends
// The Lord-Warden in his hall, folk in the market, guards at the bridge.
const hall = T.spots[0];
S.add('Maren', 'npc', hall.x + Math.sin(hall.face) * 6, hall.z + Math.cos(hall.face) * 6, hall.face + Math.PI, { name: 'Lord-Warden Aldric Maren', look: 'maren', role: 'idle' });
people(S, { id: 'Thornwick', x: TW.x, z: TW.z, folk: 'verdant_folk', guard: 'verdant_guard', n: 6, guards: [[bridgeX + 15, bridgeZ - 3, -Math.PI / 2], [bridgeX + 15, bridgeZ + 3, -Math.PI / 2]] });
// Farmland north-east: fields of hay and fences.
for (let f = 0; f < 4; f++) {
    const fx = 50 + (f % 2) * 30, fz = -55 + Math.floor(f / 2) * 28;
    L.flatten(fx, fz, 14, null, 0.8); L.paintCircle(fx, fz, 11, 'dirt');
    for (let i = 0; i < 6; i++) S.add(`Field_${f + 1}_Hay_${i + 1}`, 'hay', fx - 6 + (i % 3) * 6, fz - 3 + Math.floor(i / 3) * 6, 0, { seed: f * 10 + i, owner: 'civilian' }, 1);
    S.add(`Field_${f + 1}_Fence`, 'b_fence', fx, fz + 12, 0, { length: 22, height: 1.1, seed: f }, 1);
}
S.add('Field_Barn', 'timber_house', 66, -82, 0, { kind: 'barn', cols: 7, depth: 5, rows: 3, seed: 9, owner: 'civilian' }, 9);
// The Sunken Loom: an Oruun weaving-hall half under the river at the bend.
const LOOM = { x: -40, z: 52 };
for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; S.add(`Loom_Pillar_${i + 1}`, 'pillar', LOOM.x + Math.cos(a) * 7, LOOM.z + Math.sin(a) * 7, 0, { height: 3 + (i % 3) * 1.5, broken: i % 2 === 0, seed: i }, 2); }
S.add('Loom_Statue', 'statue', LOOM.x + 9, LOOM.z, -Math.PI / 2, { height: 6, style: 'stone', seed: 5 }, 3);
S.add('Loom_Arch', 'archway', LOOM.x + 4, LOOM.z - 8, 0, { width: 4, height: 4.5 }, 3);
S.add('Loom_Wall_1', 'ruin_wall', LOOM.x + 2, LOOM.z + 9, 0, { length: 8, height: 2.6, runes: true, seed: 3 }, 3);
// Creatures: a boar in the fields, hounds in the forest, a flock over the hills.
S.add('Fields_Boar', 'creature', 70, -40, 0, { species: 'bristleback', count: 1, spread: 2, aggressive: true });
S.add('Forest_Hounds', 'creature', -70, 70, 0, { species: 'thornhound', count: 3, spread: 4, aggressive: true });
S.add('Hills_Flock', 'creature', 60, 60, 0, { species: 'emberwing', count: 3, spread: 5, aggressive: false });
S.add('Ruin_Shellback', 'creature', LOOM.x + 16, LOOM.z + 14, 0, { species: 'shellback', count: 1, spread: 1, aggressive: false });
// Growth: the old forest south-west, meadows elsewhere, reeds on the river.
grow(S, 'Forest', 'forest', { x0: -115, z0: 20, x1: -60, z1: 115 }, { trees: 70, plants: 70, boulders: 10 });
grow(S, 'Woods', 'forest', { x0: -115, z0: -115, x1: -60, z1: -40 }, { trees: 35, plants: 40, boulders: 6 });
grow(S, 'Meadow', 'meadow', { x0: -10, z0: 30, x1: 115, z1: 115 }, { trees: 35, plants: 70, boulders: 10, ok: (x, z, h) => !L.busy(x, z, 3) });
grow(S, 'Upland', 'meadow', { x0: 0, z0: -115, x1: 115, z1: -20 }, { trees: 20, plants: 40, boulders: 8, ok: (x, z) => !L.busy(x, z, 3) });
grow(S, 'Riverbank', 'river', { x0: -75, z0: -115, x1: 5, z1: 115 }, { trees: 18, plants: 50, boulders: 4, ok: (x, z, h) => h > LEVEL + 0.4 && h < FLOOR + 1.5 });
// Paint: river sand and mud, forest moss, rock on the steep.
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;                                 // roads and plazas stay
    const bank = pathDist(RIVER, x, z);
    if (bank < 9 && h < LEVEL + 0.3) return 'mud';
    if (bank < 14 && h < FLOOR + 0.4) return 'sand';
    if (s > 0.55) return 'rock';
    if (-x - z * 0.3 > 70 && fbm(x, z, 15, 3) > -0.2) return 'moss';
    return null;
});
// ---- Act I: The Dry Mill (docs/STORY.md) ----
// Since the night the stone cracked, a slide has dammed the river at the throat above town: the water stands high
// behind it and runs low below it (the ford dry, the dock in mud, the mill's wheel still). A Stonebound warden was paid
// to keep people off it. Lift the rocks off the timber jam and the river carries it away (quiet); break the jam
// and the river comes all at once (the dock and the mill's wheel go with it); burn it, and the hillside smokes.
const [DX, DZ] = RIVER[THROAT];
S.add('Slide_Jam', 'barricade', DX - 1.5, DZ, 0, { cols: 12, rows: 3, posts: false, regenAfter: 0, owner: 'none' });
for (let i = 0; i < 6; i++) S.add(`Slide_Rock_${i + 1}`, 'rock', DX - 6.5 + i * 1.75, DZ + 1.3, i * 1.3, { radius: 0.44 + (i % 3) * 0.01, seed: 300 + i * 7 });
for (const [x, z, size, seed] of [[DX - 9, DZ - 0.5, 2.6, 1], [DX + 7.5, DZ - 0.5, 2.8, 2], [DX - 10.5, DZ - 3, 2.2, 3], [DX + 9.5, DZ + 2, 2, 4], [DX + 4, DZ - 2.5, 1.6, 5]]) S.add(`Slide_Boulder_${seed}`, 'boulder', x, z, seed, { kind: 'crag', size, seed: 400 + seed });
// The mill on the west bank, its wheel in the stream; the miller, the dockhand, the warden.
S.add('Thornwick_Mill', 'timber_house', -44, -15, Math.PI / 2, { kind: 'house', cols: 4, depth: 3, rows: 2, seed: 12, owner: 'civilian' }, 6);
S.add('Thornwick_Mill_Wheel', 'waterwheel', -33.5, -15, 0, { y: LEVEL + 1.6, radius: 2.2, width: 1, turning: true, owner: 'civilian' });
S.add('Thornwick_Miller', 'npc', -40, -11, Math.PI / 2, { name: 'Hobb the miller', look: 'verdant_folk', role: 'idle', home: 'Thornwick_Mill' });
S.add('Thornwick_Dockhand', 'npc', -19.5, 22, -Math.PI / 2, { name: 'Pell', look: 'verdant_folk', role: 'idle' });
S.add('Doran', 'npc', -11, -33, -Math.PI / 2, { name: 'Doran of the Stonebound', look: 'stonebound', role: 'idle', showWhen: 'lesson1' });
// Cael comes into the Reach with you (after the Gate), and goes on north when Thornwick's done.
S.add('Cael', 'npc', -100, 2.5, Math.PI / 2, { name: 'Cael', look: 'cael', role: 'idle', showWhen: 'lesson1, !act1.yard' });
// The Lord-Warden's training yard east of the hall: straw men, a pile of stones that never runs out, a sergeant.
const YARD = { x: 30, z: -38 };
L.flatten(YARD.x, YARD.z, 13, 7.7, 0.75);
L.paintCircle(YARD.x, YARD.z, 10, 'dirt');
S.add('Yard_Pile', 'rock_pile', YARD.x - 6, YARD.z, 0, { count: 4, radius: 0.42, seed: 610 }, 2);
for (let i = 0; i < 4; i++) S.add(`Yard_Dummy_${i + 1}`, 'dummy', YARD.x + 5 + (i % 2) * 1.5, YARD.z - 6 + i * 4, -Math.PI / 2, { seed: 70 + i, practice: true }, 1);
S.add('Yard_Fence_N', 'b_fence', YARD.x, YARD.z - 10, 0, { length: 18, height: 1.1, seed: 7 }, 1);
S.add('Yard_Fence_S', 'b_fence', YARD.x, YARD.z + 10, 0, { length: 18, height: 1.1, seed: 8 }, 1);
S.add('Brask', 'npc', YARD.x - 7, YARD.z - 4, Math.PI / 2, { name: 'Sergeant Brask', look: 'verdant_guard', role: 'idle' });

// The Watchstone: an Oruun ruin north of the fields, its stone cracked on purpose; the Stonebound who keep it.
const WATCH = { x: 34, z: -100 };
L.flatten(WATCH.x, WATCH.z, 18, null, 0.8);
L.paintCircle(WATCH.x, WATCH.z, 9, 'flagstone');
S.add('Watchstone', 'standing_stone', WATCH.x, WATCH.z, 0.3, { height: 3.6, cracked: true, chiselled: true, seed: 9 }, 3);
for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.2; S.add(`Watch_Pillar_${i + 1}`, 'pillar', WATCH.x + Math.cos(a) * 11, WATCH.z + Math.sin(a) * 11, 0, { height: 3.5 + (i % 3), broken: i % 3 === 1, seed: 40 + i }, 2); }
S.add('Watch_Wall_1', 'ruin_wall', WATCH.x - 7, WATCH.z - 12, 0.4, { length: 9, height: 2.4, runes: true, seed: 51 }, 3);
S.add('Watch_Wall_2', 'ruin_wall', WATCH.x + 9, WATCH.z - 10, -0.6, { length: 7, height: 2, runes: true, seed: 52 }, 3);
// Stones to answer them with, scattered through the ruin.
for (let i = 0; i < 9; i++) { const a = i * 2.39, d = 4 + (i % 3) * 2.5; S.add(`Watch_Rock_${i + 1}`, 'rock', WATCH.x + Math.cos(a) * d, WATCH.z + Math.sin(a) * d, a, { radius: 0.4 + (i % 3) * 0.02, seed: 500 + i * 3 }); }
S.add('Stonebound', 'creature', WATCH.x, WATCH.z - 9, 0, { species: 'stonebound', count: 3, spread: 4, aggressive: true, elite: true, tier: 'always', hidden: true, holder: 'Cael_Ruin' });
S.add('Cael_Ruin', 'npc', WATCH.x - 4, WATCH.z + 3, -2.2, { name: 'Cael', look: 'cael', role: 'idle', hidden: true, showWhen: 'lesson1, !act1.ruin' });
S.add('Zone_Ruin', 'trigger', WATCH.x, WATCH.z, 0, { width: 26, depth: 26, height: 6 });
S.add('Zone_Plaza', 'trigger', TW.x - 4, TW.z, 0, { width: 16, depth: 16, height: 4 });
S.add('Zone_Hall', 'trigger', 18, -11, 0, { width: 9, depth: 9, height: 4 });
S.add('Zone_Slide', 'trigger', DX + 10, DZ - 1, 0, { width: 10, depth: 16, height: 6 });

const UP = 'River_1,River_2', DOWN = 'River_3,River_4,River_5,River_6', LOW = 2.6, HIGH = LEVEL + 0.6;
const started = { flag: { name: 'thornwick.started' } }, mill = v => ({ flag: { name: 'thornwick.mill', is: v } });
const ROUTES = {
    arrive: '-80,2; -52,4; -40,4; -26,4; -12,4; 4,4',
    hall: '12,-4; 15,-8',
    up: '6,-2; -4,-12; -9,-22; -11,-27',
    back: '-9,-22; -4,-12; 6,-4; 14,-7',
    yard: '20,-20; 24,-32',
    north: '30,-48; 34,-80; 31,-92',
};
const script = {
    id: 'Thornwick', speaker: 'Cael', face: 'Cael', when: 'lesson1', flags: {},
    reactions: [
        { on: 'targetDown', count: 'yardHits', lines: [['@Cael One.'], ['@Cael Two. Again.'], ['@Cael Three.'], ['@Brask Good arm.']], cycle: false },
        { on: 'earthPulled', count: 'pulled', lines: [['@Brask Well, I\u2019ll be.'], [], []], cycle: false },
        { on: 'pulledThrow', count: 'pulledThrows', lines: [] },
        { on: 'earthRaised', count: 'raised', lines: [['@Cael Cover. Remember it\u2019s there.'], []], cycle: false },
        { on: 'stoneCaught', count: 'caught', throttle: 6, lines: [['@Cael_Ruin Ha! Now send it home.'], ['@Cael_Ruin Again.'], ['@Varn …They catch them?'], []] },
        { on: 'playerFire', count: 'fires', throttle: 18, lines: [['@Cael Not here. Not near the town.'], ['@Cael Fire again.'], ['@Cael Every roof in Thornwick is thatch. Think.']] },
    ],
    steps: [
        // The slide holds: the water stands high above the throat, low below it; the wheel is still. (Remembered once cleared.)
        { id: 'dam', do: [{ setFlag: { name: 'thornwick.started', value: 'true' } }, { water: { prefix: UP, level: HIGH, secs: 0 } }, { water: { prefix: DOWN, level: LOW, secs: 0 } }, { do: { obj: 'Thornwick_Mill_Wheel', action: 'stop' } }],
          until: { time: 0 } },
        { id: 'arrive', do: [{ npc: { id: 'Cael', role: 'lead', route: ROUTES.arrive } }],
          say: ['@Cael The Verdant Reach. Thornwick’s across the river.', '@Cael Look at the water. That river should be up to the bridge’s knees.', '@Cael It’s barely at its ankles.'],
          objective: 'Follow Cael east into Thornwick', mark: 'Cael', until: { signal: { obj: 'Zone_Plaza', name: 'entered' } } },
        { id: 'hall', do: [{ npc: { id: 'Cael', role: 'lead', route: ROUTES.hall } }],
          say: ['@Cael The Lord-Warden keeps the Reach’s accounts. If something’s wrong with the river, he’s counting it.'],
          objective: 'Speak with the Lord-Warden', mark: 'Maren', until: { signal: { obj: 'Zone_Hall', name: 'entered' } } },
        { id: 'ask',
          say: ['@Maren You’ll be the Wielder from the Gate. Word travels faster than people do.', '@Maren Three nights back the hills shook, and a slide came down above the throat. The river’s dammed.',
                '@Maren The mill’s stopped. The boats are sitting in mud. The low fields are drying.', '@Maren I sent six men to shift it. Two came back carrying the third.'],
          choices: [
              { label: 'We’ll clear it.', flag: { name: 'thornwick.ask', value: 'earnest' }, say: ['@Maren Good. The throat’s up the river road, north. You can’t miss it. There’s no river.'] },
              { label: 'What’s it worth to you?', flag: { name: 'thornwick.ask', value: 'paid' }, say: ['@Maren Bread for the winter. Mine, and yours.', '@Maren And I’ll remember it. I remember everything; it’s the job.'] },
              { label: 'Why can’t your Wielders do it?', flag: { name: 'thornwick.ask', value: 'asked' }, say: ['@Maren The Stonebound keep ruins, not rivers.', '@Maren And their warden up there won’t let my men near the slide. Says it’s not his to move.'] },
          ] },
        { id: 'north', say: ['@Cael North, then. Up the river.'], do: [{ checkpoint: true }, { npc: { id: 'Cael', role: 'lead', route: ROUTES.up } }],
          objective: 'Go north up the river to the rockslide', mark: 'Slide_Jam', until: { signal: { obj: 'Zone_Slide', name: 'entered' } } },
        { id: 'doran',
          say: ['@Doran That’s far enough.', '@Doran The stones came down on their own. The night the hills shook. I watched them walk.', '@Cael Stones don’t walk.', '@Doran These did.',
                '@Doran A man in grey came up the river road the morning after. Paid me good silver to keep folk off it. Said the river would find its own way.', '@Cael What did he look like?', '@Doran Like nobody. That’s what I remember about him.'],
          choices: [
              { label: 'Step aside. Thornwick needs its river.', flag: { name: 'thornwick.doran', value: 'told' }, say: ['@Doran Then you clear it. I’ll not lift a hand to it.', '@Doran Or against you.'] },
              { label: 'Who paid you?', flag: { name: 'thornwick.doran', value: 'asked' }, say: ['@Doran Grey cloak. Grey eyes. Silver with no face on it. Not the Empire’s coin.', '@Cael …Not the Empire’s.'] },
              { label: 'Keep the silver. We’ll do this.', flag: { name: 'thornwick.doran', value: 'spared' }, say: ['@Doran Kind of you. It’s spent anyway.'] },
          ],
          then: { do: [{ npc: { id: 'Doran', role: 'walk', target: { x: DX + 13, z: DZ - 9 } } }] } },
        { id: 'slide', do: [{ npc: { id: 'Cael', role: 'walk', target: { x: DX + 10, z: DZ + 4 } } }],
          say: ['@Cael Rock on top of timber. The rocks hold the timber down; the timber holds the river back.', '@Cael Lift the rocks off and the river will do the rest.', '@Cael Or break it. Then you’ll find out what breaking costs, downstream.'],
          objective: 'Open the river', mark: 'Slide_Rock_3',
          waiting: [{ when: { time: 45 }, say: ['@Cael The rocks. Lift them off the timber and set them on the bank. One at a time.'] }],
          ends: [
              { when: { burned: { obj: 'Slide_Jam', min: 3 } }, outcome: 'burned', next: 'back',
                say: ['@Cael Fire. Of course it was fire.', '@Cael It’s open. And the hillside’s smoking. They’ll see that from the square.'],
                do: [{ water: { prefix: UP, level: LEVEL, secs: 15 } }, { water: { prefix: DOWN, level: LEVEL, secs: 20 } }, { do: { obj: 'Thornwick_Mill_Wheel', action: 'start' } },
                     { ledger: { tally: 'excess', add: 1 } }, { setFlag: { name: 'thornwick.mill', value: 'burned' } }, { flag: { name: 'caelTrust', add: -1 } }, { checkpoint: true }] },
              { when: { any: [{ signal: { obj: 'Slide_Jam', name: 'broken' } }, { broken: { obj: 'Slide_Jam', min: 4 } }] }, outcome: 'loud', next: 'surge',
                say: ['@Cael Down!', '@Cael …Listen. That’s the river. All of it at once.'],
                do: [{ water: { prefix: UP, level: LEVEL, secs: 5 } }, { water: { prefix: DOWN, level: LEVEL + 1, secs: 4, settle: { level: LEVEL, secs: 25 } } },
                     { ledger: { tally: 'excess', add: 1 } }, { setFlag: { name: 'thornwick.mill', value: 'loud' } }, { flag: { name: 'caelTrust', add: -1 } }] },
              { when: { many: { prefix: 'Slide_Rock_', type: 'rock', signal: 'moved', min: 5 } }, outcome: 'quiet', next: 'back',
                say: ['@Cael Feel that? The river took it from there.', '@Cael You moved a hillside and broke nothing. Thornwick will never know how close it came.'],
                do: [{ do: { obj: 'Slide_Jam', action: 'sink' } }, { water: { prefix: UP, level: LEVEL, secs: 20 } }, { water: { prefix: DOWN, level: LEVEL, secs: 25 } },
                     { do: { obj: 'Thornwick_Mill_Wheel', action: 'start' } }, { ledger: { tally: 'care', add: 3 } }, { grant: { el: 'earth', track: 'control', amount: 0.2 } },
                     { setFlag: { name: 'thornwick.mill', value: 'quiet' } }, { flag: { name: 'caelTrust', add: 1 } }, { checkpoint: true }] },
          ] },
        // The surge reaches town: the dock, and the mill's wheel, go with it.
        { id: 'surge', until: { time: 3 }, then: { do: [{ do: { obj: 'Thornwick_Dock', action: 'wreck' } }, { do: { obj: 'Thornwick_Mill_Wheel', action: 'wreck' } }, { checkpoint: true }],
          say: ['@Cael And that was the dock. And something else, by the sound of it. The mill.'] } },
        { id: 'back', do: [{ npc: { id: 'Cael', role: 'lead', route: ROUTES.back } }], objective: 'Go back to the Lord-Warden', mark: 'Maren', until: { signal: { obj: 'Zone_Hall', name: 'inside' } } },
        { id: 'reckoning', ends: [
            { when: mill('quiet'), say: ['@Maren The wheel’s turning. Hobb came running up the hill to tell me himself; I’ve never seen him run.', '@Maren The Reach owes you. I keep its accounts. You’re in them now, on the right side.'] },
            { when: mill('loud'), say: ['@Maren The river’s back. So is half the dock, in pieces, two miles down.', '@Maren Hobb’s wheel is kindling. He’ll mend it by spring. Maybe.', '@Maren I’ll pay for the dock. I don’t know yet what you’ll pay.'] },
            { when: mill('burned'), say: ['@Maren We saw the smoke from the square. Half the town thought the hills were on fire.', '@Maren Half the hills were. The river’s running, though. Through ash, but running.'] },
            { when: { time: 0 }, say: ['@Maren Well?'] } ] },
        { id: 'onward', do: [{ setFlag: { name: 'act1.mill', value: 'done' } }],
          say: ['@Cael There’s an Oruun ruin north of here, past the fields.', '@Cael Doran’s stones didn’t walk on their own. And his man in grey didn’t pay in Empire silver.',
                '@Cael Whoever we find up there won’t ask questions first. The Stonebound throw stone. So will you.',
                '@Cael Maren’s guards keep a yard east of the hall. Come. Show me you can hit what you aim at.'],
          until: { talking: false }, then: { do: [{ npc: { id: 'Cael', role: 'lead', route: ROUTES.yard } }] } },
        // Practice first: the yard's straw men and a pile of stones that never runs out.
        { id: 'yard', do: [{ checkpoint: true }, { npc: { id: 'Cael', role: 'idle', at: { x: YARD.x - 7, z: YARD.z + 4 } } }, { hint: 'Touch a stone to lift it. Flick toward a straw man to throw: the faster the flick, the harder the throw.' }],
          say: ['@Cael Lift a stone from the pile. Flick it at a straw man.', '@Cael Throw hard. A slow stone only bumps them.'],
          objective: 'Knock down three of the straw men in the yard', mark: 'Yard_Pile',
          waiting: [{ when: { time: 40 }, say: ['@Brask Aim at the chest, not the head. And put your arm into it.'] },
                    { when: { time: 80 }, say: ['@Cael Closer, if you need to. Nobody\u2019s counting the distance. Yet.'] }],
          until: { many: { prefix: 'Yard_Dummy_', type: 'dummy', signal: 'hit', min: 3 } } },
        // The ground is full of stones: pull one up and throw it; hold on, and the earth rises as cover.
        { id: 'ground', do: [{ setFlag: { name: 'learned.pull', value: 'yes' } }, { hint: 'Hold your finger still on open ground: a stone tears up into your hand. Flick to throw it.' }],
          say: ['@Cael Good. Now, the pile is a crutch. Out there, nobody leaves you a pile.', '@Cael The ground is full of stones. Put your hand on it, hold still, and ask.'],
          objective: 'Pull a stone from the ground and throw it', mark: 'Yard_Dummy_2',
          waiting: [{ when: { time: 30 }, say: ['@Cael Not on the pile. On the bare ground. Press, and hold still.'] }],
          until: { count: { name: 'pulledThrows', min: 1 } } },
        { id: 'cover', do: [{ setFlag: { name: 'learned.raise', value: 'yes' } }, { hint: 'Hold still longer: the stone sinks back and the ground rises as a column. Keep holding to raise it higher.' }],
          say: ['@Cael And if you don\u2019t let go, the ground keeps coming.', '@Cael Hold still past the stone. Make a wall to stand behind.'],
          objective: 'Raise a column of earth', mark: 'Yard_Pile',
          until: { count: { name: 'raised', min: 1 } },
          then: { say: ['@Cael Now imagine they throw back.', '@Cael They will. Watch their hands: when a stone goes up, move. Or catch it, if you\u2019re quick; touch it as it comes.', '@Cael I\u2019ll go ahead to the ruin. North, past the fields. Come when you\u2019re ready; the yard\u2019s here if you want more.'],
                  do: [{ setFlag: { name: 'act1.yard', value: 'done' } }, { npc: { id: 'Cael', role: 'lead', route: ROUTES.north } }] } },
        // He goes on ahead to the ruin; there he waits (Cael_Ruin, revealed now and remembered).
        { id: 'gone', until: { time: 14 }, then: { do: [{ hide: ['Cael'] }, { reveal: ['Cael_Ruin'] }, { checkpoint: true }] } },
        // ---- Act I's end: the Watchstone, cracked on purpose; the Stonebound ----
        { id: 'ruinroad', objective: 'Follow the road north to the Oruun ruin', mark: 'Cael_Ruin', until: { signal: { obj: 'Zone_Ruin', name: 'inside' } } },
        { id: 'watch', do: [{ npc: { id: 'Cael_Ruin', role: 'walk', target: { x: WATCH.x - 3, z: WATCH.z + 2.5 } } }],
          say: ['@Cael_Ruin You came. Good.', '@Cael_Ruin Look at the stone. Put your hand on it. Tell me what you feel.'],
          objective: 'Touch the cracked stone', mark: 'Watchstone', until: { signal: { obj: 'Watchstone', name: 'touched' } } },
        { id: 'chisel',
          say: ['@Cael_Ruin It answered you. Even broken.', '@Cael_Ruin Now look closer. Inside the crack.', '@Cael_Ruin Chisel marks. Square, even, patient. Someone cracked this on purpose, with the right tools and all night to do it.',
                '@Cael_Ruin And that, at the foot of it. Grey cloth.', '@Cael_Ruin …', '@Cael_Ruin I know this hand.'],
          choices: [
              { label: 'Whose hand?', flag: { name: 'act1.chisel', value: 'asked' }, say: ['@Cael_Ruin Not yet. Not until I’m sure. If I say it and I’m wrong, I can’t unsay it.'] },
              { label: 'The man in grey. Doran’s.', flag: { name: 'act1.chisel', value: 'grey' }, say: ['@Cael_Ruin Maybe. I hope not.'] },
              { label: '(Say nothing.)', flag: { name: 'act1.chisel', value: 'silent' }, say: ['@Cael_Ruin …Thank you.'] },
          ] },
        { id: 'ambush', do: [{ checkpoint: true }, { reveal: ['Stonebound'] }, { protect: 20 }],
          say: ['@Varn Step away from the stone.', '@Varn The Stonebound keep this place. Three stones cracked in the Reach since the hills shook, and here you are with your hand on the fourth.',
                '@Cael_Ruin We didn’t crack it.', '@Varn Tell it to the stone.'],
          until: { talking: false } },
        { id: 'fight', do: [{ do: { obj: 'Stonebound', action: 'hold' } }, { hint: 'A stone thrown at you can be caught: touch it in the air, then flick it back. Or hold the ground for one of your own.' }],
          say: ['@Cael_Ruin I’ll hold this one. The others are yours. Don’t kill them. Make them stop.', '@Cael_Ruin Stone answers stone. Throw.'],
          objective: 'Make the Stonebound yield', mark: 'Stonebound',
          waiting: [{ when: { time: 25 }, say: ['@Cael_Ruin Watch their hands. When the stone goes up, move. When they raise a slab, wait for it to drop.'] }],
          until: { signal: { obj: 'Stonebound', name: 'yielded' } },
          then: { do: [{ do: { obj: 'Stonebound', action: 'yieldAll' } }, { protect: 0 }, { npc: { id: 'Cael_Ruin', role: 'walk', target: { x: WATCH.x, z: WATCH.z - 6 } } }] } },
        { id: 'ended',
          say: ['@Cael_Ruin Enough.', '@Varn …You held Hollin without a scratch on him. What are you?', '@Cael_Ruin Someone who doesn’t need to break anything to win.',
                '@you Why are these people attacking us?', '@Cael_Ruin Because they think we’re the problem.', '@you Are we?', '@Cael_Ruin Not yet.'],
          until: { talking: false } },
        { id: 'judgement', say: ['@Varn Well? We’re yours to deal with.'],
          choices: [
              { label: 'Go. Keep your stones.', flag: { name: 'act1.varn', value: 'freed' }, do: [{ ledger: { tally: 'spared', add: 1 } }], say: ['@Varn …Doran said you were fair. I didn’t believe him.'] },
              { label: 'The Lord-Warden can judge you.', flag: { name: 'act1.varn', value: 'maren' }, say: ['@Varn The Lord-Warden hasn’t a cell that holds a Stonebound. But we’ll go. We keep our word.'] },
              { label: 'Who told you we’d come?', flag: { name: 'act1.varn', value: 'asked' }, say: ['@Varn Nobody tells the Stonebound anything.', '@Varn …A grey man, at the Loom, a week back. He said the Conduit would come north to crack the next stone. He was very sure.', '@Cael_Ruin Of course he was.'] },
          ] },
        { id: 'act1', do: [{ setFlag: { name: 'act1.ruin', value: 'done' } }, { checkpoint: true }],
          say: ['@Cael_Ruin There are more stones like this between here and the sea. If someone’s cracking them, someone’s counting on the cracks.',
                '@Cael_Ruin South, then. Saltmere. There’s an Oruun cistern on the way, and you’ve a great deal to learn about water.'],
          until: { talking: false }, then: { say: ['@Cael Meet me on the south road, past the river. I\u2019ll be waiting at the border.'], do: [{ hint: 'Act I is told: The Road and the Reach. Act II begins on the road south.' }] } },
        { id: 'south', do: [{ checkpoint: true }, { hide: ['Cael_Ruin'] }], objective: 'Take the road south, past the river, toward Saltmere', mark: 'Exit_cistern', until: { flag: { name: 'lesson2' } } },
    ],
    card: null,
};
// What Thornwick says while the river's dammed, and after (story/Talk.js): once the story has begun.
const folk = [
    { when: { all: [started, mill('quiet')] }, say: [['The wheel’s turning again! Did you hear it from the square?'], ['They say you lifted the slide off with your mind. Stone by stone.'], ['Bread tomorrow. Real bread.']] },
    { when: { all: [started, mill('loud')] }, say: [['The dock’s gone. Pell’s taking it hard.'], ['The river’s back. Too much of it, all at once.'], ['They say it came down like a wall. Took the mill wheel clean off.']] },
    { when: { all: [started, mill('burned')] }, say: [['The hillside’s black. You can smell it from here.'], ['The river’s running. Through ash.']] },
    { when: started, say: [['The mill’s been quiet three days. You don’t know how loud quiet is till the wheel stops.'], ['River’s so low you can walk the ford and not wet your knees.'], ['The Lord-Warden’s men came back from the throat with a broken arm between them.']] },
];
script.talk = {
    Brask: [
        { when: { flag: { name: 'act1.yard' } }, say: [['Come back any time. The straw men don\u2019t mind.'], ['Good arm. Better than my lads.']] },
        { say: [['Lift from the pile, throw at the straw. The pile never runs dry; don\u2019t ask me how.'], ['Aim at the chest. A straw man falls from the middle.'], ['A slow throw bumps. A fast one drops them.']] },
    ],
    Cael_Ruin: [
        { when: { flag: { name: 'act1.ruin' } }, say: [['South, when you\u2019re ready. The cistern won\u2019t teach itself.'], ['Varn will talk. Stonebound always talk, eventually. Mostly to stones.']] },
        { say: [['Look at the crack. Then tell me stones walk.']] },
    ],
    Cael: [
        { when: mill('quiet'), say: [['The wheel. Listen to it. That’s what not breaking things sounds like.']] },
        { when: mill('loud'), say: [['You opened the river. The river opened the dock. That’s how it goes.']] },
        { when: mill('burned'), say: [['I can still smell it. So can they.']] },
        { when: started, say: [['Keep up. The Reach doesn’t wait.'], ['Look at the bank. The water line’s a hand above the river. Three days, maybe four.']] },
    ],
    Maren: [
        { when: mill('quiet'), say: [['You’re in my accounts now. On the right side.'], ['Hobb hasn’t stopped talking about you. Hobb doesn’t talk.']] },
        { when: mill('loud'), say: [['I’ll pay for the dock. Mind the next one.']] },
        { when: mill('burned'), say: [['Half the town thought the hills were burning. Half of them were.']] },
        { when: started, say: [['The throat’s up the river road, north.'], ['My accounts say bread for nine days. The river says six.']] },
    ],
    Thornwick_Miller: [
        { when: mill('quiet'), say: [['Listen to her! Listen to that wheel!'], ['Flour by morning. Come for the first loaf.']] },
        { when: mill('loud'), say: [['My wheel. My wheel’s in the river.'], ['Thirty years she turned. Thirty years.']] },
        { when: mill('burned'), say: [['Flour’s grey with ash. Still flour.']] },
        { when: started, say: [['Three days without grinding. The bread’ll run out before the rain comes.'], ['Look at her. A wheel’s not meant to stand still.']] },
    ],
    Thornwick_Dockhand: [
        { when: mill('loud'), say: [['Twenty years I kept that dock. Twenty years.'], ['Don’t. Just don’t.']] },
        { when: { any: [mill('quiet'), mill('burned')] }, say: [['Water’s back under her. Boats floating again.']] },
        { when: started, say: [['Dock’s standing in mud. Boats on their bellies.'], ['Never seen the river this low. Not in a dry summer.']] },
    ],
    Doran: [
        { when: { flag: { name: 'thornwick.mill' } }, say: [['I took his silver. I’ll not take it twice.'], ['The stones didn’t walk back. You moved them.']] },
        { when: started, say: [['That’s far enough.'], ['Stonebound keep ruins. Not rivers.']] },
    ],
};
for (let i = 1; i <= 6; i++) script.talk[`Thornwick_Folk_${i}`] = folk;
const out = scene('verdant', 'The Verdant Reach · Thornwick', L, S, { region: 'verdant' });
out.script = script;
fs.writeFileSync('scenes/verdant.json', JSON.stringify(out, null, 1) + '\n');
console.log('verdant:', S.objects.length, 'objects');
