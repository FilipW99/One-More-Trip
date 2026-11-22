/**
 * Canvas renderer for a fight. Reads the headless Encounter and draws it with
 * smooth movement between ticks, hitsplats, projectiles, telegraphs and hazards.
 */
import type { ActTheme, Focus } from '../content/types';
import { PLAYER_ID, type Encounter, type Enemy } from '../core/combat/engine';
import type { Pos } from '../core/combat/geometry';
import { assetImage, drawMonster, drawPet, drawPlayer, STYLE_COLORS } from './placeholders';

interface Splat {
  target: number;
  text: string;
  kind: 'hit' | 'miss' | 'heal' | 'blocked' | 'big';
  born: number;
  dx: number;
}

interface Label {
  target: number;
  text: string;
  color: string;
  born: number;
  until: number;
}

export interface DrawOpts {
  theme: ActTheme;
  actId: string;
  focus: Focus;
  pet: string | null;
  protect: 'melee' | 'ranged' | 'magic' | null;
  playerMaxHp: number;
  hover: Pos | null;
  paused: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class ArenaRenderer {
  readonly g: CanvasRenderingContext2D;
  tile = 48;
  offX = 0;
  offY = 0;
  private splats: Splat[] = [];
  private labels: Label[] = [];
  private tickStart = performance.now();
  private marker: { pos: Pos; born: number } | null = null;
  private petPos: { x: number; y: number } | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    public tickMs: number,
  ) {
    this.g = canvas.getContext('2d')!;
  }

