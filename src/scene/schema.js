// ============================================================
// SCENE SCHEMA — what a scene file may contain (docs/SCENES.md)
// ============================================================

import { TREE_KINDS, PLANT_KINDS, BOULDER_KINDS } from '../data/nature.js';
import { CHARACTER_NAMES } from '../data/characters.js';
//
// Pure data, no three.js: the game's loader, the scene validator (node) and
// Elemental-Editor's inspector all read this one file, so an object's
// properties are declared once.
//
// A scene is JSON:
//
//   { format: 1, id, name,
//     settings: { ground: { half, style }, profile, resetProgress },
//     objects:  [ { id, type, x, y, z, rotY, ...props } ],
//     wires:    [ { id, mode, inputs: [{ obj, signal }], do: [action] } ],
//     script:   null | { speaker, face, flags, reactions, steps, card } }
//
// Each TYPE lists its props (field specs the inspector draws), the SIGNALS it
// can raise (read by wires and script conditions) and the ACTIONS it can take
// (called by wires and the script).
//
// Field kinds: number {min,max,step} · int · bool · select {options} · text ·
// ref {types}: another object's id.
// ============================================================

export const FORMAT = 1;

const num = (label, def, min, max, step = 0.05) => ({ kind: 'number', label, default: def, min, max, step });
const int = (label, def, min = 0, max = 9999) => ({ kind: 'int', label, default: def, min, max });
const bool = (label, def = false) => ({ kind: 'bool', label, default: def });
const select = (label, def, options) => ({ kind: 'select', label, default: def, options });
const text = (label, def = '') => ({ kind: 'text', label, default: def });
const ref = (label, types) => ({ kind: 'ref', label, default: '', types });

const SEED = int('Variant', 1, 0, 9999);
const HIDDEN = bool('Starts hidden', false);
// Every prefab building (data/prefabs.js), by name: kept in step by qa/unit.mjs.
const PREFAB_NAMES = ['cottage', 'house', 'smithy', 'tower', 'thornwick_hall', 'cindrel_house', 'cindrel_forge', 'forge_hall', 'lanthe_stilthouse', 'lanthe_council', 'vaelmont_cell', 'vaelmont_temple', 'sarn_house', 'sarn_matriarch', 'halcyra_villa', 'imperial_palace', 'shed'];
const WALL_STYLES = ['stone', 'timber', 'plaster', 'brick', 'basalt', 'whitestone', 'marble', 'adobe', 'driftwood'];
const ROOF_STYLES = ['thatch', 'slate', 'shingle', 'tile', 'copper', 'flat', 'dome', 'canvas'];
const BSTYLE = select('Style', 'stone', WALL_STYLES);

// Library groups, in the order the editor shows them.
export const GROUPS = ['Ruins', 'Nature', 'Elements', 'Props', 'Puzzle', 'Creatures', 'Characters', 'Buildings', 'Ground', 'Travel'];

