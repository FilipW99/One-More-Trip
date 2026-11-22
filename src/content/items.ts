/**
 * PLACEHOLDER CONTENT: every item in the game.
 *
 * Design doc §2, §5.2-§5.4 call for source-game equipment, supplies, boss uniques
 * and pets. Each record below is a generic stand-in tagged with `ph(section, slot)`
 * describing the slot it fills. To replace one, keep the `id` (or update references
 * in kits/acts/bosses), then change name, stats, requirements and `asset`.
 * Full workflow: docs/REPLACING_CONTENT.md. Generated list: docs/PLACEHOLDERS.md.
 */
import type { EquipSlot, ItemDef, Placeholder, SpecialAttack, StyleTriple } from './types';
import { ph } from './placeholder';

const items: ItemDef[] = [];
const add = (item: ItemDef) => {
  items.push(item);
  return item;
};

const tri = (melee = 0, ranged = 0, magic = 0): StyleTriple => ({ melee, ranged, magic });
const r = (n: number) => Math.round(n);

/* ------------------------------------------------------------------ */
/* Metal tiers                                                         */
/* ------------------------------------------------------------------ */

interface MetalTier {
  key: string;
  name: string;
  tier: number;
  level: number;
  value: number;
}

export const METALS: MetalTier[] = [
  { key: 'bronze', name: 'Bronze', tier: 1, level: 1, value: 8 },
  { key: 'iron', name: 'Iron', tier: 2, level: 1, value: 16 },
  { key: 'steel', name: 'Steel', tier: 3, level: 6, value: 40 },
  { key: 'cobalt', name: 'Cobalt', tier: 4, level: 15, value: 90 },
  { key: 'orichalcum', name: 'Orichalcum', tier: 5, level: 25, value: 180 },
  { key: 'starmetal', name: 'Starmetal', tier: 6, level: 38, value: 350 },
];

const SCIM_ATT = [6, 10, 15, 22, 32, 45];
const SCIM_STR = [5, 9, 14, 20, 30, 42];
const HELM_DEF = [3, 5, 8, 12, 18, 26];
const BODY_DEF = [8, 14, 22, 32, 46, 64];
const LEGS_DEF = [5, 9, 14, 21, 30, 42];
const SHIELD_DEF = [5, 8, 13, 19, 28, 40];
const ARROW_STR = [7, 10, 16, 22, 31, 45];
const KNIFE_STR = [3, 5, 8, 12, 17, 24];

function metalTags(tier: number): string[] {
  const tags = ['metal'];
  if (tier === 3 || tier === 4) tags.push('metal-mid');
  if (tier >= 5) tags.push('metal-high');
  return tags;
}

function metalPh(slot: string, m: MetalTier): Placeholder {
  return ph('§5.2', `${slot}, metal tier ${m.tier}`);
}

const DAGGER_SPEC: SpecialAttack = {
  name: 'Twin Cut',
  cost: 25,
  effect: 'double',
  description: 'Two quick hits in one attack.',
};
const HAMMER_SPEC: SpecialAttack = {
  name: 'Sunder',
  cost: 50,
  effect: 'drain',
  description: 'A heavy blow that lowers the target’s defence by 30%.',
};

for (const m of METALS) {
  const i = m.tier - 1;
  const base = { tier: m.tier, req: { level: m.level }, value: m.value };

  add({
    ...base,
    id: `${m.key}_scimitar`,
    name: `${m.name} scimitar`,
    kind: 'weapon',
    slot: 'weapon',
    examine: 'A curved, accurate blade.',
    attack: tri(SCIM_ATT[i]),
    strength: tri(SCIM_STR[i]),
    weapon: { style: 'melee', speed: 4, range: 1 },
    tags: [...metalTags(m.tier), 'melee-weapon', 'accurate', 'scimitar'],
    focus: 'melee',
    ph: metalPh('Melee weapon (scimitar)', m),
  });

  const daggerSpec = m.tier >= 3;
  add({
    ...base,
    id: `${m.key}_dagger`,
    name: `${m.name} dagger`,
    kind: 'weapon',
    slot: 'weapon',
    examine: daggerSpec ? 'Light enough to strike twice.' : 'A short stabbing blade.',
    attack: tri(r(SCIM_ATT[i] * 0.9)),
    strength: tri(r(SCIM_STR[i] * 0.75)),
    weapon: { style: 'melee', speed: 4, range: 1, special: daggerSpec ? DAGGER_SPEC : undefined },
    tags: [...metalTags(m.tier), 'melee-weapon', 'accurate', ...(daggerSpec ? ['spec'] : [])],
    focus: 'melee',
    ph: metalPh('Melee weapon (dagger, special attack from tier 3)', m),
  });

  const hammerSpec = m.tier >= 4;
  add({
    ...base,
    id: `${m.key}_warhammer`,
    name: `${m.name} warhammer`,
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Slow, heavy and very persuasive.',
    attack: tri(r(SCIM_ATT[i] * 0.85)),
    strength: tri(r(SCIM_STR[i] * 1.4)),
    weapon: { style: 'melee', speed: 6, range: 1, special: hammerSpec ? HAMMER_SPEC : undefined },
    tags: [...metalTags(m.tier), 'melee-weapon', 'strength-gear', ...(hammerSpec ? ['spec'] : [])],
    focus: 'melee',
    ph: metalPh('Melee weapon (crush, special attack from tier 4)', m),
  });

  add({
    ...base,
    id: `${m.key}_greatsword`,
    name: `${m.name} greatsword`,
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Needs both hands and a lot of room.',
    attack: tri(r(SCIM_ATT[i] * 1.05)),
    strength: tri(r(SCIM_STR[i] * 1.9)),
    weapon: { style: 'melee', speed: 7, range: 1, twoHanded: true },
    tags: [...metalTags(m.tier), 'melee-weapon', 'two-handed', 'strength-gear'],
    focus: 'melee',
    ph: metalPh('Two-handed melee weapon', m),
  });

  const armour = (
    slot: EquipSlot,
    suffix: string,
    def: number,
    extraTags: string[] = [],
    slotText = suffix,
  ) =>
    add({
      ...base,
      id: `${m.key}_${suffix.replace(/\s+/g, '_')}`,
      name: `${m.name} ${suffix}`,
      kind: 'armour',
      slot,
      examine: `Sturdy ${m.name.toLowerCase()} armour.`,
      attack: tri(0, -Math.ceil(def / 6), -Math.ceil(def / 3)),
      defence: tri(def, r(def * 0.9), -Math.ceil(def / 8)),
      tags: [...metalTags(m.tier), 'melee-armour', ...extraTags],
      focus: 'melee',
      ph: metalPh(`Melee armour (${slotText})`, m),
    });
  armour('head', 'full helm', HELM_DEF[i], [], 'helmet');
  armour('body', 'platebody', BODY_DEF[i], [], 'body');
  armour('legs', 'platelegs', LEGS_DEF[i], [], 'legs');
  armour('shield', 'kiteshield', SHIELD_DEF[i], ['shield'], 'shield');

  add({
    id: `${m.key}_arrows`,
    name: `${m.name} arrows`,
    kind: 'ammo',
    slot: 'ammo',
    examine: 'Fletched and ready.',
    ammoType: 'arrow',
    stackable: true,
    strength: tri(0, ARROW_STR[i]),
    tier: m.tier,
    value: Math.max(1, Math.round(m.value / 10)),
    tags: ['arrow', 'ammo', 'supply'],
    focus: 'ranged',
    ph: metalPh('Arrows', m),
  });

  add({
    id: `${m.key}_knives`,
    name: `${m.name} throwing knives`,
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Balanced for throwing.',
    ammoType: 'thrown',
    stackable: true,
    attack: tri(0, r(SCIM_ATT[i] * 0.7)),
    strength: tri(0, KNIFE_STR[i]),
    weapon: { style: 'ranged', speed: 3, range: 5, ammo: 'thrown' },
    tier: m.tier,
    req: { level: m.level },
    value: Math.max(1, Math.round(m.value / 8)),
    tags: ['thrown', 'ranged-weapon'],
    focus: 'ranged',
    ph: metalPh('Thrown weapon', m),
  });

  if (m.tier >= 3) {
    add({
      ...base,
      id: `${m.key}_crossbow`,
      name: `${m.name} crossbow`,
      kind: 'weapon',
      slot: 'weapon',
      examine: 'Slow to load, hard to argue with.',
      attack: tri(0, r(SCIM_ATT[i] * 1.25)),
      weapon: { style: 'ranged', speed: 5, range: 8, ammo: 'bolt' },
      tags: ['crossbow', 'ranged-weapon', 'metal'],
      focus: 'ranged',
      ph: metalPh('Crossbow', m),
    });
    add({
      id: `${m.key}_bolts`,
      name: `${m.name} bolts`,
      kind: 'ammo',
      slot: 'ammo',
      examine: 'Short, heavy crossbow bolts.',
      ammoType: 'bolt',
      stackable: true,
      strength: tri(0, r(ARROW_STR[i] * 1.6)),
      tier: m.tier,
      value: Math.max(2, Math.round(m.value / 8)),
      tags: ['crossbow', 'bolt', 'ammo', 'supply'],
      focus: 'ranged',
      ph: metalPh('Crossbow bolts', m),
    });
  }
}