  /** Fit the arena into the canvas's CSS size (handles DPR). */
  layout(enc: Encounter): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 640;
    const hgt = this.canvas.clientHeight || 520;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hgt * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hgt * dpr);
    }
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tile = Math.floor(Math.min(w / enc.grid.w, hgt / enc.grid.h));
    this.offX = Math.floor((w - this.tile * enc.grid.w) / 2);
    this.offY = Math.floor((hgt - this.tile * enc.grid.h) / 2);
  }

  tileAt(clientX: number, clientY: number, enc: Encounter): Pos | null {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left - this.offX) / this.tile);
    const y = Math.floor((clientY - r.top - this.offY) / this.tile);
    if (x < 0 || y < 0 || x >= enc.grid.w || y >= enc.grid.h) return null;
    return { x, y };
  }

  setMarker(pos: Pos): void {
    this.marker = { pos, born: performance.now() };
  }

  /** Call right after each stepEncounter: records timing and turns events into splats. */
  onTick(enc: Encounter): void {
    const now = performance.now();
    this.tickStart = now;
    for (const ev of enc.events) {
      if (ev.t === 'hit') {
        this.splats.push({ target: ev.target, text: String(ev.amount), kind: ev.blocked === 'full' ? 'blocked' : ev.amount >= 20 ? 'big' : 'hit', born: now, dx: (Math.random() - 0.5) * 0.4 });
      } else if (ev.t === 'miss') {
        this.splats.push({ target: ev.target, text: '0', kind: 'miss', born: now, dx: (Math.random() - 0.5) * 0.4 });
      } else if (ev.t === 'heal' && ev.amount > 0) {
        this.splats.push({ target: ev.target, text: `+${ev.amount}`, kind: 'heal', born: now, dx: 0 });
      } else if (ev.t === 'telegraph') {
        this.labels.push({ target: ev.source, text: ev.name, color: STYLE_COLORS[ev.style], born: now, until: now + Math.max(1, ev.ticks) * this.tickMs + 200 });
      } else if (ev.t === 'special') {
        this.labels.push({ target: PLAYER_ID, text: ev.name, color: '#ffcf40', born: now, until: now + 1200 });
      }
    }
    if (this.marker && enc.player.path.length === 0 && enc.player.pos.x === this.marker.pos.x && enc.player.pos.y === this.marker.pos.y) this.marker = null;
  }

  private alpha(now: number): number {
    return Math.max(0, Math.min(1, (now - this.tickStart) / this.tickMs));
  }

  private entityPx(enc: Encounter, id: number, a: number): { x: number; y: number; size: number } | null {
    if (id === PLAYER_ID) {
      const p = enc.player;
      return { x: lerp(p.prevPos.x, p.pos.x, a), y: lerp(p.prevPos.y, p.pos.y, a), size: 1 };
    }
    const e = enc.enemies.find((x) => x.id === id);
    if (!e) return null;
    return { x: lerp(e.prevPos.x, e.pos.x, a), y: lerp(e.prevPos.y, e.pos.y, a), size: e.size };
  }

  private toPx(tx: number, ty: number): { x: number; y: number } {
    return { x: this.offX + tx * this.tile, y: this.offY + ty * this.tile };
  }

  draw(enc: Encounter, now: number, o: DrawOpts): void {
    this.layout(enc);
    const g = this.g;
    const T = this.tile;
    const a = enc.result ? 1 : o.paused ? 1 : this.alpha(now);
    const w = this.canvas.clientWidth;
    const hgt = this.canvas.clientHeight;

    g.fillStyle = o.theme.fog;
    g.fillRect(0, 0, w, hgt);

    // Floor and walls.
    const floorImg = assetImage(`tile:${o.actId}:floor`);
    const wallImg = assetImage(`tile:${o.actId}:wall`);
    for (let y = 0; y < enc.grid.h; y++) {
      for (let x = 0; x < enc.grid.w; x++) {
        const p = this.toPx(x, y);
        const blocked = enc.grid.blocked[y * enc.grid.w + x] === 1;
        if (blocked) {
          if (wallImg) g.drawImage(wallImg, p.x, p.y, T, T);
          else {
            g.fillStyle = o.theme.wall;
            g.fillRect(p.x, p.y, T, T);
            g.fillStyle = 'rgba(255,255,255,0.06)';
            g.fillRect(p.x + 3, p.y + 3, T - 6, T * 0.3);
            g.strokeStyle = 'rgba(0,0,0,0.5)';
            g.strokeRect(p.x + 0.5, p.y + 0.5, T - 1, T - 1);
          }
        } else if (floorImg) g.drawImage(floorImg, p.x, p.y, T, T);
        else {
          g.fillStyle = (x + y) % 2 === 0 ? o.theme.floor : o.theme.floorAlt;
          g.fillRect(p.x, p.y, T, T);
        }
      }
    }
    // Subtle grid.
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    for (let x = 0; x <= enc.grid.w; x++) {
      g.beginPath();
      g.moveTo(this.offX + x * T + 0.5, this.offY);
      g.lineTo(this.offX + x * T + 0.5, this.offY + enc.grid.h * T);
      g.stroke();
    }
    for (let y = 0; y <= enc.grid.h; y++) {
      g.beginPath();
      g.moveTo(this.offX, this.offY + y * T + 0.5);
      g.lineTo(this.offX + enc.grid.w * T, this.offY + y * T + 0.5);
      g.stroke();
    }

    // Hazards (telegraphed ground attacks).
    for (const hz of enc.hazards) {
      const total = Math.max(1, hz.impactTick - hz.startTick);
      const left = hz.impactTick - enc.tick;
      const prog = Math.max(0, Math.min(1, (enc.tick - hz.startTick + a) / total));
      for (const t of hz.tiles) {
        const p = this.toPx(t.x, t.y);
        g.fillStyle = `rgba(230, 90, 30, ${0.18 + prog * 0.45})`;
        g.fillRect(p.x + 1, p.y + 1, T - 2, T - 2);
        g.strokeStyle = `rgba(255, 200, 80, ${0.5 + 0.5 * Math.sin(now / 90)})`;
        g.lineWidth = 2;
        g.strokeRect(p.x + 2, p.y + 2, T - 4, T - 4);
      }
      if (hz.tiles[0] && left >= 0) {
        const p = this.toPx(hz.tiles[0].x, hz.tiles[0].y);
        g.fillStyle = '#fff';
        g.font = `bold ${Math.round(T * 0.3)}px system-ui, sans-serif`;
        g.textAlign = 'left';
        g.textBaseline = 'top';
        g.fillText(String(left), p.x + 4, p.y + 3);
      }
    }

    // Hover tile and move marker.
    if (o.hover) {
      const p = this.toPx(o.hover.x, o.hover.y);
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 2;
      g.strokeRect(p.x + 1, p.y + 1, T - 2, T - 2);
    }
    if (this.marker) {
      const p = this.toPx(this.marker.pos.x, this.marker.pos.y);
      const age = (now - this.marker.born) / 400;
      g.strokeStyle = `rgba(255, 220, 60, ${Math.max(0.3, 1 - age)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(p.x + T * 0.3, p.y + T * 0.3);
      g.lineTo(p.x + T * 0.7, p.y + T * 0.7);
      g.moveTo(p.x + T * 0.7, p.y + T * 0.3);
      g.lineTo(p.x + T * 0.3, p.y + T * 0.7);
      g.stroke();
    }

    // Enemies (bigger first so small ones draw on top).
    const enemies = enc.enemies.filter((e) => !e.dead).sort((x, y) => y.size - x.size);
    for (const e of enemies) this.drawEnemy(e, enc, a, now);

    // Pet follows a step behind.
    const pp = this.entityPx(enc, PLAYER_ID, a)!;
    if (o.pet) {
      const target = { x: pp.x - 0.6, y: pp.y + 0.4 };
      this.petPos = this.petPos ? { x: lerp(this.petPos.x, target.x, 0.08), y: lerp(this.petPos.y, target.y, 0.08) } : target;
      const p = this.toPx(this.petPos.x, this.petPos.y);
      drawPet(g, o.pet, p.x + T * 0.15, p.y + T * 0.15, T * 0.7);
    }

    // Player.
    const ppx = this.toPx(pp.x, pp.y);
    if (enc.player.target !== null) {
      const t = enc.enemies.find((x) => x.id === enc.player.target && !x.dead);
      if (t) {
        const tp = this.entityPx(enc, t.id, a)!;
        const q = this.toPx(tp.x, tp.y);
        g.strokeStyle = 'rgba(255, 230, 80, 0.85)';
        g.lineWidth = 2;
        g.setLineDash([5, 4]);
        g.strokeRect(q.x + 2, q.y + 2, t.size * T - 4, t.size * T - 4);
        g.setLineDash([]);
      }
    }
    drawPlayer(g, o.focus, ppx.x, ppx.y, T);
    if (o.protect) this.overheadIcon(ppx.x + T / 2, ppx.y - T * 0.12, o.protect);
    const run = enc.ctx.run;
    this.hpBar(ppx.x, ppx.y - 4, T, run.hp, o.playerMaxHp);

    // Projectiles.
    for (const pr of enc.projectiles) {
      const span = Math.max(1, pr.impactTick - pr.launchTick);
      const t = Math.max(0, Math.min(1, (enc.tick - pr.launchTick + a) / span));
      const from = this.entityPx(enc, pr.from, a) ?? { ...pr.fromPos, size: 1 };
      const to = this.entityPx(enc, pr.to, a) ?? { ...pr.toPos, size: 1 };
      const fx = from.x + from.size / 2;
      const fy = from.y + from.size / 2;
      const tx = to.x + to.size / 2;
      const ty = to.y + to.size / 2;
      const x = this.offX + lerp(fx, tx, t) * T;
      const y = this.offY + lerp(fy, ty, t) * T - Math.sin(t * Math.PI) * T * 0.4;
      const color = STYLE_COLORS[pr.style];
      g.save();
      g.shadowColor = color;
      g.shadowBlur = 10;
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, Math.max(3, T * (pr.from === PLAYER_ID ? 0.09 : 0.13)), 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // Hitsplats.
    this.splats = this.splats.filter((s) => now - s.born < 1000);
    for (const s of this.splats) {
      const e = this.entityPx(enc, s.target, a);
      if (!e) continue;
      const age = (now - s.born) / 1000;
      const cx = this.offX + (e.x + e.size / 2 + s.dx) * T;
      const cy = this.offY + (e.y + e.size / 2) * T - age * T * 0.6;
      this.splat(cx, cy, s);
    }

    // Labels (telegraphs, specials).
    this.labels = this.labels.filter((l) => now < l.until);
    for (const l of this.labels) {
      const e = this.entityPx(enc, l.target, a);
      if (!e) continue;
      const cx = this.offX + (e.x + e.size / 2) * T;
      const cy = this.offY + e.y * T - T * 0.35;
      g.font = `bold ${Math.max(12, Math.round(T * 0.3))}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.lineWidth = 3;
      g.strokeStyle = '#000';
      g.strokeText(l.text, cx, cy);
      g.fillStyle = l.color;
      g.fillText(l.text, cx, cy);
    }

    if (o.paused && !enc.result) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, 0, w, hgt);
      g.fillStyle = '#fff';
      g.font = 'bold 28px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Paused (P to resume)', w / 2, hgt / 2);
    }
  }

  private drawEnemy(e: Enemy, enc: Encounter, a: number, now: number): void {
    const g = this.g;
    const T = this.tile;
    const pos = this.entityPx(enc, e.id, a)!;
    const p = this.toPx(pos.x, pos.y);
    const px = e.size * T;
    // Windup telegraph: pulsing ring in the attack's style colour.
    if (e.windup) {
      const color = STYLE_COLORS[e.windup.attack.style];
      const pulse = 0.5 + 0.5 * Math.sin(now / 80);
      g.save();
      g.strokeStyle = color;
      g.lineWidth = 3 + pulse * 3;
      g.shadowColor = color;
      g.shadowBlur = 12;
      g.beginPath();
      g.ellipse(p.x + px / 2, p.y + px / 2, px * 0.55, px * 0.55, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    if (e.superior || e.elite) {
      g.save();
      g.strokeStyle = e.superior ? 'rgba(255,80,255,0.7)' : 'rgba(255,200,60,0.6)';
      g.lineWidth = 2;
      g.setLineDash([3, 3]);
      g.strokeRect(p.x + 3, p.y + 3, px - 6, px - 6);
      g.restore();
    }
    drawMonster(g, e.def, Boolean(e.boss), p.x, p.y, px, now);
    if (e.bound > 0) {
      g.strokeStyle = 'rgba(120,200,255,0.8)';
      g.lineWidth = 2;
      g.strokeRect(p.x + 4, p.y + px - 10, px - 8, 6);
    }
    this.hpBar(p.x, p.y - 4, px, e.hp, e.maxHp);
  }

  private hpBar(x: number, y: number, w: number, hp: number, max: number): void {
    const g = this.g;
    const bw = Math.max(24, w * 0.8);
    const bx = x + (w - bw) / 2;
    const frac = Math.max(0, Math.min(1, hp / Math.max(1, max)));
    g.fillStyle = '#7a1010';
    g.fillRect(bx, y - 5, bw, 5);
    g.fillStyle = '#2ecc40';
    g.fillRect(bx, y - 5, bw * frac, 5);
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1;
    g.strokeRect(bx + 0.5, y - 5.5, bw, 6);
  }

  private overheadIcon(cx: number, cy: number, style: 'melee' | 'ranged' | 'magic'): void {
    const g = this.g;
    const r = Math.max(8, this.tile * 0.18);
    g.save();
    g.fillStyle = '#f5f0d0';
    g.strokeStyle = STYLE_COLORS[style];
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy - r, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = STYLE_COLORS[style];
    g.font = `bold ${Math.round(r * 1.2)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(style === 'melee' ? '⚔' : style === 'ranged' ? '➶' : '✦', cx, cy - r + 1);
    g.restore();
  }

  private splat(cx: number, cy: number, s: Splat): void {
    const g = this.g;
    const r = Math.max(11, this.tile * 0.24);
    const colors: Record<Splat['kind'], string> = { hit: '#b3201b', big: '#e8501b', miss: '#2b5da8', heal: '#2e9e47', blocked: '#6c6c6c' };
    g.save();
    g.fillStyle = colors[s.kind];
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s.text, cx, cy + 1);
    g.restore();
  }
}
