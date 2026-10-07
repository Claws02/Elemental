// ============================================================
// CHARACTERS — how Aerath's people look (story/Npc.js builds them)
// ============================================================
//
// Every person is the hero's jointed rig in their own colours, plus `extras`
// (story/Npc.js addExtras): what they wear on their head, their face, their
// body, and what they carry. The world bible's rulers and companions, and
// guards and townsfolk for each kingdom.
// ============================================================

const base = { scale: 1, belt: 0x3a2a1a, boot: 0x2e2218, bracer: 0x5a4632 };
const look = (o) => ({ ...base, cloakIn: o.cloak ? shade(o.cloak) : 0x2a2018, ...o });
function shade(c) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return ((r * 0.7) << 16) | ((g * 0.7) << 8) | (b * 0.7); }

export const CHARACTER_LOOKS = {
    // ---- the rulers ----
    maren: look({ scale: 1.04, skin: 0xc49a72, hair: 0x6a4a2a, tunic: 0x4a5e3a, trim: 0xb8a070, cloak: 0x5a4a2e, trouser: 0x4a4234, extras: ['circlet', 'beard'] }),        // Lord-Warden Aldric Maren
    vorn: look({ scale: 1.06, skin: 0xb07a58, hair: 0x2a1a14, tunic: 0x5a2a24, trim: 0x8a8a90, cloak: 0x2a2226, trouser: 0x2e2a2a, bracer: 0x6a6e76, extras: ['ironcrown', 'pauldrons'] }),   // Forge-Queen Talia Vorn
    oriel: look({ scale: 0.98, skin: 0xd8b090, hair: 0x9a7a4a, tunic: 0x2e5a7a, trim: 0xe0d8c0, cloak: 0x3a7a9a, trouser: 0x2e4a5e, extras: ['shellcirclet', 'robe'] }),        // Tide-Regent Oriel Sand
    senn: look({ scale: 1.02, skin: 0xd0a888, hair: 0xe8e4dc, tunic: 0xe8e6e0, trim: 0x7aa8c8, cloak: 0xd8e4ec, trouser: 0xc8ccd0, extras: ['hood', 'robe', 'staff'] }),        // Abbess-Prince Senn
    yessa: look({ scale: 0.95, skin: 0x9a6a48, hair: 0xb8b0a4, tunic: 0xb8803a, trim: 0x8a3a2a, cloak: 0x8a5a2a, trouser: 0x6a4a2a, extras: ['headwrap', 'robe', 'staff'] }),   // Matriarch Yessa Keth
    ilvane: look({ scale: 1.0, skin: 0xd8b49a, hair: 0xc8c4bc, tunic: 0xf0ece4, trim: 0xc8a85a, cloak: 0xe8e0d0, trouser: 0xe0dcd4, extras: ['crown', 'robe'] }),               // Empress Ilvane IV
    corvane: look({ scale: 1.06, skin: 0xc09878, hair: 0x3a3430, tunic: 0x3a3e46, trim: 0xc8a85a, cloak: 0x2a2e36, trouser: 0x2e3036, bracer: 0x8a7a4a, extras: ['badge', 'robe', 'beard'] }),   // High Lantern Corvane
    // ---- the companions ----
    bram: look({ scale: 1.08, skin: 0xc49070, hair: 0x6a4020, tunic: 0x4a6a4a, trim: 0xb8a070, cloak: 0x7a5030, trouser: 0x4a4038, extras: ['apron'] }),                        // Bram Holloway
    isolde: look({ scale: 1.0, skin: 0xe0c0a4, hair: 0x2a2224, tunic: 0x3e4e66, trim: 0xc8a85a, cloak: 0x2e3e56, trouser: 0x2e3440, bracer: 0x6a6e76, extras: ['badge', 'tail'] }),   // Isolde Marr
    kestrel: look({ scale: 0.9, skin: 0xd4a888, hair: 0xd88a3a, tunic: 0xd8e4ec, trim: 0x7aa8c8, cloak: 0x7aa8c8, trouser: 0x8a9aa8, extras: ['goggles', 'scarf'] }),          // Kestrel
    // ---- the Wielder orders ----
    stonebound: look({ scale: 1.05, skin: 0xb4865f, hair: 0x5a4632, tunic: 0x6b5a42, trim: 0xb39a64, cloak: 0x544a3a, trouser: 0x4a4234, bracer: 0x7a6a4a, extras: ['hood', 'robe', 'staff', 'beard'] }),   // a Stonebound warden (Earth; they keep the Oruun ruins)
    // ---- each kingdom's people ----
    verdant_folk: look({ skin: 0xd0a07a, hair: 0x5a3a22, tunic: 0x6a7a44, trim: 0xc9b98a, cloak: 0x6a5a3a, trouser: 0x5a4a38 }),
    verdant_guard: look({ scale: 1.04, skin: 0xb88a66, hair: 0x2a2018, tunic: 0x3e5a34, trim: 0x9aa2aa, cloak: 0x4a6a3a, trouser: 0x3a3a34, bracer: 0x6a6e76, extras: ['helm', 'spear'] }),
    ember_folk: look({ skin: 0xa87858, hair: 0x1e1612, tunic: 0x5a4a3e, trim: 0x8a4a32, cloak: 0x3a2a24, trouser: 0x3a3028, extras: ['apron'] }),
    ember_guard: look({ scale: 1.06, skin: 0xa07050, hair: 0x1e1612, tunic: 0x4a2622, trim: 0x8a8a90, cloak: 0x7a2a20, trouser: 0x2a2626, bracer: 0x5a5e66, extras: ['helm', 'pauldrons', 'spear'] }),
    salt_folk: look({ skin: 0xd8aa86, hair: 0x8a6a3a, tunic: 0x6a8aa0, trim: 0xd8c8a0, cloak: 0x8aa8b8, trouser: 0x6a6a5a, extras: ['scarf'] }),
    salt_guard: look({ scale: 1.02, skin: 0xc49a7a, hair: 0x4a3a2a, tunic: 0x2e4a66, trim: 0xd8d0b8, cloak: 0x3a5a7a, trouser: 0x2e3a48, extras: ['helm', 'spear'] }),
    tidekeeper: look({ skin: 0xc8a080, hair: 0x2a2a2a, tunic: 0x2a6a72, trim: 0xd8e0d0, cloak: 0x1e4e5a, trouser: 0x2a3a40, extras: ['robe', 'staff'] }),     // the Tidekeepers: Saltmere's water Wielders
    sky_folk: look({ skin: 0xdcb498, hair: 0x2a2a2a, tunic: 0xe4e6e8, trim: 0x7aa8c8, cloak: 0xb8ccd8, trouser: 0xa8b4bc, extras: ['hood'] }),
    sky_guard: look({ scale: 1.02, skin: 0xd0a888, hair: 0x2a2a2a, tunic: 0xdcdcdc, trim: 0x5a8ab0, cloak: 0x7aa8c8, trouser: 0x8a96a0, extras: ['hood', 'staff'] }),
    glass_folk: look({ skin: 0x9a6a48, hair: 0x1e1612, tunic: 0xc8a070, trim: 0x8a3a2a, cloak: 0xb8803a, trouser: 0x7a5a3a, extras: ['headwrap'] }),
    glass_guard: look({ scale: 1.04, skin: 0x8a5a3a, hair: 0x1e1612, tunic: 0x8a5a2a, trim: 0x2a4a6a, cloak: 0x6a3a22, trouser: 0x4a3424, extras: ['headwrap', 'spear'] }),
    halcyra_folk: look({ skin: 0xd8b49a, hair: 0x5a3a2a, tunic: 0xe8e2d4, trim: 0xc8a85a, cloak: 0xb8a070, trouser: 0xc8c0b0 }),
    imperial_guard: look({ scale: 1.06, skin: 0xc49a7a, hair: 0x2a2018, tunic: 0xe8e4da, trim: 0xc8a85a, cloak: 0xb8302a, trouser: 0xc8c4bc, bracer: 0xc8a85a, extras: ['plumedhelm', 'pauldrons', 'spear'] }),
    lantern: look({ scale: 1.02, skin: 0xc8a080, hair: 0x2a2224, tunic: 0x3e4e66, trim: 0xc8a85a, cloak: 0x2e3e56, trouser: 0x2e3440, bracer: 0x6a6e76, extras: ['badge', 'helm'] }),     // a Lantern Office officer
};

export const CHARACTER_NAMES = Object.keys(CHARACTER_LOOKS);