/* Special ammunition (Ranged rank 6 gate) --------------------------- */
add({
  id: 'frost_arrows',
  name: 'Frost arrows',
  kind: 'ammo',
  slot: 'ammo',
  examine: 'Tipped with ice that never melts.',
  ammoType: 'arrow',
  stackable: true,
  strength: tri(0, 26),
  tier: 4,
  value: 12,
  tags: ['arrow', 'ammo', 'supply', 'special-ammo'],
  focus: 'ranged',
  ph: ph('§4.3', 'Special arrows (Ranged rank 6 gate)'),
});
add({
  id: 'ember_bolts',
  name: 'Ember bolts',
  kind: 'ammo',
  slot: 'ammo',
  examine: 'They hiss when they leave the crossbow.',
  ammoType: 'bolt',
  stackable: true,
  strength: tri(0, 58),
  tier: 5,
  value: 24,
  tags: ['crossbow', 'bolt', 'ammo', 'supply', 'special-ammo'],
  focus: 'ranged',
  ph: ph('§4.3', 'Special bolts (Ranged rank 6 gate)'),
});

/* ------------------------------------------------------------------ */
/* Starter and misc equipment                                          */
/* ------------------------------------------------------------------ */

add({
  id: 'wooden_shield',
  name: 'Wooden shield',
  kind: 'armour',
  slot: 'shield',
  examine: 'Better than nothing.',
  defence: tri(4, 4, 1),
  tier: 1,
  value: 6,
  tags: ['shield', 'melee-armour'],
  focus: 'melee',
  ph: ph('§2', 'Melee starting kit: shield'),
});
add({
  id: 'iron_chainbody',
  name: 'Iron chainbody',
  kind: 'armour',
  slot: 'body',
  examine: 'Rings of iron, loosely linked.',
  attack: tri(0, -1, -3),
  defence: tri(10, 9, -1),
  tier: 2,
  value: 14,
  tags: ['metal', 'melee-armour'],
  focus: 'melee',
  ph: ph('§2', 'Melee starting kit: body armour'),
});

/* Bows: wood tiers ------------------------------------------------- */
const BOWS: [string, string, number, number, number, string[]][] = [
  // id, name, tier, att, level, extra tags
  ['shortbow', 'Shortbow', 1, 8, 1, []],
  ['ashwood_shortbow', 'Ashwood shortbow', 2, 14, 1, []],
  ['elmwood_shortbow', 'Elmwood shortbow', 3, 20, 6, []],
  ['ironwood_shortbow', 'Ironwood shortbow', 4, 29, 15, []],
  ['starwood_shortbow', 'Starwood shortbow', 5, 40, 25, ['spec']],
];
for (const [id, name, tier, att, level, extra] of BOWS) {
  add({
    id,
    name,
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Quick to draw.',
    attack: tri(0, att),
    weapon: {
      style: 'ranged',
      speed: 3,
      range: 7,
      ammo: 'arrow',
      twoHanded: true,
      special: extra.includes('spec')
        ? { name: 'Volley', cost: 50, effect: 'double', description: 'Loose two arrows at once.' }
        : undefined,
    },
    tier,
    req: { level },
    value: [10, 25, 50, 110, 220][tier - 1],
    tags: ['bow', 'ranged-weapon', ...extra],
    focus: 'ranged',
    ph: ph(id === 'shortbow' ? '§2' : '§5.2', id === 'shortbow' ? 'Ranged starting kit: bow' : `Ranged weapon (bow), tier ${tier}`),
  });
}
add({
  id: 'longbow',
  name: 'Longbow',
  kind: 'weapon',
  slot: 'weapon',
  examine: 'Slow, but reaches a long way.',
  attack: tri(0, 12),
  strength: tri(0, 2),
  weapon: { style: 'ranged', speed: 5, range: 9, ammo: 'arrow', twoHanded: true },
  tier: 2,
  req: { level: 1 },
  value: 20,
  tags: ['bow', 'ranged-weapon'],
  focus: 'ranged',
  ph: ph('§5.2', 'Ranged weapon (long-range bow)'),
});

