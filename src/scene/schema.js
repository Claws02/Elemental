// ============================================================
// SCENE SCHEMA — what a scene file may contain (docs/SCENES.md)
// ============================================================
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
const BSTYLE = select('Style', 'stone', ['stone', 'timber', 'plaster']);

// Library groups, in the order the editor shows them.
export const GROUPS = ['Ruins', 'Nature', 'Elements', 'Props', 'Puzzle', 'Characters', 'Buildings', 'Ground'];

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
    sealed_door: {
        label: 'Sealed door', group: 'Ruins',
        props: { width: num('Width', 6.4, 1.5, 12, 0.1), height: num('Height', 4.6, 2, 10, 0.1), hidden: HIDDEN },
    },

    // ---- nature ---------------------------------------------------------------
    rock: {
        label: 'Rock', group: 'Nature',
        props: { radius: num('Radius', 0.5, 0.2, 1.5, 0.05), seed: SEED, hidden: HIDDEN },
        note: 'Earth lifts it if its mass (40 × radius³) is within the player\'s Earth Power: 4 at the start, 25 at full.',
    },
    tree: {
        label: 'Tree', group: 'Nature',
        props: { height: num('Height', 5, 2, 12, 0.1), kind: select('Kind', 'oak', ['oak', 'pine', 'dead']), seed: SEED, hidden: HIDDEN },
    },
    hay: { label: 'Hay bundle', group: 'Nature', props: { seed: SEED, hidden: HIDDEN }, signals: ['burning', 'burned'] },

    // ---- elements -----------------------------------------------------------------
    brazier: { label: 'Brazier (fire source)', group: 'Elements', props: { seed: SEED, hidden: HIDDEN } },
    basin: { label: 'Basin (water source)', group: 'Elements', props: { seed: SEED, hidden: HIDDEN } },

    // ---- props ------------------------------------------------------------------------
    crate: { label: 'Crate', group: 'Props', props: { size: num('Size', 0.9, 0.4, 2, 0.05), seed: SEED, hidden: HIDDEN }, signals: ['burning', 'burned', 'moved'] },
    barrel: { label: 'Oil barrel', group: 'Props', props: { seed: SEED, hidden: HIDDEN }, signals: ['burning', 'burned', 'moved'] },
    dummy: { label: 'Training dummy', group: 'Props', props: { seed: SEED, hidden: HIDDEN }, signals: ['burning', 'burned', 'moved'] },
    stall: {
        label: 'Market stall', group: 'Props',
        props: { width: num('Width', 2.4, 1.2, 5, 0.1), awning: select('Awning', 'red', ['red', 'blue', 'green', 'ochre']), seed: SEED, hidden: HIDDEN },
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
        signals: ['intact', 'damaged', 'broken', 'collapsed', 'burned', 'raised'],
        actions: ['raise', 'rebuild'],
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

    // ---- characters -----------------------------------------------------------------------
    spawn: { label: 'Player start', group: 'Characters', props: {}, single: true, note: 'Where the player starts. Turn it to set the way they face.' },
    npc: {
        label: 'Character', group: 'Characters',
        props: { name: text('Name', 'Cael'), look: select('Look', 'cael', ['cael', 'villager', 'elder', 'guard']), hidden: HIDDEN },
        note: 'The script\'s lines are spoken by the character named as its speaker.',
    },

    // ---- buildings (modular kit; prefabs are groups of these) -----------------------------
    b_wall: {
        label: 'Wall', group: 'Buildings',
        props: {
            length: num('Length', 4, 1, 12, 0.5), height: num('Height', 3, 1, 8, 0.1), style: BSTYLE,
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
            pitch: num('Rise', 1.8, 0.3, 6, 0.1), style: select('Style', 'thatch', ['thatch', 'slate', 'shingle']),
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
        props: { length: num('Length', 4, 1, 12, 0.5), height: num('Height', 1.1, 0.5, 2.5, 0.1), seed: SEED, hidden: HIDDEN },
    },
    b_post: {
        label: 'Post', group: 'Buildings',
        props: { height: num('Height', 3, 0.5, 8, 0.1), style: select('Style', 'timber', ['timber', 'stone']), hidden: HIDDEN },
    },
    prefab: {
        label: 'Building', group: 'Buildings',
        props: { prefab: select('Building', 'cottage', ['cottage', 'house', 'smithy', 'tower', 'shed']), style: select('Style', 'prefab', ['prefab', 'stone', 'timber', 'plaster']), seed: SEED },
        note: 'A ready-made building. "Break apart" turns it into its walls, floors and roof to change one by one.',
    },

    // ---- ground --------------------------------------------------------------------------
    patch: {
        label: 'Ground patch', group: 'Ground',
        props: { width: num('Width', 6, 0.5, 80, 0.5), depth: num('Depth', 6, 0.5, 80, 0.5), style: select('Style', 'grass', ['grass', 'dirt', 'cobble', 'sand', 'flagstone']), round: bool('Round', false) },
        note: 'A flat surface laid on the ground: paths, lawns, a market square.',
    },
};

// Ground styles for the scene's base floor.
export const GROUND_STYLES = ['flagstone', 'grass', 'dirt', 'cobble', 'sand'];
export const PROFILES = ['story', 'sandbox'];

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
};

export const ELEMENTS = ['earth', 'fire', 'water', 'air'];
export const TRACKS = ['power', 'control'];

// Reactions: the script's speaker answers things the player does, any time.
export const REACTION_EVENTS = {
    playerFire: 'The player starts a fire',
    tooHeavy:   'The player tries to lift a stone too heavy for them',
    playerBreak: 'The player breaks a piece of something',
    playerThrow: 'The player throws something',
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
        settings: { ground: { half: 20, style: 'grass' }, profile: 'sandbox', resetProgress: false },
        objects: [{ id: 'Spawn', type: 'spawn', x: 0, y: 0, z: 6, rotY: Math.PI }],
        wires: [],
        script: null,
    };
}
