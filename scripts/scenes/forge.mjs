// ============================================================
// Builds scenes/forge.json: the Cold Forge, the pass north from the Verdant
// Reach to the Emberwall Marches, where Lesson III (Fire, held) happens on
// the road (docs/STORY.md, Act II). Run from the repo root:
//   node scripts/scenes/forge.mjs
//
// A pass climbs north out of the Reach's meadows into basalt. Halfway up, in
// a ruined court, stands an Oruun forge, cold a thousand years; beyond it
// the Oruun closed the pass with a door that answers the forge. Light the
// forge and hold its heat steady (too much and its heart-stone cracks), and
// the door opens. That night, a camp at the forge: Cael and the player talk.
// Cael leads; Bram follows.
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, ridge, smooth, exits, grow, scene } from './lib/region.mjs';

const SEED = 37, FLOOR = 8;
const COURT = { x: 0, z: 2 }, GATE_Z = -24;
const L = new Land(240, 2, SEED);
L.shape((x, z) => {
    const ax = Math.abs(x);
    // The pass: a valley (12 wide each side), widening into the forge's court, pinching at the Oruun door.
    const court = smooth(-14, -8, z) * (1 - smooth(14, 20, z));
    const throat = smooth(GATE_Z - 6, GATE_Z - 3, z) * (1 - smooth(GATE_Z + 3, GATE_Z + 7, z));
    const hw = 12 + 8 * court - 8.5 * throat;
    const cliff = smooth(hw, hw + 4, ax);
    const climb = FLOOR - z * 0.045;                                          // rising toward the Marches, north
    const floor = climb + fbm(x, z, 26, SEED) * 0.8 * (1 - court) * (1 - cliff);
    return floor + cliff * (18 + ridge(x, z, 36, SEED) * 14) + smooth(hw + 4, 70, ax) * 24;
});
L.flatten(COURT.x, COURT.z, 16, FLOOR - COURT.z * 0.045, 0.8);
const S = new Dresser(L, SEED);
const o = S.objects;

// The forge, its ruined court, and the smith who made it (a statue, faceless).
S.add('Oruun_Forge', 'forge', COURT.x, COURT.z - 2, 0, {}, 3);
for (const [i, [x, z]] of [[-11, -8], [11, -8], [-13, 6], [13, 6], [-7, 13], [7, 13]].entries()) S.add(`Court_Pillar_${i + 1}`, 'pillar', x, z, 0, { height: 3.6 + (i % 3) * 0.8, broken: i % 2 === 1, seed: 40 + i }, 2);
S.add('Court_Wall_W', 'ruin_wall', -14, -1, Math.PI / 2, { length: 9, height: 1.6, runes: true, seed: 51 }, 2);
S.add('Court_Wall_E', 'ruin_wall', 14, -1, Math.PI / 2, { length: 9, height: 1.2, runes: true, seed: 52 }, 2);
S.add('Smith_Statue', 'statue', -6, -9, 0.4, { height: 5, style: 'basalt', seed: 13 }, 3);
L.paint((x, z) => Math.hypot(x - COURT.x, z - COURT.z) < 14 ? 'cobble' : null);
// The door the forge answers, across the throat.
S.add('Pass_Gate', 'gate', 0, GATE_Z, 0, { width: 7.2, height: 5.2, open: false });
// The camp for the night: a fire in an old brazier, packs, a bedroll's worth of hay.
S.add('Camp_Fire', 'brazier', -6, 8, 0, { seed: 2 }, 1);
for (let i = 0; i < 2; i++) S.add(`Camp_Hay_${i + 1}`, 'hay', -8.5 + i * 1.3, 10.5, i, { seed: 70 + i }, 1);
// Cael and Bram, come up from the Reach with you.
S.add('Cael', 'npc', 2.5, 100, Math.PI, { name: 'Cael', look: 'cael', role: 'idle', showWhen: 'act2.saltmere' });
S.add('Bram', 'npc', -2.5, 101, Math.PI, { name: 'Bram', look: 'bram', role: 'idle', showWhen: 'act2.saltmere' });
S.add('Zone_Forge', 'trigger', COURT.x, COURT.z + 2, 0, { width: 30, depth: 24, height: 8 });
S.add('Zone_North', 'trigger', 0, GATE_Z - 18, 0, { width: 18, depth: 6, height: 8 });
S.add('Spawn', 'spawn', 0, 102, Math.PI, { name: 'start' });

const ends = exits('forge', L, S, { banner: 'red', surface: 'dirt', style: 'basalt' });
const south = ends.find(e => e.to === 'verdant'), north = ends.find(e => e.to === 'emberwall');
L.road([[south.x, south.z], [1, 60], [0, 20]], 4, 'dirt');
L.road([[0, -14], [0, GATE_Z], [-1, -60], [north.x, north.z]], 4, 'dirt');
grow(S, 'Pass', 'ash', { x0: -60, z0: -115, x1: 60, z1: 115 }, { trees: 22, plants: 40, boulders: 30, ok: (x, z, h, sl) => (z > 22 || z < GATE_Z - 8) && sl < 0.6 && !L.busy(x, z, 2) });
L.paint((x, z, h, sl, cur) => cur !== 0 ? null : sl > 0.55 ? 'rock' : z < -10 ? 'ash' : null);

