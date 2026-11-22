/**
 * PLACEHOLDER ART.
 *
 * Every image in the game goes through this module. If an image file is mapped to
 * the asset key (src/content/assets.ts ASSET_FILES or public/assets/manifest.json),
 * that image is used. Otherwise a simple procedural shape is drawn so the game runs
 * with no art at all. Replacing art never needs code changes: add files + map keys.
 */
import { ASSET_FILES, ASSET_MANIFEST_URL, PLACEHOLDER_COLORS } from '../content/assets';
import { C } from '../content';
import type { CombatStyle, Focus, ItemDef, MonsterDef } from '../content/types';

const images = new Map<string, HTMLImageElement>();
const iconCache = new Map<string, string>();
let overrides: Record<string, string> = { ...ASSET_FILES };

/** Load public/assets/manifest.json (if present) and preload every mapped image. */
export async function loadAssets(): Promise<number> {
  try {
    const res = await fetch(ASSET_MANIFEST_URL, { cache: 'no-cache' });
    if (res.ok) {
      const json = (await res.json()) as Record<string, string>;
      overrides = { ...overrides, ...json };
    }
  } catch {
    // No manifest: placeholders only.
  }
  const entries = Object.entries(overrides).filter(([k]) => !k.startsWith('//'));
  await Promise.all(
    entries.map(
      ([key, path]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(key, img);
            resolve();
          };
          img.onerror = () => {
            console.warn(`[assets] Could not load ${path} for ${key}; using placeholder.`);
            resolve();
          };
          img.src = `assets/${path}`;
        }),
    ),
  );
  iconCache.clear();
  return images.size;
}

/** The loaded override image for an asset key, if any. */
export function assetImage(key: string): HTMLImageElement | null {
  return images.get(key) ?? null;
}

export function hasOverride(key: string): boolean {
  return images.has(key);
}

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

const MATERIALS = ['bronze', 'iron', 'steel', 'cobalt', 'orichalcum', 'starmetal', 'leather', 'drakehide'];

export function itemColor(def: ItemDef): string {
  if (def.unique) return PLACEHOLDER_COLORS.unique;
  const mat = MATERIALS.find((m) => def.id.startsWith(`${m}_`) || def.tags.includes(m));
  if (mat) return PLACEHOLDER_COLORS[mat];
  switch (def.kind) {
    case 'food':
      return PLACEHOLDER_COLORS.food;
    case 'potion':
      return PLACEHOLDER_COLORS.potion;
    case 'rune':
      return PLACEHOLDER_COLORS.rune;
    case 'jewellery':
      return PLACEHOLDER_COLORS.gem;
    default:
      break;
  }
  if (def.weapon?.style === 'magic' || def.tags.includes('magic-armour')) return PLACEHOLDER_COLORS.magic;
  if (def.weapon?.style === 'ranged') return PLACEHOLDER_COLORS.wood;
  return PLACEHOLDER_COLORS.misc;
}

export const STYLE_COLORS: Record<CombatStyle | 'typeless', string> = {
  melee: '#e05a47',
  ranged: '#5fbf5f',
  magic: '#5f8fe8',
  typeless: '#e8b64c',
};

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/* ------------------------------------------------------------------ */
/* Item icons                                                          */
/* ------------------------------------------------------------------ */

type Shape =
  | 'sword'
  | 'mace'
  | 'spear'
  | 'dagger'
  | 'bow'
  | 'crossbow'
  | 'staff'
  | 'helm'
  | 'body'
  | 'legs'
  | 'shield'
  | 'boots'
  | 'gloves'
  | 'cape'
  | 'ring'
  | 'amulet'
  | 'arrows'
  | 'knife'
  | 'food'
  | 'potion'
  | 'rune'
  | 'book'
  | 'casket'
  | 'ore'
  | 'log'
  | 'gem'
  | 'bag';