/* Ranged armour ---------------------------------------------------- */
const RANGED_ARMOUR: [string, string, EquipSlot, number, number, number, number, string[]][] = [
  // id, name, slot, tier, rangedAtt, defMelee/ranged, level, tags
  ['leather_body', 'Leather body', 'body', 1, 2, 6, 1, ['leather']],
  ['leather_chaps', 'Leather chaps', 'legs', 1, 1, 4, 1, ['leather']],
  ['leather_coif', 'Leather coif', 'head', 1, 1, 2, 1, ['leather']],
  ['leather_vambraces', 'Leather vambraces', 'hands', 1, 3, 1, 1, ['leather']],
  ['studded_body', 'Studded body', 'body', 3, 6, 14, 6, ['leather']],
  ['studded_chaps', 'Studded chaps', 'legs', 3, 4, 9, 6, ['leather']],
  ['green_drakehide_body', 'Green drakehide body', 'body', 4, 12, 26, 15, ['leather', 'drakehide']],
  ['green_drakehide_chaps', 'Green drakehide chaps', 'legs', 4, 8, 16, 15, ['leather', 'drakehide']],
  ['green_drakehide_vambraces', 'Green drakehide vambraces', 'hands', 4, 7, 3, 15, ['leather', 'drakehide']],
  ['red_drakehide_body', 'Red drakehide body', 'body', 5, 18, 36, 25, ['leather', 'drakehide']],
  ['red_drakehide_chaps', 'Red drakehide chaps', 'legs', 5, 12, 23, 25, ['leather', 'drakehide']],
  ['black_drakehide_body', 'Black drakehide body', 'body', 6, 26, 50, 38, ['leather', 'drakehide']],
  ['black_drakehide_chaps', 'Black drakehide chaps', 'legs', 6, 17, 32, 38, ['leather', 'drakehide']],
];
for (const [id, name, slot, tier, att, def, level, tags] of RANGED_ARMOUR) {
  add({
    id,
    name,
    kind: 'armour',
    slot,
    examine: 'Light armour that leaves the arms free.',
    attack: tri(0, att, -Math.ceil(att / 3)),
    defence: tri(def, def, r(def * 0.6)),
    tier,
    req: { level },
    value: [12, 0, 45, 100, 200, 380][tier - 1],
    tags: ['ranged-armour', ...tags],
    focus: 'ranged',
    ph: ph(tier === 1 && (slot === 'body' || slot === 'legs') ? '§2' : '§5.2', tier === 1 && (slot === 'body' || slot === 'legs') ? `Ranged starting kit: ${slot}` : `Ranged armour (${slot}), tier ${tier}`),
  });
}

/* Magic weapons ---------------------------------------------------- */
const STAVES: [string, string, number, number, number, number, string[]][] = [
  // id, name, tier, magicAtt, magicDmg%, level, tags
  ['air_staff', 'Air staff', 1, 10, 0, 1, []],
  ['water_staff', 'Water staff', 2, 12, 0, 1, []],
  ['earth_staff', 'Earth staff', 2, 12, 1, 1, []],
  ['fire_staff', 'Fire staff', 2, 12, 2, 1, []],
  ['battlestaff', 'Battlestaff', 3, 15, 3, 6, []],
  ['adept_staff', 'Adept staff', 4, 20, 5, 15, []],
  ['arcanist_staff', 'Arcanist staff', 5, 26, 10, 25, []],
  ['archmage_staff', 'Archmage staff', 6, 34, 15, 38, []],
];
for (const [id, name, tier, att, dmg, level, tags] of STAVES) {
  add({
    id,
    name,
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Channels spells from your spellbook.',
    attack: tri(2 + tier, 0, att),
    strength: tri(2 + tier, 0, dmg),
    defence: tri(1, 1, r(att / 2)),
    weapon: { style: 'magic', speed: 5, range: 10, autocast: true, twoHanded: tier >= 3 },
    tier,
    req: { level },
    value: [10, 22, 50, 110, 220, 400][tier - 1],
    tags: ['staff', 'magic-weapon', ...tags],
    focus: 'magic',
    ph: ph(id === 'air_staff' ? '§2' : '§5.2', id === 'air_staff' ? 'Magic starting kit: staff' : `Magic weapon (staff), tier ${tier}`),
  });
}
add({
  id: 'stormcaller_staff',
  name: 'Stormcaller staff',
  kind: 'weapon',
  slot: 'weapon',
  examine: 'Crackles with a spell of its own. Needs no runes.',
  attack: tri(0, 0, 22),
  strength: tri(0, 0, 0),
  defence: tri(2, 2, 10),
  weapon: { style: 'magic', speed: 4, range: 7, poweredMaxHit: 16, twoHanded: true },
  tier: 4,
  req: { level: 15 },
  value: 160,
  tags: ['powered-staff', 'magic-weapon'],
  focus: 'magic',
  ph: ph('§5.2', 'Powered staff, mid tier'),
});
add({
  id: 'tidecaller_staff',
  name: 'Tidecaller staff',
  kind: 'weapon',
  slot: 'weapon',
  examine: 'A powered staff that hums like the sea.',
  attack: tri(0, 0, 28),
  defence: tri(3, 3, 14),
  weapon: { style: 'magic', speed: 4, range: 7, poweredMaxHit: 22, twoHanded: true },
  tier: 5,
  req: { level: 28 },
  value: 300,
  tags: ['powered-staff', 'magic-weapon'],
  focus: 'magic',
  ph: ph('§5.2', 'Powered staff, high tier'),
});