// ---- the story: the forge; the night; on to Emberwall ----
const forge = v => ({ signal: { obj: 'Oruun_Forge', name: v } });
const script = {
    id: 'Forge', speaker: 'Cael', face: 'Cael', when: 'act2.saltmere', flags: {},
    reactions: [
        { on: 'playerFire', count: 'fires', throttle: 20, lines: [['@Bram Not the grass! Not the grass.'], ['@Cael The forge. Only the forge.']] },
    ],
    steps: [
        { id: 'road', do: [{ setFlag: { name: 'journey', value: '' } }, { npc: { id: 'Cael', role: 'lead', route: '1,80; 1,50; 0,24; 1,14' } }, { npc: { id: 'Bram', role: 'follow' } }],
          say: ['@Bram So that’s Emberwall up there? The black bit?', '@Cael The Marches. Over the pass.', '@Cael There’s a forge on this road older than Cindrel. Before the Marches, one more lesson.'],
          objective: 'Follow Cael up the pass', mark: 'Cael', until: { signal: { obj: 'Zone_Forge', name: 'inside' } } },
        { id: 'forge', do: [{ checkpoint: true }, { setElement: { el: 'fire', state: 'trained' } }, { npc: { id: 'Cael', role: 'walk', target: { x: 4, z: 5 } } },
                            { hint: 'Hold Fire on the forge’s heart: it heats while you hold, cools when you stop. Keep it in the gold band until it catches. Too much, and the stone cracks.' }],
          say: ['@Cael The Oruun forged here. It’s been cold a thousand years.', '@Cael Fire you throw is easy. Fire you keep is the hard kind.',
                '@Cael Light it. Then hold it there. Not more. Never more.'],
          objective: 'Light the forge and hold its heat steady', mark: 'Oruun_Forge',
          waiting: [{ when: forge('cracked'), say: ['@Cael Too much. Feel it go past what it needs. Let it cool, then again, gentler.', '@Bram Is it supposed to make that noise?'] },
                    { when: forge('hot'), say: ['@Cael There. Now don’t want more for it.'] },
                    { when: { time: 50 }, say: ['@Bram Maybe less fire? I’m not an expert. In fire.'] }],
          until: forge('lit'),
          then: { do: [{ do: { obj: 'Pass_Gate', action: 'open' } }] } },
        { id: 'lit', ends: [
            { when: forge('cracked'), say: ['@Bram The door! The door’s opening!', '@Cael It holds. The crack will too. That’s what fire does when you want too much from it.'],
              do: [{ setFlag: { name: 'lesson3.forge', value: 'cracked' } }, { grant: { el: 'fire', track: 'control', amount: 0.1 } }] },
            { when: { time: 0 }, say: ['@Bram The door! The door’s opening!', '@Cael Not a mark on it. That’s restraint. It’s rarer than power, and it lasts longer.'],
              do: [{ setFlag: { name: 'lesson3.forge', value: 'clean' } }, { grant: { el: 'fire', track: 'control', amount: 0.2 } }, { ledger: { tally: 'care', add: 0.5 } }] } ] },
        // The night at the forge.
        { id: 'camp', do: [{ mood: { name: 'dusk', secs: 6 } }, { npc: { id: 'Cael', role: 'walk', target: { x: -4, z: 9 } } }, { npc: { id: 'Bram', role: 'walk', target: { x: -8, z: 7 } } }, { checkpoint: true }],
          say: ['@Bram I’ll take first watch. I won’t. But I’ll say I will.', '@Cael You held it. You wanted to give it more, and you didn’t.', '@Cael You could become something incredible.'],
          choices: [
              { label: 'A hero?', flag: { name: 'act2.camp', value: 'hero' },
                say: ['@Cael Something more important than that.', '@you What’s more important than being a hero?', '@Cael Knowing when not to be one.'] },
              { label: 'I just want to help people.', flag: { name: 'act2.camp', value: 'help' },
                say: ['@Cael I know. That’s the part that worries me.', '@Cael Helping is a fire too. It wants more than it needs.'] },
              { label: '(Say nothing.)', flag: { name: 'act2.camp', value: 'quiet' },
                say: ['@Cael Good. Sometimes that’s the answer.'] },
          ] },
        { id: 'stones', say: ['@you The chisel marks. You know whose they are.', '@Cael I think I do. I hope I’m wrong.', '@Cael Two stones. If there’s a third in the Marches, I won’t be able to hope anymore.'],
          until: { talking: false } },
        { id: 'onward', do: [{ mood: { name: 'day', secs: 4 } }, { setFlag: { name: 'lesson3', value: 'done' } }, { setFlag: { name: 'journey', value: 'emberwall' } }, { checkpoint: true },
                             { npc: { id: 'Cael', role: 'lead', route: `0,-10; 0,${GATE_Z}; -1,${GATE_Z - 16}` } }, { npc: { id: 'Bram', role: 'follow' } }],
          say: ['@Cael Morning. The Marches are through the door.'],
          objective: 'Take the pass north to the Emberwall Marches', mark: 'Cael', until: { signal: { obj: 'Zone_North', name: 'inside' } } },
    ],
    card: null,
};
script.talk = {
    Cael: [
        { when: { flag: { name: 'lesson3' } }, say: [['Cindrel’s furnaces never go out. The Forge-Queen likes it that way.'], ['Stay close in the Marches. Fire listens to you now. So will people who fear it.']] },
        { say: [['Hold it. Don’t feed it more than it needs.']] },
    ],
    Bram: [
        { when: { flag: { name: 'lesson3' } }, say: [['I slept. Don’t tell Cael I slept.'], ['My dad would’ve wept at that forge. Good weeping.']] },
        { say: [['It’s warm up here. Is it always this warm up here?']] },
    ],
};

const out = { ...scene('forge', 'The Cold Forge', L, S, { region: 'emberwall', mood: 'day', far: 150 }), script };
fs.writeFileSync('scenes/forge.json', JSON.stringify(out, null, 1) + '\n');
console.log(`forge: ${o.length} objects`);
