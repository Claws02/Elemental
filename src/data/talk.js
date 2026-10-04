// ============================================================
// TALK — what people say when the player taps them (story/Talk.js)
// ============================================================
//
// An entry: { when?, say }. `when` is a story condition (src/scene/schema.js
// CONDITIONS); `say` is the lines said together, or a list of such lists
// said in turn, one each time you talk to them. The first entry whose
// `when` holds is the one said.
//
//   NAMED     a character by their scene id, wherever they stand
//   FOLK      a kingdom's townsfolk and guards, by how the kingdom sees you
//             (Ledger.standing: low 0–1, mid 2, high 3–4)
//   HOME      anyone, about their own house (Talk.homeOf): what you did to it
//
// A scene's script can add its own: script.talk = { <npc id>: [entry, …] },
// said before anything here.
// ============================================================

/** Who a look is: their kingdom's folk or guard. The Veyra villagers are the Reach's folk. */
export const GROUPS = {
    verdant_folk: ['verdant', 'folk'], verdant_guard: ['verdant', 'guard'], youth: ['verdant', 'folk'], smith: ['verdant', 'folk'], baker: ['verdant', 'folk'], elder: ['verdant', 'folk'], villager: ['verdant', 'folk'],
    ember_folk: ['emberwall', 'folk'], ember_guard: ['emberwall', 'guard'],
    salt_folk: ['saltmere', 'folk'], salt_guard: ['saltmere', 'guard'],
    sky_folk: ['skyreach', 'folk'], sky_guard: ['skyreach', 'guard'],
    glass_folk: ['glass', 'folk'], glass_guard: ['glass', 'guard'],
    stonebound: ['verdant', 'guard'],
    halcyra_folk: ['capital', 'folk'], imperial_guard: ['capital', 'guard'], lantern: ['capital', 'guard'],
};

/** What to call someone with no name of their own. */
export const NAMELESS = {
    verdant: { folk: 'Reach villager', guard: 'Warden’s guard' },
    emberwall: { folk: 'Forge-hand', guard: 'Ember Guard' },
    saltmere: { folk: 'Saltmere fisher', guard: 'Tide watch' },
    skyreach: { folk: 'Vaelmont pilgrim', guard: 'Skyborne warden' },
    glass: { folk: 'Sarn trader', guard: 'Glass rider' },
    capital: { folk: 'Halcyran', guard: 'Imperial guard' },
};