function itemShape(def: ItemDef): Shape {
  const n = def.id;
  if (def.kind === 'weapon') {
    if (def.weapon?.ammo === 'thrown' || n.includes('knife') || n.includes('dart')) return 'knife';
    if (n.includes('crossbow') || def.tags.includes('crossbow')) return 'crossbow';
    if (def.weapon?.style === 'ranged') return 'bow';
    if (def.weapon?.style === 'magic') return 'staff';
    if (/mace|hammer|cudgel|maul/.test(n)) return 'mace';
    if (/spear|halberd|scythe|reaper/.test(n)) return 'spear';
    if (/dagger|fang/.test(n)) return 'dagger';
    return 'sword';
  }
  if (def.kind === 'ammo') return def.ammoType === 'thrown' ? 'knife' : 'arrows';
  if (def.kind === 'food') return 'food';
  if (def.kind === 'potion') return 'potion';
  if (def.kind === 'rune') return 'rune';
  if (def.kind === 'tome') return 'book';
  if (def.kind === 'casket') return 'casket';
  if (def.kind === 'resource') {
    if (n.includes('ore')) return 'ore';
    if (n.includes('log')) return 'log';
    if (n.includes('gem')) return 'gem';
    return 'bag';
  }
  switch (def.slot) {
    case 'head':
      return 'helm';
    case 'body':
      return 'body';
    case 'legs':
      return 'legs';
    case 'shield':
      return 'shield';
    case 'feet':
      return 'boots';
    case 'hands':
      return 'gloves';
    case 'cape':
      return 'cape';
    case 'ring':
      return 'ring';
    case 'neck':
      return 'amulet';
    default:
      return 'bag';
  }
}