/* Magic armour ----------------------------------------------------- */
const ROBES: [string, string, EquipSlot, number, number, number, string[]][] = [
  // id, name, slot, tier, magicAtt, level, tags
  ['apprentice_hat', 'Apprentice hat', 'head', 1, 2, 1, []],
  ['apprentice_robe', 'Apprentice robe', 'body', 1, 4, 1, []],
  ['apprentice_skirt', 'Apprentice skirt', 'legs', 1, 3, 1, []],
  ['adept_hood', 'Adept hood', 'head', 3, 5, 6, []],
  ['adept_robe', 'Adept robe', 'body', 3, 10, 6, []],
  ['adept_skirt', 'Adept skirt', 'legs', 3, 7, 6, []],
  ['arcanist_hood', 'Arcanist hood', 'head', 5, 9, 25, []],
  ['arcanist_robe', 'Arcanist robe', 'body', 5, 18, 25, []],
  ['arcanist_skirt', 'Arcanist skirt', 'legs', 5, 13, 25, []],
  ['archmage_hood', 'Archmage hood', 'head', 6, 12, 38, []],
  ['archmage_robe', 'Archmage robe', 'body', 6, 26, 38, []],
  ['archmage_skirt', 'Archmage skirt', 'legs', 6, 19, 38, []],
];
for (const [id, name, slot, tier, att, level, tags] of ROBES) {
  add({
    id,
    name,
    kind: 'armour',
    slot,
    examine: 'Robes woven with simple wards.',
    attack: tri(0, 0, att),
    defence: tri(r(att / 3), r(att / 3), att),
    strength: tri(0, 0, tier >= 5 ? (slot === 'body' ? 2 : 1) : 0),
    tier,
    req: { level },
    value: [8, 0, 40, 0, 190, 360][tier - 1],
    tags: ['magic-armour', ...tags],
    focus: 'magic',
    ph: ph(tier === 1 && slot !== 'legs' ? '§2' : '§5.2', tier === 1 && slot !== 'legs' ? `Magic starting kit: ${slot}` : `Magic armour (${slot}), tier ${tier}`),
  });
}

/* Defensive set (Defence rank 6 gate) ------------------------------- */
const GRAVEWARDEN: [string, string, EquipSlot, number][] = [
  ['gravewarden_helm', 'Gravewarden helm', 'head', 24],
  ['gravewarden_platebody', 'Gravewarden platebody', 'body', 58],
  ['gravewarden_platelegs', 'Gravewarden platelegs', 'legs', 40],
];
for (const [id, name, slot, def] of GRAVEWARDEN) {
  add({
    id,
    name,
    kind: 'armour',
    slot,
    examine: 'Armour taken from an old crypt. It still feels watched.',
    attack: tri(0, -4, -10),
    defence: tri(def, def, r(def * 0.3)),
    strength: tri(slot === 'body' ? 2 : 1),
    tier: 5,
    req: { level: 28 },
    value: 260,
    tags: ['defensive-set', 'melee-armour'],
    focus: 'melee',
    ph: ph('§4.3', 'Defensive armour set (Defence rank 6 drop-pool gate)'),
  });
}

/* Off-hands, capes, hands, feet ------------------------------------ */
const MISC_GEAR: ItemDef[] = [
  {
    id: 'bulwark_defender',
    name: 'Bulwark defender',
    kind: 'armour',
    slot: 'shield',
    examine: 'A parrying off-hand for melee fighters.',
    attack: tri(10),
    strength: tri(4),
    defence: tri(8, 8, 2),
    tier: 4,
    req: { level: 15 },
    value: 140,
    tags: ['melee-armour', 'strength-gear'],
    focus: 'melee',
    ph: ph('§5.2', 'Melee off-hand (defender)'),
  },
  {
    id: 'spell_ward',
    name: 'Spell ward',
    kind: 'armour',
    slot: 'shield',
    examine: 'A focus that steadies spellcasting.',
    attack: tri(0, 0, 10),
    strength: tri(0, 0, 2),
    defence: tri(4, 4, 10),
    tier: 4,
    req: { level: 15 },
    value: 140,
    tags: ['magic-armour'],
    focus: 'magic',
    ph: ph('§5.2', 'Magic off-hand'),
  },
  {
    id: 'archers_buckler',
    name: "Archer's buckler",
    kind: 'armour',
    slot: 'shield',
    examine: 'Small enough to shoot past.',
    attack: tri(0, 8),
    defence: tri(6, 8, 4),
    tier: 4,
    req: { level: 15 },
    value: 140,
    tags: ['ranged-armour'],
    focus: 'ranged',
    ph: ph('§5.2', 'Ranged off-hand'),
  },
  {
    id: 'travellers_cape',
    name: "Traveller's cape",
    kind: 'armour',
    slot: 'cape',
    examine: 'Warm, plain and patched.',
    defence: tri(3, 3, 3),
    tier: 1,
    value: 10,
    tags: ['cape'],
    ph: ph('§5.2', 'Basic cape'),
  },
  {
    id: 'archers_cloak',
    name: "Archer's cloak",
    kind: 'armour',
    slot: 'cape',
    examine: 'Cut short so it never catches the string.',
    attack: tri(0, 5),
    defence: tri(3, 3, 3),
    tier: 3,
    req: { level: 6 },
    value: 50,
    tags: ['cape'],
    focus: 'ranged',
    ph: ph('§5.2', 'Ranged cape'),
  },
  {
    id: 'mages_mantle',
    name: "Mage's mantle",
    kind: 'armour',
    slot: 'cape',
    examine: 'Embroidered with faded sigils.',
    attack: tri(0, 0, 5),
    defence: tri(2, 2, 5),
    tier: 3,
    req: { level: 6 },
    value: 50,
    tags: ['cape'],
    focus: 'magic',
    ph: ph('§5.2', 'Magic cape'),
  },
  {
    id: 'leather_gloves',
    name: 'Leather gloves',
    kind: 'armour',
    slot: 'hands',
    examine: 'A good grip.',
    attack: tri(2, 2, 2),
    defence: tri(1, 1, 1),
    tier: 1,
    value: 6,
    tags: ['leather'],
    ph: ph('§5.2', 'Basic gloves'),
  },
  {
    id: 'combat_gloves',
    name: 'Combat gloves',
    kind: 'armour',
    slot: 'hands',
    examine: 'Padded knuckles, reinforced palms.',
    attack: tri(6, 6, 6),
    strength: tri(4, 2, 1),
    defence: tri(6, 6, 6),
    tier: 4,
    req: { level: 15 },
    value: 150,
    tags: ['strength-gear'],
    ph: ph('§5.2', 'Mid-tier gloves'),
  },
  {
    id: 'leather_boots',
    name: 'Leather boots',
    kind: 'armour',
    slot: 'feet',
    examine: 'Worn soft.',
    defence: tri(1, 1, 1),
    tier: 1,
    value: 6,
    tags: ['leather'],
    ph: ph('§5.2', 'Basic boots'),
  },
  {
    id: 'warrior_boots',
    name: 'Warrior boots',
    kind: 'armour',
    slot: 'feet',
    examine: 'Hobnailed and heavy.',
    strength: tri(3),
    defence: tri(5, 5, 2),
    tier: 4,
    req: { level: 15 },
    value: 120,
    tags: ['strength-gear'],
    focus: 'melee',
    ph: ph('§5.2', 'Mid-tier boots'),
  },
];
MISC_GEAR.forEach(add);