export const TYPES = {
    // ---- ruins --------------------------------------------------------------
    ruin_wall: {
        label: 'Ruined wall', group: 'Ruins',
        props: { length: num('Length', 12, 1, 40, 0.5), height: num('Height', 3, 0.6, 8, 0.1), seed: SEED, runes: bool('Earth runes', true), hidden: HIDDEN },
    },
    pillar: {
        label: 'Pillar', group: 'Ruins',
        props: { height: num('Height', 5.2, 1, 10, 0.1), broken: bool('Broken', false), seed: SEED, hidden: HIDDEN },
    },
    drum: { label: 'Fallen drum', group: 'Ruins', props: { seed: SEED, hidden: HIDDEN } },
    archway: {
        label: 'Archway', group: 'Ruins',
        props: { width: num('Opening', 5, 1.5, 12, 0.1), height: num('Height', 4.2, 2, 10, 0.1), hidden: HIDDEN },
    },
    waterwheel: {
        label: 'Waterwheel', group: 'Buildings',
        props: { y: num('Axle height (absolute)', 6, -10, 60, 0.1), radius: num('Radius', 2.2, 0.8, 5, 0.1), width: num('Width', 1, 0.4, 3, 0.1), turning: bool('Turning', true), driven: bool('Driven: turns only while a stream plays on it', false), owner: select('Belongs to', 'civilian', ['none', 'civilian', 'empire']) },
        signals: ['turning', 'stopped', 'wrecked', 'spun'],
        actions: ['start', 'stop', 'wreck'],
        note: 'Its y is the axle\'s height, not a height above the ground: set it so the paddles dip in the water.',
    },
    standing_stone: {
        label: 'Standing stone', group: 'Ruins',
        props: { height: num('Height', 3.2, 1.5, 6, 0.1), cracked: bool('Starts cracked', false), chiselled: bool('Cracked on purpose (chisel marks)', false), seed: SEED, hidden: HIDDEN },
        signals: ['cracked', 'touched'],
        actions: ['crack'],
        note: 'An Oruun marker: a seal. It cracks at the awakening (and stays cracked in a scene that remembers).',
    },
    sealed_door: {
        label: 'Sealed door', group: 'Ruins',
        props: { width: num('Width', 6.4, 1.5, 12, 0.1), height: num('Height', 4.6, 2, 10, 0.1), hidden: HIDDEN },
    },

    // ---- nature ---------------------------------------------------------------
    rock_pile: {
        label: 'Rock pile (refills)', group: 'Puzzle',
        props: { count: int('Loose stones on it', 4, 1, 8), radius: num('Stone radius', 0.42, 0.25, 0.7, 0.01), seed: SEED },
        signals: ['stocked'],
        note: 'A practice pile: a thrown stone crumbles a few seconds after it lands, and a fresh one rises in the pile.',
    },
    rock: {
        label: 'Rock', group: 'Nature',
        props: { radius: num('Radius', 0.5, 0.2, 1.5, 0.05), seed: SEED, hidden: HIDDEN },
        signals: ['moved', 'visible'],
        note: 'Moved: carried more than 2.5 m from where it lay. Earth lifts it if its mass (40 × radius³) is within the player\'s Earth Power: 4 at the start, 25 at full.',
    },
    tree: {
        label: 'Tree', group: 'Nature',
        props: { height: num('Height', 5, 2, 24, 0.1), kind: select('Kind', 'oak', TREE_KINDS), seed: SEED, hidden: HIDDEN },
        note: 'Every climate: oak, pine, birch, willow and giant (the Reach); charred (Emberwall); palm and cypress (the coast); fir and juniper (Skyreach); glassbloom (the Expanse); dead.',
    },
    plant: {
        label: 'Plant', group: 'Nature',
        props: { kind: select('Kind', 'bush', PLANT_KINDS), size: num('Size', 1, 0.3, 4, 0.1), seed: SEED },
        note: 'Undergrowth you walk through: bushes, ferns, reeds, flowers, grass, mushrooms, heather, dune grass, thornscrub, ember-blooms, driftwood, crystal, salt crust, snow tufts.',
    },
    boulder: {
        label: 'Boulder (scenery)', group: 'Nature',
        props: { kind: select('Kind', 'crag', BOULDER_KINDS), size: num('Size', 2, 0.5, 10, 0.1), seed: SEED },
        note: 'Fixed stone: crags, mossy and snowy boulders, basalt columns, obsidian, lava rock, sea stacks, glass spires, salt pillars, glass shards. Too big for Earth to lift (a rock is what Earth lifts).',
    },
    hay: { label: 'Hay bundle', group: 'Nature', props: { seed: SEED, hidden: HIDDEN }, signals: ['burning', 'burned'] },

    // ---- elements -----------------------------------------------------------------
    brazier: { label: 'Brazier (fire source)', group: 'Elements', props: { seed: SEED, hidden: HIDDEN } },
    basin: { label: 'Basin (water source)', group: 'Elements', props: { seed: SEED, hidden: HIDDEN } },

    // ---- props ------------------------------------------------------------------------
    crate: { label: 'Crate', group: 'Props', props: { size: num('Size', 0.9, 0.4, 2, 0.05), seed: SEED, hidden: HIDDEN }, signals: ['burning', 'burned', 'moved'] },
    barrel: { label: 'Oil barrel', group: 'Props', props: { seed: SEED, hidden: HIDDEN }, signals: ['burning', 'burned', 'moved'] },
    dummy: { label: 'Training dummy', group: 'Props', props: { seed: SEED, practice: bool('Practice: stands back up; counts hits', false), hidden: HIDDEN }, signals: ['burning', 'burned', 'moved', 'hit', 'down'],
        note: 'A practice dummy stands back up a few seconds after it falls; "hit" = knocked down by your throw at least once.' },
    stall: {
        label: 'Market stall', group: 'Props',
        props: { width: num('Width', 2.4, 1.2, 5, 0.1), awning: select('Awning', 'red', ['red', 'blue', 'green', 'ochre']), seed: SEED, hidden: HIDDEN },
        signals: ['intact', 'damaged', 'burning', 'burned', 'collapsed', 'visible'],
    },

    // ---- puzzle -----------------------------------------------------------------------
    barricade: {
        label: 'Timber barricade', group: 'Puzzle',
        props: {
            cols: int('Panels across', 6, 1, 12), rows: int('Panels high', 3, 1, 6),
            posts: bool('End posts', true),
            regenAfter: num('Rebuilds after (s, 0 = never)', 0, 0, 600, 5),
            hidden: HIDDEN,
        },
        signals: ['intact', 'damaged', 'broken', 'collapsed', 'burned', 'raised', 'sunk'],
        actions: ['raise', 'sink', 'rebuild'],
    },
    gate: {
        label: 'Portcullis gate', group: 'Puzzle',
        props: { width: num('Width', 4, 1, 10, 0.1), height: num('Height', 3.6, 1.5, 8, 0.1), open: bool('Starts open', false), hidden: HIDDEN },
        signals: ['open', 'closed'],
        actions: ['open', 'close', 'toggle'],
    },
    plate: {
        label: 'Pressure plate', group: 'Puzzle',
        props: {
            radius: num('Radius', 0.75, 0.4, 2, 0.05),
            height: num('Height (1.5 = eye level)', 0.15, 0.15, 3, 0.05),
            gentleHeight: num('Gentle within (m)', 0.6, 0.1, 3, 0.05),
            chainTo: ref('Chain runs to', ['barricade', 'gate']),
            hidden: HIDDEN,
        },
        signals: ['weighted', 'gentle', 'empty'],
        actions: ['hintOn', 'hintOff'],
    },
    trigger: {
        label: 'Trigger zone', group: 'Puzzle',
        props: { width: num('Width', 3, 0.5, 40, 0.1), depth: num('Depth', 3, 0.5, 40, 0.1), height: num('Height', 3, 0.5, 20, 0.1) },
        signals: ['entered', 'inside'],
        note: 'Invisible in the game. "entered" stays true once the player has been inside.',
    },

    // ---- creatures -----------------------------------------------------------------------
    creature: {
        label: 'Creatures', group: 'Creatures',
        props: {
            species: select('Species', 'thornhound', ['emberwing', 'bristleback', 'thornhound', 'shellback', 'cindermite', 'mudling', 'brinecoil', 'galekite', 'frostmaw', 'glasswight', 'sentinel', 'wellspawn', 'stonebound']),
            count: int('How many', 3, 1, 12), spread: num('Spread (m)', 3, 0, 30, 0.5),
            aggressive: bool('Attacks on sight', true), elite: bool('One is an elite', false), embers: bool('Emberwings drop embers', true),
            fragile: bool('Fragile: any hit kills (a first fight)', false), vent: bool('Pours from a vent until it is blocked (Cindermites)', false), damage: num('Damage they do (×)', 1, 0, 3, 0.05),
            tier: select('Appears from tier (kind: its species’; always: the story needs them)', 'kind', ['kind', 'always', '1', '2', '3', '4']), hidden: HIDDEN,
        },
        signals: ['gone', 'engaged', 'visible', 'yielded'],
        actions: ['release', 'hold', 'yieldAll'],
        note: 'A group. Hidden, it arrives when revealed (or released). "gone" = every one of them dead or driven off. Wielders (Stonebound) yield instead of dying: "yielded" = every one not held has yielded; "hold" has the speaker hold one off; "yieldAll" ends it.',
    },

    // ---- characters -----------------------------------------------------------------------
    spawn: {
        label: 'Player start', group: 'Characters',
        props: { name: text('Name', 'start') },
        note: 'Where the player arrives. "start" is where a scene begins; other names are arrival points for exits from other scenes. Turn it to set the way they face.',
    },
    npc: {
        label: 'Character', group: 'Characters',
        props: { name: text('Name', 'Cael'), look: select('Look', 'cael', ['cael', 'villager', 'elder', 'guard', 'smith', 'baker', 'youth', ...CHARACTER_NAMES]), role: select('Does', 'idle', ['idle', 'brigade', 'cower', 'patrol', 'follow', 'lead']), route: text('Patrol route (x,z; x,z; …)', ''), home: ref('Lives in (else the nearest house)', ['timber_house', 'prefab', 'tent']), hidden: HIDDEN },
        note: 'The script\'s lines are spoken by the character named as its speaker. Tap a character in play to talk: they answer from what the world remembers (data/talk.js), or from the script\'s talk lines for them.',
    },

    // ---- buildings (modular kit; prefabs are groups of these) -----------------------------
    timber_house: {
        label: 'Timber house (burns)', group: 'Buildings',
        props: {
            kind: select('Kind', 'house', ['house', 'barn']),
            cols: int('Front, in panels (1 m)', 5, 2, 10), depth: int('Side, in panels (1 m)', 4, 2, 10), rows: int('Height, in panels', 3, 2, 4),
            seed: SEED, hidden: HIDDEN,
        },
        signals: ['intact', 'damaged', 'burning', 'burned', 'open'],
        actions: ['open', 'close'],
        note: 'A village house or barn built to burn, with a door you tap to open (an empty room inside): timber walls that break panel by panel and a thatch roof that falls in. Half burned is "burned", and a scene that remembers keeps it a charred frame.',
    },
    b_wall: {
        label: 'Wall', group: 'Buildings',
        props: {
            length: num('Length', 4, 1, 30, 0.5), height: num('Height', 3, 1, 8, 0.1), style: BSTYLE,
            opening: select('Opening', 'none', ['none', 'door', 'window', 'two windows', 'arch']),
            seed: SEED, hidden: HIDDEN,
        },
        note: 'Runs along its local X; the front faces +Z (the gold handle).',
    },
    b_floor: {
        label: 'Floor', group: 'Buildings',
        props: { width: num('Width', 4, 1, 20, 0.5), depth: num('Depth', 4, 1, 20, 0.5), style: select('Style', 'planks', ['planks', 'stone', 'packed earth']), hidden: HIDDEN },
    },
    b_roof: {
        label: 'Roof', group: 'Buildings',
        props: {
            width: num('Width (along ridge)', 4, 1, 20, 0.5), depth: num('Depth', 4, 1, 20, 0.5),
            pitch: num('Rise', 1.8, 0.3, 6, 0.1), style: select('Style', 'thatch', ROOF_STYLES),
            gables: bool('Gable ends', true), hidden: HIDDEN,
        },
        note: 'Place it at the top of the walls (its Y).',
    },
    b_stairs: {
        label: 'Stairs', group: 'Buildings',
        props: { width: num('Width', 1.2, 0.6, 4, 0.1), rise: num('Rise', 3, 0.5, 8, 0.1), style: select('Style', 'stone', ['stone', 'timber']), hidden: HIDDEN },
    },
    b_fence: {
        label: 'Fence', group: 'Buildings',
        props: { length: num('Length', 4, 1, 30, 0.5), height: num('Height', 1.1, 0.5, 2.5, 0.1), seed: SEED, hidden: HIDDEN },
    },
    b_post: {
        label: 'Post', group: 'Buildings',
        props: { height: num('Height', 3, 0.5, 8, 0.1), style: select('Style', 'timber', ['timber', 'stone']), hidden: HIDDEN },
    },
    tower: {
        label: 'Round tower', group: 'Buildings',
        props: { height: num('Height', 9, 3, 30, 0.5), radius: num('Radius', 2.2, 1, 6, 0.1), style: BSTYLE, top: select('Top', 'cone', ['cone', 'dome', 'crenels']), seed: SEED, hidden: HIDDEN },
    },
    bridge: {
        label: 'Bridge', group: 'Buildings',
        props: { length: num('Length', 14, 4, 60, 0.5), width: num('Width', 3, 1.2, 10, 0.1), rise: num('Arch rise (rope: sag)', 1.2, 0, 6, 0.1), drop: num('Far end higher by (m)', 0, -15, 15, 0.1), style: select('Style', 'stone', ['stone', 'whitestone', 'marble', 'plank', 'rope']), seed: SEED, hidden: HIDDEN },
        note: 'Spans along its length (x) between two banks; each end sits at the bank (the far end `drop` higher). The deck and rails are solid.',
    },
    dock: {
        label: 'Dock', group: 'Buildings',
        props: { length: num('Length', 10, 2, 40, 0.5), width: num('Width', 3, 1, 8, 0.1), height: num('Deck height', 1.2, 0.3, 8, 0.1), seed: SEED, hidden: HIDDEN },
        signals: ['intact', 'damaged', 'burning', 'burned', 'collapsed', 'visible'],
        actions: ['wreck'],
    },
    town_wall: {
        label: 'Town wall', group: 'Buildings',
        props: { length: num('Length', 10, 2, 40, 0.5), height: num('Height', 5, 2, 14, 0.5), style: BSTYLE, seed: SEED, hidden: HIDDEN },
    },
    gatehouse: {
        label: 'Gatehouse', group: 'Buildings',
        props: { width: num('Gate width', 5, 2, 12, 0.5), height: num('Height', 7, 4, 16, 0.5), style: BSTYLE, seed: SEED, hidden: HIDDEN },
    },
    tent: {
        label: 'Tent', group: 'Buildings',
        props: { size: num('Size', 4, 2, 12, 0.5), colour: select('Colour', 'red', ['red', 'blue', 'ochre', 'green']), seed: SEED, hidden: HIDDEN },
        signals: ['intact', 'damaged', 'burning', 'burned', 'collapsed', 'visible'],
    },
    chimney: { label: 'Forge chimney', group: 'Buildings', props: { height: num('Height', 6, 1, 16, 0.5), seed: SEED, hidden: HIDDEN } },
    lamp: { label: 'Lamp post', group: 'Props', props: { height: num('Height', 3.2, 2, 6, 0.1), hidden: HIDDEN } },
    banner: { label: 'Banner', group: 'Props', props: { height: num('Height', 5, 2, 12, 0.5), colour: select('Colour', 'green', ['green', 'red', 'blue', 'white', 'gold', 'ochre', 'sky']), seed: SEED, hidden: HIDDEN } },
    statue: { label: 'Statue (Oruun)', group: 'Ruins', props: { height: num('Height', 4, 2, 14, 0.5), style: BSTYLE, seed: SEED, hidden: HIDDEN } },
    fountain: { label: 'Fountain', group: 'Props', props: { radius: num('Radius', 2.5, 1, 6, 0.1), style: BSTYLE, seed: SEED, hidden: HIDDEN } },
    prefab: {
        label: 'Building', group: 'Buildings',
        props: { prefab: select('Building', 'cottage', PREFAB_NAMES), style: select('Style', 'prefab', ['prefab', ...WALL_STYLES]), seed: SEED },
        note: 'A ready-made building. "Break apart" turns it into its walls, floors and roof to change one by one.',
    },

    // ---- travel ----------------------------------------------------------------------
    exit: {
        label: 'Exit to another scene', group: 'Travel',
        props: {
            to: text('Goes to scene', ''), at: text('Arrives at start point', 'start'), label: text('Shown as', ''),
            width: num('Width', 4, 0.5, 40, 0.1), depth: num('Depth', 2, 0.5, 40, 0.1), height: num('Height', 3, 0.5, 20, 0.1),
        },
        note: 'Walk into it to travel. The game saves a checkpoint on arrival.',
    },

    // ---- ground --------------------------------------------------------------------------
    water: {
        label: 'Water (lake, river, sea)', group: 'Ground',
        props: { kind: select('Kind', 'water', ['water', 'lava']), width: num('Width', 30, 2, 400, 1), depth: num('Depth', 20, 2, 400, 1), round: bool('Round (an ellipse)', false), level: num('Level (m)', 0, -40, 80, 0.1) },
        signals: ['drawn'],
        note: 'A sheet of water at an absolute level: where the ground is lower, there is water. A stream draws from it ("drawn" while one does); shallow water slows you, deep water is swum; a frozen stream leaves ice you can stand on.',
    },
    patch: {
        label: 'Ground patch', group: 'Ground',
        props: { width: num('Width', 6, 0.5, 80, 0.5), depth: num('Depth', 6, 0.5, 80, 0.5), style: select('Style', 'grass', ['grass', 'dirt', 'cobble', 'sand', 'flagstone']), round: bool('Round', false) },
        note: 'A flat surface laid on the ground: paths, lawns, a market square.',
    },
};