// ---- townsfolk and guards ------------------------------------------------------------------------------------------
// [low, mid, high]: each a list of things one person might say.
export const FOLK = {
    verdant: {
        folk: [
            [['Keep walking. We’ve buried enough this season.'], ['They say you burn what you touch. Don’t touch anything of mine.'], ['My sister lost her barn to a fire nobody lit. Nobody but you.']],
            [['Rain’s late. The river’s low enough to ford, if you don’t mind wet boots.'], ['The Lord-Warden keeps the roads. The roads keep the Reach. That’s the saying.'], ['Strangers come through for the market. You don’t look like you’re here to buy.'], ['Old stones in the hills. My grandfather said they used to sing. I’ve never heard it.']],
            [['You’re the one who put out the mill fire. Have an apple. Have two.'], ['My youngest wants to be a Wielder now. Thanks for that.'], ['If you need a bed in Thornwick, knock on any door. Mine first.']],
        ],
        guard: [
            [['The Lord-Warden has your description. Don’t make me use it.'], ['One wrong move and I ring the bell.']],
            [['Roads are safe as far as the ford. After that, mind the wolves.'], ['Keep your hands where I can see them. Nothing personal. I say it to everyone.']],
            [['Lord-Warden says you’re to be let through anywhere. First time he’s said that.'], ['Go on through. And thank you.']],
        ],
    },
    emberwall: {
        folk: [
            [['Fire’s our trade. Yours isn’t fire. Yours is ruin.'], ['The Queen’s furnaces don’t need your help.']],
            [['Mind the slag. It stays hot for days.'], ['Every blade in the Marches is quenched in the same river. Water from the north. Steel from us.'], ['The Ember Guard keep the fires honest. Nobody keeps the Guard honest.']],
            [['You walked into a burning forge and walked out with the smith. People here don’t forget that.'], ['Queen Vorn asked about you. Asked nicely, too.']],
        ],
        guard: [
            [['The Ember Guard don’t warn twice.'], ['Wielders burn under the Queen’s law the same as anyone.']],
            [['State your business in the Marches.'], ['If you can hold a fire, you can hold your tongue. Move along.']],
            [['The Guard owes you one. We’re keeping count.']],
        ],
    },
    saltmere: {
        folk: [
            [['The sea’s took enough from us without you helping.'], ['Mend nets or move on. You’re in the way of both.']],
            [['Tide’s turning. Watch the causeway.'], ['The Regent reads the water every morning. Says it’s been restless.'], ['Gulls are fat this year. Means something’s dying out past the reef.']],
            [['You held the sea wall when it cracked. My house is behind that wall.'], ['Fish for you, no charge. Don’t argue.']],
        ],
        guard: [
            [['The Tide watch has orders about you. Don’t test them.']],
            [['Mind the harbour. Boats first, walkers after.'], ['The Regent doesn’t like Wielders on the docks. Keep it quiet.']],
            [['Regent Oriel says you’re welcome. So you’re welcome.']],
        ],
    },
    skyreach: {
        folk: [
            [['The wind remembers you. So do we.'], ['Pray somewhere else.']],
            [['Up here we say the air carries everything you say. Speak kindly.'], ['The Abbey rings the bells at the turn of every wind.'], ['Kestrel’s gliding again. One day the Heights will keep her.']],
            [['The Abbess-Prince spoke your name at prayers. That doesn’t happen.'], ['Sit. Drink. The view’s free and so are you.']],
        ],
        guard: [
            [['The Skyborne have been told to watch you. We are watching.']],
            [['The paths are narrow. Walk them slowly.'], ['If you fall from Vaelmont, you have a long time to think about it.']],
            [['Walk where you like. The wind’s with you.']],
        ],
    },
    glass: {
        folk: [
            [['Water’s worth more than you are out here. Leave ours alone.'], ['The Matriarch said to sell you nothing. I sell you nothing.']],
            [['The sand sings at night when the wind’s right. Strangers think it’s ghosts.'], ['Glass from the dunes, fire from the sun. The Expanse makes its own trade.'], ['Drink before you’re thirsty. That’s the first thing the desert teaches.']],
            [['You brought the oasis back. The Matriarch wept. Nobody’s seen her weep.'], ['Take water. Take all you can carry.']],
        ],
        guard: [
            [['Ride out before dark, and don’t come back.']],
            [['The riders guard the wells. The wells guard everything.'], ['Keep to the marked dunes.']],
            [['Matriarch Keth’s guest. Ride where you like.']],
        ],
    },
    capital: {
        folk: [
            [['The Lantern Office posts your likeness on every corner.'], ['Halcyra has walls for people like you.']],
            [['The Empress walks the lake path some mornings. Don’t stare if she does.'], ['Everything in the Empire comes here eventually. Tax, letters, trouble.'], ['A Wielder? Register with the Lantern Office or they’ll register you.']],
            [['They’re saying your name in the market. The good things, mostly.'], ['Is it true you crossed the whole Empire on foot?']],
        ],
        guard: [
            [['By order of the Lantern Office, you’re to be watched.'], ['One step toward the palace and you’ll find out what the lanterns are for.']],
            [['Keep to the promenade.'], ['The palace island is closed to petitioners today.']],
            [['The Empress has asked that you be let through. Go on.']],
        ],
    },
};

// ---- about their own house ------------------------------------------------------------------------------------------
export const HOME = {
    burnedSaved: [['You put out the fire on my house once.', 'Then you burned it.', 'I don’t know what you’re supposed to be.']],
    burnedByYou: [['That was my house.', 'You burned it. I watched you do it.'], ['Don’t talk to me.'], ['I’m sleeping in my sister’s loft. Because of you.']],
    burnedOther: [['We lost the house. Not your doing, they tell me.'], ['We’ll build again. We always do.']],
    saved: [['You put out the fire on my roof.', 'I haven’t forgotten.'], ['My house is standing because of you.'], ['Come by for supper. I mean it.']],
};

// ---- named characters -------------------------------------------------------------------------------------------------
const told = { flag: { name: 'prologue', is: 'done' } };
const notTold = { not: told };

