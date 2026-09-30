// ============================================================
// LOOKS — the character creator's choices (art/Palette.js HERO keys)
// ============================================================
//
// Physical only (the brief): skin, hair, clothes. Who the protagonist is
// comes from what the player does, not from a menu.
// ============================================================

export const CREATOR = {
    skin:   [0xf1c7a3, 0xd9a37e, 0xc99a74, 0xa87050, 0x7d4e33, 0x5a3624],
    hair:   [0x2a1c14, 0x3a2a1e, 0x6a4020, 0x9a5a2a, 0xc9a45a, 0xd8d4cc, 0x1c1c22],
    tunic:  [0x3f5a6e, 0x5a6e3f, 0x6e3f3f, 0x6e5a3f, 0x4a3f6e, 0x3a3a3a],
    cloak:  [0x6b3a2e, 0x2c4a3a, 0x2e3a6b, 0x5a4a30, 0x4a2a4a, 0x7a6a50],
};

/** A full HERO look from the creator's picks. */
export function lookFrom(p) {
    const darker = (c, k) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k); };
    return { skin: p.skin, hair: p.hair, tunic: p.tunic, cloak: p.cloak, cloakIn: darker(p.cloak, 0.7) };
}