// Every type can be made to exist only in some world states (a rebuilt barn,
// a forest after the Earth seal opens): `showWhen` is a list of conditions
// separated by commas, all of which must hold when the scene loads:
//   flagName          a story flag is set (truthy)
//   !flagName         it isn't
//   flagName=value    a flag equals a value
//   state:ObjectId=v  a remembered world state (burned, Collapsed, revealed…)
// Things someone owns (`owner`) count against the player when harmed (Ledger).
const OWNED = ['timber_house', 'barricade', 'gate', 'crate', 'barrel', 'hay', 'stall', 'brazier', 'basin', 'b_wall', 'b_floor', 'b_roof', 'b_stairs', 'b_fence', 'b_post', 'prefab', 'tree', 'tent', 'dock', 'bridge'];
const LIVED_IN = ['prefab', 'tent', 'dock'];       // someone's home or living: theirs unless the scene says otherwise
for (const [type, t] of Object.entries(TYPES)) {
    if (OWNED.includes(type)) t.props.owner = select('Belongs to', LIVED_IN.includes(type) ? 'civilian' : 'none', ['none', 'civilian', 'empire']);
    // A landmark (a ruler's hall, the palace): bringing it down weighs on that kingdom far more, and is remembered.
    if (type === 'prefab') t.props.landmark = bool('A landmark (heavy consequences)', false);
    t.props.showWhen = text('Only when', '');
}

