// ============================================================
// PALETTE — the visual language of Aerath
// ============================================================
//
// Stylized high fantasy. The technique is Hundred Block Dash's (vertex
// colour, bevels, detail that stands proud of the surface) but the palette is
// not: HBD is saturated toy-town, and a story about killing your friend needs
// an older, quieter world. Surfaces are muted and weathered; saturation is
// reserved for the elements, so when the player uses one it is the brightest
// thing on screen.
//
// Every element owns one hue family, used everywhere that element appears:
// runes, highlights, the hero's belt stone, VFX, UI. A player should be able
// to tell which element is active from colour alone.
// ============================================================

export const ELEMENT = {
    earth: { key: 'earth', name: 'Earth', rune: 0xffb347, deep: 0x8a5a1f, light: 0xffd9a0 },
    water: { key: 'water', name: 'Water', rune: 0x4fd6ff, deep: 0x1d5f8a, light: 0xb8f0ff },
    fire:  { key: 'fire',  name: 'Fire',  rune: 0xff5a2a, deep: 0x8a1f0f, light: 0xffc49a },
    air:   { key: 'air',   name: 'Air',   rune: 0xd8f5e8, deep: 0x6e9c8c, light: 0xffffff },
};

// Weathered stone, old timber, moss: the world before the player touches it.
export const WORLD = {
    stone:      [0x8f8a80, 0x9a948a, 0x847f76, 0xa39d92],
    stoneDark:  0x5e5a54,
    stoneTop:   0xb0aa9e,
    flag:       [0x6e685e, 0x77705f, 0x635e55, 0x7c7466, 0x5f5a51],
    moss:       [0x5d7a3f, 0x6b8a47, 0x4f6b36],
    timber:     [0x7a5a3a, 0x6e4f33, 0x86653f],
    timberDark: 0x4a3524,
    iron:       0x3c3f44,
    rock:       [0x7b7468, 0x857d70, 0x6f685d, 0x8e877a],
    soil:       0x5a4a38,
    grass:      [0x5f7d3c, 0x6a8a44, 0x55723a],
};

// The protagonist's default look. Character creation (§5) replaces these.
export const HERO = {
    skin:   0xc99a74,
    hair:   0x3a2a1e,
    tunic:  0x3f5a6e,
    trim:   0xc8b27a,
    cloak:  0x6b3a2e,
    cloakIn:0x4a2620,
    belt:   0x4a3524,
    trouser:0x4b4538,
    boot:   0x3a2a1e,
    bracer: 0x5e4630,
};
