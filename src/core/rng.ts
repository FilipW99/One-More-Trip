/**
 * Small seeded RNG (mulberry32). State is a single 32-bit number so runs can be
 * saved and resumed deterministically.
 */
export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error('pick from empty list');
    return list[Math.floor(this.next() * list.length)];
  }

  /** Pick by weight. Entries with weight <= 0 are skipped. Returns undefined if nothing is pickable. */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T | undefined {
    let total = 0;
    for (const e of entries) if (e.weight > 0) total += e.weight;
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const e of entries) {
      if (e.weight <= 0) continue;
      roll -= e.weight;
      if (roll < 0) return e.value;
    }
    return entries.filter((e) => e.weight > 0).at(-1)?.value;
  }

  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** Stochastic rounding: 2.3 becomes 3 with 30% probability, else 2. */
  round(x: number): number {
    const f = Math.floor(x);
    return f + (this.next() < x - f ? 1 : 0);
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