// Ground styles for the scene's base floor.
export const GROUND_STYLES = ['flagstone', 'grass', 'dirt', 'cobble', 'sand'];
export const PROFILES = ['story', 'sandbox'];
/** The light a scene can open in (src/engine/Renderer.js MOODS). */
export const MOOD_NAMES = ['day', 'dusk', 'night', 'ember', 'sea', 'peaks', 'glare'];
export const REGION_NAMES = { verdant: 'Verdant Reach', emberwall: 'Emberwall Marches', saltmere: 'Saltmere Coast', skyreach: 'Skyreach Heights', glass: 'The Glass Expanse', capital: 'Halcyra' };

// ---- the script: steps, conditions and actions ------------------------------------------

// Conditions. Each is an object with ONE key (plus nested args):
export const CONDITIONS = {
    talking:  { label: 'The speaker is talking', arg: 'bool' },
    time:     { label: 'Seconds in this step ≥', arg: 'number' },
    held:     { label: 'Holding', arg: 'ref' },
    heldFor:  { label: 'Held steady for', arg: { obj: 'ref', secs: 'number' } },
    signal:   { label: 'Object signal', arg: { obj: 'ref', name: 'signal' } },
    wire:     { label: 'Wire is live', arg: 'wire' },
    broken:   { label: 'Pieces broken ≥', arg: { obj: 'ref', min: 'int' } },
    burned:   { label: 'Pieces burned ≥', arg: { obj: 'ref', min: 'int' } },
    burning:  { label: 'Anything is burning', arg: 'bool' },
    count:    { label: 'Counter ≥', arg: { name: 'text', min: 'int' } },
    flag:     { label: 'Saved flag', arg: { name: 'text', is: 'text' } },
    state:    { label: 'World state', arg: { id: 'ref', is: 'text' } },
    ledger:   { label: 'The ledger', arg: { tally: 'tally', min: 'number' } },
    standing: { label: 'How a kingdom sees you', arg: { region: 'region', atLeast: 'int' } },
    many:     { label: 'How many objects give a signal', arg: { prefix: 'text', type: 'text', signal: 'text', min: 'int', max: 'int' } },
    all:      { label: 'All of', arg: 'list' },
    any:      { label: 'Any of', arg: 'list' },
    not:      { label: 'Not', arg: 'cond' },
};

