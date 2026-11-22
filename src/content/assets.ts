/**
 * PLACEHOLDER ART: asset keys and image overrides.
 *
 * Every visual in the game is looked up by an asset key:
 *
 *   item:<itemId>        inventory/equipment icon (32x32 recommended)
 *   monster:<monsterId>  monster or boss sprite (64px per tile of footprint)
 *   pet:<petId>          pet sprite
 *   player:<focus>       player sprite for melee / ranged / magic
 *   tile:<actId>:floor   floor tile, tile:<actId>:wall wall tile (32x32)
 *   prayer:<prayerId>    prayer icon
 *   skill:<skillId>      skill icon
 *   room:<roomType>      map node icon
 *
 * With no override the renderer draws a procedural placeholder shape (see
 * src/render/placeholders.ts), so the game always runs without art files.
 *
 * To use real art: put image files under public/assets/ and map keys to paths
 * either here (ASSET_FILES) or in public/assets/manifest.json, which is loaded at
 * runtime and wins over this table. Paths are relative to public/assets/.
 */

export const ASSET_FILES: Record<string, string> = {
  // 'item:iron_scimitar': 'items/iron_scimitar.png',
  // 'monster:grumbold': 'monsters/grumbold.png',
};

/** Runtime override file, relative to the site root. */
export const ASSET_MANIFEST_URL = 'assets/manifest.json';

/** Placeholder palette for procedural item icons, keyed by material/style. */
export const PLACEHOLDER_COLORS: Record<string, string> = {
  bronze: '#b07a3c',
  iron: '#8d8d8d',
  steel: '#c3cad2',
  cobalt: '#3f6fd1',
  orichalcum: '#d0a33c',
  starmetal: '#9fe3ff',
  leather: '#8b5a2b',
  drakehide: '#3f8f4a',
  magic: '#7b68ee',
  wood: '#a0743c',
  food: '#e0a060',
  potion: '#4fb3d9',
  rune: '#9a9a9a',
  gem: '#5ad1c4',
  unique: '#ffcf40',
  misc: '#b0b0b0',
};