function drawShape(g: CanvasRenderingContext2D, shape: Shape, color: string, s: number): void {
  const dark = shade(color, -60);
  const light = shade(color, 50);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = dark;
  g.fillStyle = color;
  g.lineWidth = s * 0.06;
  const P = (x: number) => x * s;
  const poly = (pts: number[][], fill = true) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(P(x), P(y)) : g.moveTo(P(x), P(y))));
    g.closePath();
    if (fill) g.fill();
    g.stroke();
  };
  const handle = '#6b4a2b';
  switch (shape) {
    case 'sword':
      poly([[0.78, 0.12], [0.88, 0.22], [0.42, 0.68], [0.32, 0.58]]);
      g.strokeStyle = handle;
      g.lineWidth = s * 0.1;
      g.beginPath(); g.moveTo(P(0.32), P(0.68)); g.lineTo(P(0.16), P(0.84)); g.stroke();
      g.strokeStyle = dark; g.lineWidth = s * 0.08;
      g.beginPath(); g.moveTo(P(0.24), P(0.56)); g.lineTo(P(0.44), P(0.76)); g.stroke();
      break;
    case 'dagger':
      poly([[0.68, 0.22], [0.76, 0.3], [0.46, 0.62], [0.38, 0.54]]);
      g.strokeStyle = handle; g.lineWidth = s * 0.1;
      g.beginPath(); g.moveTo(P(0.38), P(0.62)); g.lineTo(P(0.24), P(0.76)); g.stroke();
      break;
    case 'mace':
      g.strokeStyle = handle; g.lineWidth = s * 0.1;
      g.beginPath(); g.moveTo(P(0.2), P(0.84)); g.lineTo(P(0.6), P(0.42)); g.stroke();
      g.strokeStyle = dark; g.lineWidth = s * 0.06;
      g.beginPath(); g.arc(P(0.66), P(0.34), P(0.18), 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'spear':
      g.strokeStyle = handle; g.lineWidth = s * 0.08;
      g.beginPath(); g.moveTo(P(0.14), P(0.88)); g.lineTo(P(0.7), P(0.32)); g.stroke();
      g.strokeStyle = dark; g.lineWidth = s * 0.05;
      poly([[0.88, 0.12], [0.62, 0.28], [0.72, 0.38]]);
      break;
    case 'bow':
      g.strokeStyle = color; g.lineWidth = s * 0.1;
      g.beginPath(); g.arc(P(0.3), P(0.5), P(0.38), -1.1, 1.1); g.stroke();
      g.strokeStyle = '#ddd'; g.lineWidth = s * 0.025;
      g.beginPath(); g.moveTo(P(0.47), P(0.16)); g.lineTo(P(0.47), P(0.84)); g.stroke();
      break;
    case 'crossbow':
      g.strokeStyle = handle; g.lineWidth = s * 0.1;
      g.beginPath(); g.moveTo(P(0.5), P(0.2)); g.lineTo(P(0.5), P(0.88)); g.stroke();
      g.strokeStyle = color; g.lineWidth = s * 0.09;
      g.beginPath(); g.arc(P(0.5), P(0.62), P(0.34), -2.6, -0.54); g.stroke();
      break;
    case 'staff':
      g.strokeStyle = handle; g.lineWidth = s * 0.08;
      g.beginPath(); g.moveTo(P(0.2), P(0.88)); g.lineTo(P(0.68), P(0.3)); g.stroke();
      g.fillStyle = color; g.strokeStyle = light; g.lineWidth = s * 0.04;
      g.beginPath(); g.arc(P(0.72), P(0.24), P(0.13), 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'helm':
      g.beginPath(); g.arc(P(0.5), P(0.56), P(0.3), Math.PI, 0); g.lineTo(P(0.8), P(0.78)); g.lineTo(P(0.2), P(0.78)); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.fillRect(P(0.3), P(0.56), P(0.4), P(0.07));
      break;
    case 'body':
      poly([[0.3, 0.16], [0.7, 0.16], [0.9, 0.34], [0.78, 0.46], [0.72, 0.4], [0.72, 0.86], [0.28, 0.86], [0.28, 0.4], [0.22, 0.46], [0.1, 0.34]]);
      break;
    case 'legs':
      poly([[0.26, 0.14], [0.74, 0.14], [0.78, 0.88], [0.56, 0.88], [0.5, 0.42], [0.44, 0.88], [0.22, 0.88]]);
      break;
    case 'shield':
      poly([[0.2, 0.16], [0.8, 0.16], [0.8, 0.5], [0.5, 0.88], [0.2, 0.5]]);
      g.strokeStyle = light; g.beginPath(); g.moveTo(P(0.5), P(0.22)); g.lineTo(P(0.5), P(0.76)); g.stroke();
      break;
    case 'boots':
      poly([[0.3, 0.18], [0.5, 0.18], [0.5, 0.6], [0.82, 0.66], [0.82, 0.84], [0.3, 0.84]]);
      break;
    case 'gloves':
      poly([[0.3, 0.84], [0.3, 0.36], [0.4, 0.2], [0.5, 0.36], [0.58, 0.2], [0.68, 0.36], [0.76, 0.3], [0.76, 0.84]]);
      break;
    case 'cape':
      poly([[0.34, 0.14], [0.66, 0.14], [0.84, 0.86], [0.16, 0.86]]);
      break;
    case 'ring':
      g.strokeStyle = '#d4af37'; g.lineWidth = s * 0.09;
      g.beginPath(); g.arc(P(0.5), P(0.58), P(0.22), 0, Math.PI * 2); g.stroke();
      g.fillStyle = color; g.strokeStyle = dark; g.lineWidth = s * 0.04;
      g.beginPath(); g.arc(P(0.5), P(0.33), P(0.1), 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'amulet':
      g.strokeStyle = '#d4af37'; g.lineWidth = s * 0.04;
      g.beginPath(); g.arc(P(0.5), P(0.3), P(0.26), 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = color; g.strokeStyle = dark;
      g.beginPath(); g.arc(P(0.5), P(0.66), P(0.14), 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'arrows':
    case 'knife':
      for (let i = 0; i < 3; i++) {
        const o = i * 0.12 - 0.12;
        g.strokeStyle = shape === 'knife' ? color : handle; g.lineWidth = s * 0.05;
        g.beginPath(); g.moveTo(P(0.2 + o), P(0.84)); g.lineTo(P(0.68 + o), P(0.24)); g.stroke();
        g.fillStyle = color; g.strokeStyle = dark; g.lineWidth = s * 0.03;
        poly([[0.76 + o, 0.14], [0.6 + o, 0.24], [0.72 + o, 0.32]]);
      }
      break;
    case 'food':
      g.beginPath(); g.ellipse(P(0.5), P(0.56), P(0.32), P(0.22), -0.3, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = light; g.beginPath(); g.ellipse(P(0.42), P(0.5), P(0.1), P(0.05), -0.3, 0, Math.PI * 2); g.fill();
      break;
    case 'potion':
      g.fillStyle = '#cfd8dc';
      g.fillRect(P(0.42), P(0.12), P(0.16), P(0.2));
      g.fillStyle = color;
      g.beginPath(); g.arc(P(0.5), P(0.6), P(0.26), 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#8d6e63'; g.fillRect(P(0.4), P(0.08), P(0.2), P(0.08));
      break;
    case 'rune':
      g.beginPath(); g.ellipse(P(0.5), P(0.52), P(0.32), P(0.28), 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = light; g.lineWidth = s * 0.06;
      g.beginPath(); g.moveTo(P(0.4), P(0.38)); g.lineTo(P(0.6), P(0.52)); g.lineTo(P(0.42), P(0.66)); g.stroke();
      break;
    case 'book':
      poly([[0.22, 0.18], [0.74, 0.18], [0.74, 0.84], [0.22, 0.84]]);
      g.strokeStyle = light; g.beginPath(); g.moveTo(P(0.32), P(0.18)); g.lineTo(P(0.32), P(0.84)); g.stroke();
      break;
    case 'casket':
      poly([[0.16, 0.38], [0.84, 0.38], [0.84, 0.82], [0.16, 0.82]]);
      poly([[0.16, 0.38], [0.24, 0.22], [0.76, 0.22], [0.84, 0.38]]);
      g.fillStyle = '#d4af37'; g.fillRect(P(0.45), P(0.44), P(0.1), P(0.12));
      break;
    case 'ore':
      poly([[0.2, 0.6], [0.34, 0.3], [0.62, 0.24], [0.82, 0.46], [0.74, 0.78], [0.36, 0.82]]);
      break;
    case 'log':
      g.beginPath(); g.ellipse(P(0.5), P(0.5), P(0.36), P(0.16), -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
      break;
    case 'gem':
      poly([[0.5, 0.16], [0.82, 0.42], [0.5, 0.86], [0.18, 0.42]]);
      break;
    default:
      poly([[0.26, 0.3], [0.74, 0.3], [0.82, 0.84], [0.18, 0.84]]);
      g.beginPath(); g.moveTo(P(0.38), P(0.3)); g.lineTo(P(0.5), P(0.16)); g.lineTo(P(0.62), P(0.3)); g.stroke();
  }
}

function canvasUrl(size: number, draw: (g: CanvasRenderingContext2D) => void): string {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  draw(g);
  return c.toDataURL();
}

/** Data URL / path for an item icon. */
export function itemIcon(id: string): string {
  const def = C.item(id);
  const key = `item:${def.asset ?? id}`;
  const img = images.get(key);
  if (img) return img.src;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const url = canvasUrl(64, (g) => drawShape(g, itemShape(def), itemColor(def), 64));
  iconCache.set(key, url);
  return url;
}

/** Simple glyph icons (skills, prayers, rooms) with an override hook. */
export function glyphIcon(key: string, glyph: string, color: string): string {
  const img = images.get(key);
  if (img) return img.src;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const url = canvasUrl(64, (g) => {
    g.fillStyle = shade(color, -70);
    g.beginPath();
    g.arc(32, 32, 29, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 28px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph, 32, 34);
  });
  iconCache.set(key, url);
  return url;
}

/* ------------------------------------------------------------------ */
/* Sprites drawn straight onto the arena canvas                        */
/* ------------------------------------------------------------------ */

function styleGlyph(g: CanvasRenderingContext2D, style: CombatStyle, x: number, y: number, r: number): void {
  g.save();
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = Math.max(1.5, r * 0.18);
  g.lineCap = 'round';
  if (style === 'melee') {
    g.beginPath(); g.moveTo(x - r * 0.6, y + r * 0.6); g.lineTo(x + r * 0.6, y - r * 0.6); g.stroke();
    g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.6); g.lineTo(x + r * 0.6, y + r * 0.6); g.stroke();
  } else if (style === 'ranged') {
    g.beginPath(); g.arc(x - r * 0.3, y, r * 0.7, -1.1, 1.1); g.stroke();
    g.beginPath(); g.moveTo(x - r * 0.6, y); g.lineTo(x + r * 0.7, y); g.stroke();
  } else {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const px = x + Math.cos(a) * r * 0.7;
      const py = y + Math.sin(a) * r * 0.7;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Draw a monster or boss filling a (px x px) box at (x, y). */
export function drawMonster(g: CanvasRenderingContext2D, def: MonsterDef, isBoss: boolean, x: number, y: number, px: number, t: number): void {
  const img = images.get(`monster:${def.asset ?? def.id}`);
  if (img) {
    g.drawImage(img, x, y, px, px);
    return;
  }
  const cx = x + px / 2;
  const bob = Math.sin(t / 300 + def.id.length) * px * 0.02;
  const cy = y + px / 2 + bob;
  const r = px * 0.4;
  g.save();
  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(cx, y + px * 0.9, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
  g.fill();
  // Body
  const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  grad.addColorStop(0, shade(def.color, 60));
  grad.addColorStop(1, def.color);
  g.fillStyle = grad;
  g.strokeStyle = shade(def.color, -70);
  g.lineWidth = Math.max(2, px * 0.04);
  g.beginPath();
  if (def.behaviour === 'healer') g.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  else {
    // Blob with slight shoulders.
    g.moveTo(cx - r, cy + r * 0.8);
    g.quadraticCurveTo(cx - r * 1.05, cy - r * 0.9, cx, cy - r);
    g.quadraticCurveTo(cx + r * 1.05, cy - r * 0.9, cx + r, cy + r * 0.8);
    g.closePath();
  }
  g.fill();
  g.stroke();
  // Boss crown spikes
  if (isBoss) {
    g.fillStyle = '#e8b64c';
    g.strokeStyle = '#7a5a10';
    g.lineWidth = Math.max(1.5, px * 0.02);
    g.beginPath();
    const top = cy - r * 0.95;
    g.moveTo(cx - r * 0.45, top + r * 0.18);
    g.lineTo(cx - r * 0.4, top - r * 0.25);
    g.lineTo(cx - r * 0.15, top);
    g.lineTo(cx, top - r * 0.32);
    g.lineTo(cx + r * 0.15, top);
    g.lineTo(cx + r * 0.4, top - r * 0.25);
    g.lineTo(cx + r * 0.45, top + r * 0.18);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // Eyes
  g.fillStyle = '#fff';
  const ey = cy - r * 0.25;
  g.beginPath(); g.arc(cx - r * 0.3, ey, r * 0.14, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.3, ey, r * 0.14, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#111';
  g.beginPath(); g.arc(cx - r * 0.27, ey + r * 0.03, r * 0.07, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.33, ey + r * 0.03, r * 0.07, 0, Math.PI * 2); g.fill();
  // Style badge
  const br = Math.max(5, r * 0.28);
  g.fillStyle = STYLE_COLORS[def.style];
  g.beginPath();
  g.arc(cx, cy + r * 0.35, br, 0, Math.PI * 2);
  g.fill();
  styleGlyph(g, def.style, cx, cy + r * 0.35, br * 0.75);
  g.restore();
}

const FOCUS_COLORS: Record<Focus, string> = { melee: '#c0504d', ranged: '#4f9a4f', magic: '#4f6fc0' };

export function drawPlayer(g: CanvasRenderingContext2D, focus: Focus, x: number, y: number, px: number): void {
  const img = images.get(`player:${focus}`);
  if (img) {
    g.drawImage(img, x, y, px, px);
    return;
  }
  const cx = x + px / 2;
  const color = FOCUS_COLORS[focus];
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(cx, y + px * 0.9, px * 0.3, px * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  // Body
  g.fillStyle = color;
  g.strokeStyle = shade(color, -80);
  g.lineWidth = Math.max(2, px * 0.05);
  g.beginPath();
  g.moveTo(cx - px * 0.24, y + px * 0.86);
  g.lineTo(cx - px * 0.2, y + px * 0.42);
  g.quadraticCurveTo(cx, y + px * 0.34, cx + px * 0.2, y + px * 0.42);
  g.lineTo(cx + px * 0.24, y + px * 0.86);
  g.closePath();
  g.fill();
  g.stroke();
  // Head
  g.fillStyle = '#f1c27d';
  g.beginPath();
  g.arc(cx, y + px * 0.27, px * 0.14, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  styleGlyph(g, focus, cx, y + px * 0.62, px * 0.12);
  g.restore();
}

export function drawPet(g: CanvasRenderingContext2D, petId: string, x: number, y: number, px: number): void {
  const img = images.get(`pet:${petId}`);
  if (img) {
    g.drawImage(img, x, y, px, px);
    return;
  }
  const color = C.hasPet(petId) ? C.pet(petId).color : '#aaa';
  g.save();
  g.fillStyle = color;
  g.strokeStyle = shade(color, -70);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x + px / 2, y + px * 0.6, px * 0.22, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(x + px * 0.43, y + px * 0.55, px * 0.05, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + px * 0.57, y + px * 0.55, px * 0.05, 0, Math.PI * 2); g.fill();
  g.restore();
}