// Actions. Each is an object with ONE key.
export const ACTIONS = {
    say:      { label: 'Say lines', arg: 'lines' },
    do:       { label: 'Object action', arg: { obj: 'ref', action: 'action' } },
    reveal:   { label: 'Reveal (rise)', arg: 'refs' },
    hide:     { label: 'Hide', arg: 'refs' },
    grant:    { label: 'Grow an element', arg: { el: 'element', track: 'track', amount: 'number' } },
    flag:     { label: 'Add to a flag', arg: { name: 'text', add: 'number' } },
    count:    { label: 'Add to a counter', arg: { name: 'text', add: 'int' } },
    saveFlag: { label: 'Save the outcome as', arg: 'text' },
    card:     { label: 'Show the end card', arg: 'bool' },
    setElement: { label: 'Set an element', arg: { el: 'element', state: 'elstate' } },
    mood:     { label: 'Change the light', arg: { name: 'mood', secs: 'number' } },
    douseAll: { label: 'Put out every fire', arg: { by: 'text' } },
    hint:     { label: 'Show a tip', arg: 'text' },
    npc:      { label: 'Give a character a job', arg: { id: 'ref', role: 'role', route: 'text', at: 'point' } },
    ignite:   { label: 'Set alight (whatever starts with prefix)', arg: { prefix: 'text' } },
    water:    { label: 'Change a water level', arg: { prefix: 'text', level: 'number', secs: 'number' } },
    protect:  { label: 'Protect the player (health floor)', arg: 'number' },
    flameSpill: { label: 'The flame spills onto…', arg: { target: 'ref', radius: 'number', after: 'number' } },
    surge:    { label: 'A surge of wild power', arg: { el: 'element', target: 'ref', cause: 'text' } },
    checkpoint: { label: 'Checkpoint (save)', arg: 'bool' },
    travel:   { label: 'Travel to a scene', arg: { scene: 'text', at: 'text' } },
    setFlag:  { label: 'Set a saved flag', arg: { name: 'text', value: 'text' } },
    setState: { label: 'Set a world state', arg: { id: 'ref', value: 'text' } },
    ledger:   { label: 'Add to the ledger', arg: { tally: 'tally', add: 'number' } },
};