/* Jewellery (Crafting gates) ---------------------------------------- */
const JEWELLERY: ItemDef[] = [
  {
    id: 'amulet_of_accuracy',
    name: 'Amulet of accuracy',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'Helps every strike find its mark.',
    attack: tri(4, 4, 4),
    tier: 2,
    value: 40,
    tags: ['jewellery'],
    ph: ph('§4.4', 'Amulet (Crafting rank 3 gate)'),
  },
  {
    id: 'amulet_of_might',
    name: 'Amulet of might',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'Feels heavier than it looks.',
    strength: tri(6),
    tier: 3,
    value: 60,
    tags: ['jewellery', 'strength-gear'],
    focus: 'melee',
    ph: ph('§4.4', 'Strength amulet (Crafting rank 3 gate)'),
  },
  {
    id: 'amulet_of_marksmanship',
    name: 'Amulet of marksmanship',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'Steadies the hand.',
    attack: tri(0, 6),
    strength: tri(0, 2),
    tier: 3,
    value: 60,
    tags: ['jewellery'],
    focus: 'ranged',
    ph: ph('§4.4', 'Ranged amulet (Crafting rank 3 gate)'),
  },
  {
    id: 'amulet_of_sorcery',
    name: 'Amulet of sorcery',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'Warm to the touch.',
    attack: tri(0, 0, 6),
    strength: tri(0, 0, 2),
    tier: 3,
    value: 60,
    tags: ['jewellery'],
    focus: 'magic',
    ph: ph('§4.4', 'Magic amulet (Crafting rank 3 gate)'),
  },
  {
    id: 'ring_of_fury',
    name: 'Ring of fury',
    kind: 'jewellery',
    slot: 'ring',
    examine: 'Makes your knuckles itch for a fight.',
    strength: tri(4),
    tier: 3,
    value: 70,
    tags: ['jewellery', 'strength-gear'],
    focus: 'melee',
    ph: ph('§4.3', 'Strength ring (Strength rank 6 weight)'),
  },
  {
    id: 'ring_of_warding',
    name: 'Ring of warding',
    kind: 'jewellery',
    slot: 'ring',
    examine: 'A faint shimmer surrounds the wearer.',
    defence: tri(4, 4, 4),
    tier: 2,
    value: 50,
    tags: ['jewellery'],
    ph: ph('§4.4', 'Defensive ring'),
  },
  {
    id: 'ring_of_thorns',
    name: 'Ring of thorns',
    kind: 'jewellery',
    slot: 'ring',
    examine: 'Returns some of the pain. Holds charge for a few rooms.',
    tier: 3,
    value: 80,
    charges: 6,
    passive: [{ mod: 'reflectPct', value: 15 }],
    tags: ['jewellery'],
    ph: ph('§4.4', 'Charged jewellery (recoil-style ring)'),
  },
  {
    id: 'ring_of_fortune',
    name: 'Ring of fortune',
    kind: 'jewellery',
    slot: 'ring',
    examine: 'Coins seem to find their way to you. Holds charge for a few rooms.',
    tier: 3,
    value: 90,
    charges: 8,
    passive: [{ mod: 'coinFind', value: 15 }],
    tags: ['jewellery'],
    ph: ph('§4.4', 'Charged jewellery (wealth-style ring)'),
  },
  {
    id: 'sapphire_amulet',
    name: 'Sapphire amulet',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'A cool blue stone.',
    attack: tri(0, 0, 8),
    prayer: 2,
    tier: 3,
    value: 90,
    tags: ['gem-jewellery'],
    focus: 'magic',
    ph: ph('§4.4', 'Gem amulet (Crafting rank 6 gate)'),
  },
  {
    id: 'emerald_amulet',
    name: 'Emerald amulet',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'A sharp green stone.',
    attack: tri(0, 8),
    strength: tri(0, 3),
    tier: 4,
    value: 120,
    tags: ['gem-jewellery'],
    focus: 'ranged',
    ph: ph('§4.4', 'Gem amulet (Crafting rank 6 gate)'),
  },
  {
    id: 'ruby_amulet',
    name: 'Ruby amulet',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'A deep red stone.',
    attack: tri(4),
    strength: tri(10),
    tier: 4,
    value: 140,
    tags: ['gem-jewellery', 'strength-gear'],
    focus: 'melee',
    ph: ph('§4.4', 'Gem amulet (Crafting rank 6 gate)'),
  },
  {
    id: 'diamond_amulet',
    name: 'Diamond amulet',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'Clear and very hard.',
    attack: tri(10, 10, 10),
    strength: tri(6, 2, 2),
    prayer: 3,
    tier: 5,
    req: { level: 25 },
    value: 260,
    tags: ['gem-jewellery'],
    ph: ph('§4.4', 'Gem amulet (Crafting rank 6 gate)'),
  },
  {
    id: 'starstone_amulet',
    name: 'Starstone amulet',
    kind: 'jewellery',
    slot: 'neck',
    examine: 'A sliver of fallen star set in gold.',
    attack: tri(12, 12, 12),
    strength: tri(10, 4, 5),
    prayer: 4,
    tier: 6,
    req: { level: 38 },
    value: 480,
    tags: ['gem-jewellery'],
    ph: ph('§4.4', 'Best-in-slot gem amulet'),
  },
];
JEWELLERY.forEach(add);