export const NAMED = {
    // Veyra, before the fire and after it.
    Bram: [
        { when: notTold, say: [['Dad’s watching. Look busy.'], ['Lanterns at the stone tonight. Don’t be late.'], ['I made you something for the festival. You’ll see.']] },
        { when: { flag: { name: 'bram.barn', is: 'burned' } }, say: [['The barn’s gone. The forge isn’t.', 'Dad says that’s what matters. He’s lying.'], ['Wherever you go, write. I can’t read, but write.']] },
        { when: told, say: [['You kept it off our barn.', 'Whatever you are now, you’re still you.'], ['Go on. The road won’t walk itself. Come back.']] },
    ],
    Mira: [
        { when: notTold, say: [['Bread’s for tonight. Hands off.'], ['If anything burns tonight, let it be my bread.']] },
        { when: { flag: { name: 'veyra.blame', is: 'you' } }, say: [['I saw it come out of you.', 'Don’t come near my ovens.'], ['Go. Please just go.']] },
        { when: { flag: { name: 'veyra.fire', is: 'ruin' } }, say: [['My ovens. My house.', 'I don’t blame you. I don’t know who to blame.']] },
        { when: told, say: [['Take a loaf for the road.', 'Don’t argue. It’s yesterday’s.'], ['Wynn says you’re going with that stranger. Eat first.']] },
    ],
    Wynn: [
        { when: notTold, say: [['Festival morning. Put your hand on the stone. For luck.'], ['Lanterns at dark.']] },
        { when: { flag: { name: 'veyra.stone', is: 'asked' } }, say: [['You asked me what it meant.', 'I still don’t know. But I think the stranger does.'], ['The stone woke for you. Mind what you wake next.']] },
        { when: told, say: [['Sixty years. Never once answered a hand.'], ['My grandmother’s verse had more to it. I wish I’d listened.']] },
    ],
    Hollis: [
        { when: notTold, say: [['Bellows, Bram— oh, it’s you. Seen my son?'], ['Iron wants heat and patience. So does my son.']] },
        { when: { flag: { name: 'veyra.blame', is: 'forgiven' } }, say: [['You were at the well with the rest of us.', 'That counts.']] },
        { when: told, say: [['Birds. Fire. A stone that breaks.', 'I’m a smith. I don’t know what to make of any of it.']] },
    ],
    Tam: [
        { when: notTold, say: [['Emberwings over the ridge this morning. Never seen them this low.'], ['Going to the stone tonight? Everyone is.']] },
        { when: told, say: [['I keep hearing the stone crack.', 'Every time I close my eyes.'], ['Where will you go?']] },
    ],
    // The rulers: what each says to you, by how their kingdom sees you.
    Maren: [
        { when: { standing: { region: 'verdant', atLeast: 3 } }, say: [['The Reach owes you. I don’t say that lightly; I keep its accounts.'], ['If the Lantern Office asks about you, they’ll get nothing from me.']] },
        { when: { not: { standing: { region: 'verdant', atLeast: 2 } } }, say: [['I keep roads and bridges. You break them.', 'Leave my Reach.']] },
        { say: [['Lord-Warden Aldric Maren. I keep the roads of the Reach.', 'You have the look of someone who’s about to cost me money.'], ['Thornwick’s bridge is older than my family. Mind it.']] },
    ],
    Vorn: [
        { when: { standing: { region: 'emberwall', atLeast: 3 } }, say: [['You know fire the way my smiths do: as a thing that has to be fed and watched.', 'Stay for supper.']] },
        { when: { not: { standing: { region: 'emberwall', atLeast: 2 } } }, say: [['You set fires you can’t keep.', 'In the Marches, that’s the only crime.']] },
        { say: [['Talia Vorn. The forges answer to me, and I answer to the forges.'], ['A Wielder with no Guard and no Queen. That’s new.']] },
    ],
    Oriel: [
        { when: { standing: { region: 'saltmere', atLeast: 3 } }, say: [['The tide came in gentle this morning. I think it knew you were here.']] },
        { when: { not: { standing: { region: 'saltmere', atLeast: 2 } } }, say: [['The sea gives and takes. You only take.']] },
        { say: [['Oriel Sand, Regent of the Tides.', 'The water’s been restless since a stone cracked in the hills. Do you know anything about that?'], ['Walk the causeway at low tide. Not at high.']] },
    ],
    Senn: [
        { when: { standing: { region: 'skyreach', atLeast: 3 } }, say: [['You are lighter than when you came up the mountain. That’s what the Heights are for.']] },
        { when: { not: { standing: { region: 'skyreach', atLeast: 2 } } }, say: [['The air carries your deeds ahead of you. They are heavy.']] },
        { say: [['Senn. The Abbey keeps the bells; the bells keep the wind honest.'], ['Sit with me a moment. Nobody climbs this high without a question.']] },
    ],
    Yessa: [
        { when: { standing: { region: 'glass', atLeast: 3 } }, say: [['Water, shade and a name among us. That is what the Expanse gives a friend.']] },
        { when: { not: { standing: { region: 'glass', atLeast: 2 } } }, say: [['You spend water like it’s yours.', 'Out here, that’s how you die.']] },
        { say: [['Yessa Keth. Matriarch of the dunes, for my sins.'], ['The oasis is shrinking. Something under the sand is drinking it.']] },
    ],
    Ilvane: [
        { when: { standing: { region: 'capital', atLeast: 3 } }, say: [['The Empire is wide, and I hear about very little of it.', 'I hear about you.']] },
        { when: { not: { standing: { region: 'capital', atLeast: 2 } } }, say: [['Corvane says you are a danger to the Empire.', 'Convince me he’s wrong.']] },
        { say: [['Ilvane, fourth of the name. You may stand.'], ['My Lantern Office counts Wielders the way my treasury counts coin. Carefully, and with suspicion.']] },
    ],
    Corvane: [
        { when: { not: { standing: { region: 'capital', atLeast: 2 } } }, say: [['Every fire you’ve started is in a ledger on my desk.', 'I read it before I sleep.']] },
        { say: [['High Lantern Corvane. The Office keeps the Empire safe from people like you.', 'And people like you safe from yourselves.'], ['Register. It’s only a name in a book.']] },
    ],
    Kestrel: [
        { say: [['You can’t fly. Yet. Nobody can, until they do.'], ['Watch the updrafts by the cliff. They’ll carry you if you let them.'], ['Senn thinks I’ll fall one day. Senn thinks a lot of things.']] },
    ],
};