export const ELEMENTS = ['earth', 'fire', 'water', 'air'];
export const TRACKS = ['power', 'control'];
export const TALLIES = ['harm', 'care', 'excess', 'spared', 'killed'];

// Reactions: the script's speaker answers things the player does, any time.
export const REACTION_EVENTS = {
    playerFire: 'The player starts a fire',
    tooHeavy:   'The player tries to lift a stone too heavy for them',
    playerBreak: 'The player breaks a piece of something',
    playerThrow: 'The player throws something',
    playerSurge: 'The player\'s wild power goes off on its own',
    targetDown: 'The player knocks down a practice dummy (the first time for each)',
    earthPulled: 'The player pulls a stone up out of the ground',
    earthRaised: 'The player raises a column of earth',
    stoneCaught: 'The player catches a stone thrown at them',
    pulledThrow: 'The player throws a stone they pulled from the ground, or caught',
};

/** A new object of `type` with every prop at its default. */
export function defaults(type) {
    const t = TYPES[type];
    if (!t) throw new Error(`unknown type "${type}"`);
    const o = {};
    for (const [k, f] of Object.entries(t.props)) o[k] = f.default;
    return o;
}

export function signalsOf(type) {
    const t = TYPES[type];
    return t?.signals || (t?.props?.hidden ? ['visible'] : []);
}
export function actionsOf(type) { return TYPES[type]?.actions || []; }

export function emptyScene(id = 'untitled', name = 'Untitled scene') {
    return {
        format: FORMAT, id, name,
        settings: { ground: { half: 20, style: 'grass' }, profile: 'sandbox', resetProgress: false, region: 'verdant', persistent: false },
        objects: [{ id: 'Spawn', type: 'spawn', x: 0, y: 0, z: 6, rotY: Math.PI, name: 'start' }],
        wires: [],
        script: null,
    };
}