/* Supplies ---------------------------------------------------------- */
const FOOD: [string, string, number, number, string[]][] = [
  // id, name, heal, tier, tags
  ['bread', 'Bread', 4, 1, []],
  ['trout', 'Trout', 7, 1, []],
  ['salmon', 'Salmon', 9, 2, []],
  ['tuna', 'Tuna', 11, 3, []],
  ['swordfish', 'Swordfish', 14, 4, ['fish-high']],
  ['shark', 'Shark', 20, 5, ['fish-high']],
  ['manta_ray', 'Manta ray', 22, 6, ['fish-high']],
];
for (const [id, name, heal, tier, tags] of FOOD) {
  add({
    id,
    name,
    kind: 'food',
    examine: `Heals ${heal} Hitpoints.`,
    heal,
    tier,
    value: Math.max(3, heal * 2),
    tags: ['food', 'supply', ...tags],
    ph: ph(id === 'trout' ? '§2' : '§5.4', id === 'trout' ? 'Starting food' : `Food, tier ${tier}`),
  });
}

const POTIONS: ItemDef[] = [
  {
    id: 'devotion_draught',
    name: 'Devotion draught',
    kind: 'potion',
    examine: 'Restores Prayer points.',
    potion: { effect: 'prayer', amount: 12 },
    tier: 2,
    value: 30,
    tags: ['potion', 'supply'],
    ph: ph('§5.4', 'Prayer potion'),
  },
  {
    id: 'restoration_draught',
    name: 'Restoration draught',
    kind: 'potion',
    examine: 'Restores a large amount of Prayer.',
    potion: { effect: 'restore', amount: 20 },
    tier: 4,
    value: 55,
    tags: ['potion', 'supply', 'herb-high'],
    ph: ph('§5.4', 'Prayer-restoring potion (high tier)'),
  },
  {
    id: 'healing_brew',
    name: 'Healing brew',
    kind: 'potion',
    examine: 'Heals a lot, quickly.',
    potion: { effect: 'heal', amount: 16 },
    tier: 3,
    value: 45,
    tags: ['potion', 'supply'],
    ph: ph('§5.4', 'Healing brew'),
  },
  {
    id: 'stamina_draught',
    name: 'Stamina draught',
    kind: 'potion',
    examine: 'Restores run energy.',
    potion: { effect: 'stamina', amount: 100 },
    tier: 2,
    value: 25,
    tags: ['potion', 'supply'],
    ph: ph('§5.4', 'Stamina potion'),
  },
  {
    id: 'combat_draught',
    name: 'Combat draught',
    kind: 'potion',
    examine: '+10% accuracy and damage for the rest of the room.',
    potion: { effect: 'combat', amount: 10 },
    tier: 3,
    value: 40,
    tags: ['potion', 'supply'],
    ph: ph('§5.4', 'Combat boost potion'),
  },
];
POTIONS.forEach(add);

const RUNES: ItemDef[] = [
  {
    id: 'spark_rune',
    name: 'Spark rune',
    kind: 'rune',
    examine: 'The simplest combat rune.',
    stackable: true,
    tier: 1,
    value: 1,
    tags: ['rune', 'supply'],
    focus: 'magic',
    ph: ph('§2', 'Magic starting kit: runes'),
  },
  {
    id: 'storm_rune',
    name: 'Storm rune',
    kind: 'rune',
    examine: 'Hums faintly.',
    stackable: true,
    tier: 2,
    value: 2,
    tags: ['rune', 'supply'],
    focus: 'magic',
    ph: ph('§5.4', 'Mid-tier combat rune'),
  },
  {
    id: 'void_rune',
    name: 'Void rune',
    kind: 'rune',
    examine: 'Darker than it should be.',
    stackable: true,
    tier: 3,
    value: 4,
    tags: ['rune', 'supply'],
    focus: 'magic',
    ph: ph('§5.4', 'High-tier combat rune'),
  },
  {
    id: 'tempest_rune',
    name: 'Tempest rune',
    kind: 'rune',
    examine: 'Counts as both a spark and a storm rune.',
    stackable: true,
    tier: 3,
    value: 4,
    tags: ['rune', 'supply', 'combo-rune'],
    focus: 'magic',
    ph: ph('§4.4', 'Combination rune (Runecraft rank 6 gate)'),
  },
  {
    id: 'rune_pouch',
    name: 'Rune pouch',
    kind: 'misc',
    examine: 'Keeps runes dry and tidy. While carried, 10% of casts use no runes.',
    tier: 2,
    value: 60,
    passive: [{ mod: 'runeSave', value: 10 }],
    tags: ['rune-pouch'],
    focus: 'magic',
    ph: ph('§4.4', 'Rune pouch (Runecraft rank 3 gate)'),
  },
];
RUNES.forEach(add);

/* Spell tomes (Magic rank 3 gate) ----------------------------------- */
const TOMES: [string, string, string, number][] = [
  ['tome_of_bolt', 'Tome of Bolt', 'bolt', 2],
  ['tome_of_blast', 'Tome of Blast', 'blast', 3],
  ['tome_of_surge', 'Tome of Surge', 'surge', 5],
  ['tome_of_shackle', 'Tome of Shackle', 'shackle', 3],
  ['tome_of_siphon', 'Tome of Siphon', 'siphon', 4],
  ['tome_of_eclipse', 'Tome of Eclipse', 'eclipse', 5],
];
for (const [id, name, teaches, tier] of TOMES) {
  add({
    id,
    name,
    kind: 'tome',
    examine: 'Read it to learn the spell for the rest of this trip.',
    teaches,
    tier,
    value: 30 * tier,
    tags: ['spell-tome'],
    focus: 'magic',
    ph: ph('§4.3', 'Combat spell unlock (Magic rank 3 gate)'),
  });
}

/* Gathering resources and caches ------------------------------------ */
const RESOURCES: ItemDef[] = [
  { id: 'logs', name: 'Logs', kind: 'resource', examine: 'Burns well. Light a brazier at a rest altar.', stackable: true, tier: 1, value: 4, tags: ['log', 'resource'], ph: ph('§4.4', 'Logs') },
  { id: 'ashwood_logs', name: 'Ashwood logs', kind: 'resource', examine: 'Burns hot and long.', stackable: true, tier: 3, value: 12, tags: ['log', 'log-high', 'resource'], ph: ph('§4.4', 'Higher-tier logs') },
  { id: 'iron_ore', name: 'Iron ore', kind: 'resource', examine: 'Worth a few coins to a trader.', stackable: true, tier: 1, value: 8, tags: ['ore', 'resource'], ph: ph('§4.4', 'Basic ore (Mining)') },
  { id: 'cobalt_ore', name: 'Cobalt ore', kind: 'resource', examine: 'Blue-veined and valuable.', stackable: true, tier: 4, value: 30, tags: ['ore', 'ore-high', 'resource'], ph: ph('§4.4', 'Higher-tier ore') },
  { id: 'uncut_gem', name: 'Uncut gem', kind: 'resource', examine: 'A trader will pay well for this.', stackable: true, tier: 3, value: 45, tags: ['gem', 'resource'], ph: ph('§4.4', 'Uncut gem (Mining/Crafting)') },
  { id: 'impling_jar', name: 'Impling jar', kind: 'casket', examine: 'Something small rattles inside. Open it for a loot roll.', tier: 3, value: 50, tags: ['impling-jar'], ph: ph('§4.4', 'Impling jar (Hunter rank 6 gate)') },
  { id: 'sealed_casket', name: 'Sealed casket', kind: 'casket', examine: 'Open it for a reward roll.', tier: 3, value: 60, tags: ['casket'], ph: ph('§3.1', 'Clue/casket reward') },
];
RESOURCES.forEach(add);

/* ------------------------------------------------------------------ */
/* Boss uniques                                                        */
/* ------------------------------------------------------------------ */

const UNIQUES: ItemDef[] = [
  // Act 1 boss
  {
    id: 'brutes_cudgel',
    name: "Brute's cudgel",
    kind: 'weapon',
    slot: 'weapon',
    examine: 'A tree trunk with ambitions.',
    attack: tri(18),
    strength: tri(30),
    weapon: { style: 'melee', speed: 6, range: 1, twoHanded: true },
    tier: 3,
    req: { level: 5 },
    value: 300,
    unique: true,
    tags: ['unique', 'melee-weapon', 'strength-gear'],
    focus: 'melee',
    ph: ph('§5.3', 'Act 1 boss unique'),
  },
  // Act 2 route A boss
  {
    id: 'warplate_chestplate',
    name: 'Warplate chestplate',
    kind: 'armour',
    slot: 'body',
    examine: 'Built for a warlord, adjusted for you.',
    attack: tri(0, -6, -15),
    defence: tri(56, 52, -4),
    strength: tri(4),
    tier: 5,
    req: { level: 28 },
    value: 900,
    unique: true,
    tags: ['unique', 'melee-armour', 'strength-gear'],
    focus: 'melee',
    ph: ph('§5.3', 'Act 2 (route A) boss unique: body'),
  },
  {
    id: 'warplate_tassets',
    name: 'Warplate tassets',
    kind: 'armour',
    slot: 'legs',
    examine: 'Plated skirts that clank menacingly.',
    attack: tri(0, -4, -10),
    defence: tri(38, 34, -2),
    strength: tri(2),
    tier: 5,
    req: { level: 28 },
    value: 800,
    unique: true,
    tags: ['unique', 'melee-armour', 'strength-gear'],
    focus: 'melee',
    ph: ph('§5.3', 'Act 2 (route A) boss unique: legs'),
  },
  // Act 2 route B boss
  {
    id: 'hellforged_spear',
    name: 'Hellforged spear',
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Its tip never cools.',
    attack: tri(40),
    strength: tri(36),
    weapon: {
      style: 'melee',
      speed: 5,
      range: 1,
      special: { name: 'Pin', cost: 25, effect: 'stun', description: 'Pins the target so it skips its next attack.' },
    },
    tier: 5,
    req: { level: 28 },
    value: 900,
    unique: true,
    tags: ['unique', 'melee-weapon', 'spec'],
    focus: 'melee',
    ph: ph('§5.3', 'Act 2 (route B) boss unique'),
  },
  // Act 3 boss
  {
    id: 'crimson_reaper',
    name: 'Crimson reaper',
    kind: 'weapon',
    slot: 'weapon',
    examine: 'A great curved blade that drinks the light.',
    attack: tri(62),
    strength: tri(70),
    weapon: { style: 'melee', speed: 5, range: 1, twoHanded: true },
    tier: 6,
    req: { level: 45 },
    value: 2500,
    unique: true,
    tags: ['unique', 'melee-weapon', 'strength-gear'],
    focus: 'melee',
    ph: ph('§5.3', 'Act 3 raid unique: top melee weapon'),
  },
  {
    id: 'crimson_rapier',
    name: 'Crimson rapier',
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Light, fast and wickedly sharp.',
    attack: tri(58),
    strength: tri(48),
    weapon: { style: 'melee', speed: 4, range: 1 },
    tier: 6,
    req: { level: 42 },
    value: 1800,
    unique: true,
    tags: ['unique', 'melee-weapon', 'accurate'],
    focus: 'melee',
    ph: ph('§5.3', 'Act 3 raid unique: fast melee weapon'),
  },
  {
    id: 'bloodglass_staff',
    name: 'Bloodglass staff',
    kind: 'weapon',
    slot: 'weapon',
    examine: 'A powered staff whose spell sometimes heals you.',
    attack: tri(0, 0, 32),
    strength: tri(0, 0, 5),
    defence: tri(3, 3, 15),
    weapon: { style: 'magic', speed: 4, range: 7, poweredMaxHit: 28, twoHanded: true },
    passive: [{ mod: 'healOnKill', value: 3 }],
    tier: 6,
    req: { level: 42 },
    value: 1800,
    unique: true,
    tags: ['unique', 'magic-weapon'],
    focus: 'magic',
    ph: ph('§5.3', 'Act 3 raid unique: powered staff'),
  },
  {
    id: 'vesper_defender',
    name: 'Vesper defender',
    kind: 'armour',
    slot: 'shield',
    examine: 'A crimson parrying blade.',
    attack: tri(24),
    strength: tri(8),
    defence: tri(20, 20, 8),
    tier: 6,
    req: { level: 40 },
    value: 1400,
    unique: true,
    tags: ['unique', 'melee-armour', 'strength-gear'],
    focus: 'melee',
    ph: ph('§5.3', 'Act 3 raid unique: melee off-hand'),
  },
  // Finale
  {
    id: 'eclipse_staff',
    name: 'Eclipse staff',
    kind: 'weapon',
    slot: 'weapon',
    examine: 'The strongest powered staff you have ever held.',
    attack: tri(0, 0, 40),
    strength: tri(0, 0, 15),
    defence: tri(4, 4, 20),
    weapon: { style: 'magic', speed: 5, range: 8, poweredMaxHit: 38, twoHanded: true },
    tier: 6,
    req: { level: 50 },
    value: 4000,
    unique: true,
    tags: ['unique', 'magic-weapon'],
    focus: 'magic',
    ph: ph('§5.3', 'Finale raid unique: top magic weapon'),
  },
  {
    id: 'jackal_fang',
    name: 'Jackal fang',
    kind: 'weapon',
    slot: 'weapon',
    examine: 'Unnervingly accurate.',
    attack: tri(70),
    strength: tri(52),
    weapon: { style: 'melee', speed: 5, range: 1 },
    passive: [{ mod: 'accMelee', value: 10 }],
    tier: 6,
    req: { level: 48 },
    value: 3000,
    unique: true,
    tags: ['unique', 'melee-weapon', 'accurate'],
    focus: 'melee',
    ph: ph('§5.3', 'Finale raid unique: accurate melee weapon'),
  },
  {
    id: 'sunflare_bow',
    name: 'Sunflare bow',
    kind: 'weapon',
    slot: 'weapon',
    examine: 'A bow that never runs out of arrows.',
    attack: tri(0, 64),
    strength: tri(0, 40),
    weapon: { style: 'ranged', speed: 4, range: 9, twoHanded: true },
    passive: [{ mod: 'ammoSave', value: 100 }],
    tier: 6,
    req: { level: 48 },
    value: 3200,
    unique: true,
    tags: ['unique', 'ranged-weapon'],
    focus: 'ranged',
    ph: ph('§5.3', 'Finale raid unique: top ranged weapon (no ammo needed)'),
  },
  {
    id: 'sunweave_cowl',
    name: 'Sunweave cowl',
    kind: 'armour',
    slot: 'head',
    examine: 'Golden thread, desert-cool.',
    attack: tri(0, 12),
    strength: tri(0, 2),
    defence: tri(12, 14, 10),
    tier: 6,
    req: { level: 45 },
    value: 1500,
    unique: true,
    tags: ['unique', 'ranged-armour'],
    focus: 'ranged',
    ph: ph('§5.3', 'Finale raid unique: ranged armour (head)'),
  },
  {
    id: 'sunweave_body',
    name: 'Sunweave body',
    kind: 'armour',
    slot: 'body',
    examine: 'Golden thread, desert-cool.',
    attack: tri(0, 36),
    strength: tri(0, 4),
    defence: tri(52, 58, 40),
    tier: 6,
    req: { level: 45 },
    value: 2000,
    unique: true,
    tags: ['unique', 'ranged-armour'],
    focus: 'ranged',
    ph: ph('§5.3', 'Finale raid unique: ranged armour (body)'),
  },
  {
    id: 'sunweave_chaps',
    name: 'Sunweave chaps',
    kind: 'armour',
    slot: 'legs',
    examine: 'Golden thread, desert-cool.',
    attack: tri(0, 24),
    strength: tri(0, 2),
    defence: tri(34, 38, 26),
    tier: 6,
    req: { level: 45 },
    value: 1800,
    unique: true,
    tags: ['unique', 'ranged-armour'],
    focus: 'ranged',
    ph: ph('§5.3', 'Finale raid unique: ranged armour (legs)'),
  },
  {
    id: 'tidestone_ward',
    name: 'Tidestone ward',
    kind: 'armour',
    slot: 'shield',
    examine: 'A shield that drinks prayer drain like water.',
    attack: tri(0, 0, 8),
    defence: tri(46, 46, 46),
    prayer: 8,
    passive: [{ mod: 'prayerDrain', value: -15 }],
    tier: 6,
    req: { level: 45 },
    value: 2200,
    unique: true,
    tags: ['unique'],
    ph: ph('§5.3', 'Finale raid unique: defensive shield'),
  },
  {
    id: 'dawnlit_ring',
    name: 'Dawnlit ring',
    kind: 'jewellery',
    slot: 'ring',
    examine: 'Special-attack energy returns twice as fast.',
    attack: tri(4, 4, 4),
    passive: [{ mod: 'specRegen', value: 100 }],
    tier: 6,
    req: { level: 40 },
    value: 1600,
    unique: true,
    tags: ['unique'],
    ph: ph('§5.3', 'Finale raid unique: special-attack ring'),
  },
  // Volcanic route
  {
    id: 'ember_cape',
    name: 'Ember cape',
    kind: 'armour',
    slot: 'cape',
    examine: 'Proof you walked out of the Cinder Pits.',
    attack: tri(4, 4, 4),
    strength: tri(8, 2, 1),
    defence: tri(11, 11, 11),
    prayer: 2,
    tier: 6,
    req: { level: 1 },
    value: 1000,
    unique: true,
    tags: ['unique', 'cape'],
    ph: ph('§3.1', 'Volcanic route reward cape'),
  },
];
UNIQUES.forEach(add);

/* ------------------------------------------------------------------ */
/* Pets (cosmetic, shown in the Collection Log)                         */
/* ------------------------------------------------------------------ */

const PET_ITEMS: [string, string, string][] = [
  ['pet_brakka_whelp', 'Brakka whelp', 'Act 2 (route A) boss pet'],
  ['pet_little_vesper', 'Little Vesper', 'Act 3 raid pet'],
  ['pet_colossus_pup', 'Colossus pup', 'Finale raid pet'],
  ['pet_cinder_cub', 'Cinder cub', 'Volcanic route pet'],
];
for (const [id, name, slot] of PET_ITEMS) {
  add({
    id,
    name,
    kind: 'misc',
    examine: 'A loyal companion. Pick it in the Menagerie.',
    tier: 6,
    value: 0,
    unique: true,
    tags: ['pet'],
    ph: ph('§7.3', slot),
  });
}

/* ------------------------------------------------------------------ */

export const ITEMS: ItemDef[] = items;
