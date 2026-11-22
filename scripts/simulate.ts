/**
 * Balance simulator: autoplays many runs and prints outcome, depth and XP stats so
 * tuning can be compared with the design doc's targets (§8.2):
 *   died in act 1: 300-500 XP, died in act 2: 800-1,200 XP, full clear: 2,000-2,800 XP.
 *
 *   npm run sim                 # default sweep
 *   npm run sim -- 200          # runs per profile
 *   npm run sim -- 100 progress # play one character from level 1 and report pacing
 */
import { botPlayRun, DEFAULT_BOT } from '../src/core/bot';
import { buildUpgrade, raiseSkill } from '../src/core/hub';
import { levelForXp, totalXpForLevel } from '../src/core/progression';
import { createCharacter, unspentPoints } from '../src/core/save';
import { startRun, storeVault } from '../src/core/run';
import type { CharacterSave } from '../src/core/state';
import type { Focus, SkillId } from '../src/content/types';

const runsPer = Number(process.argv[2] ?? 100);
const mode = process.argv[3] ?? 'sweep';
const verbose = process.argv.includes('--deaths');

interface Profile {
  label: string;
  focus: Focus;
  level: number;
  skills: Partial<Record<SkillId, number>>;
  hub?: Record<string, number>;
}

const PROFILES: Profile[] = [
  { label: 'L1 melee, no ranks', focus: 'melee', level: 1, skills: {} },
  { label: 'L1 ranged, no ranks', focus: 'ranged', level: 1, skills: {} },
  { label: 'L1 magic, no ranks', focus: 'magic', level: 1, skills: {} },
  { label: 'L10 melee', focus: 'melee', level: 10, skills: { attack: 3, strength: 3, hitpoints: 3 } },
  { label: 'L20 ranged', focus: 'ranged', level: 20, skills: { ranged: 6, prayer: 6, hitpoints: 3, fletching: 4 } },
  { label: 'L30 melee', focus: 'melee', level: 30, skills: { attack: 6, strength: 6, defence: 4, hitpoints: 6, prayer: 6, construction: 3 }, hub: { chapel: 2, workshop: 2 } },
  { label: 'L45 magic', focus: 'magic', level: 45, skills: { magic: 10, prayer: 10, hitpoints: 10, defence: 6, runecraft: 6, herblore: 6, construction: 3 }, hub: { chapel: 4, workshop: 3 } },
  { label: 'L60 melee', focus: 'melee', level: 60, skills: { attack: 10, strength: 10, defence: 10, hitpoints: 10, prayer: 10, slayer: 10, construction: 5 }, hub: { chapel: 4, workshop: 5, vault: 3 } },
];

function makeChar(p: Profile): CharacterSave {
  const ch = createCharacter('Sim', p.focus, 1);
  ch.xp = totalXpForLevel(p.level);
  Object.assign(ch.skills, p.skills);
  Object.assign(ch.hub, p.hub ?? {});
  return ch;
}

function pct(n: number, d: number) {
  return `${Math.round((n / Math.max(1, d)) * 100)}%`.padStart(4);
}

function sweep() {
  console.log(`Simulating ${runsPer} runs per profile (bot skill ${DEFAULT_BOT.skill}).\n`);
  console.log('profile               death retreat clear | avg act reached | avg XP  | XP if died act1 | XP if died act2 | XP on clear | avg coins banked');
  for (const p of PROFILES) {
    let death = 0, clear = 0, retreat = 0, xp = 0, depth = 0, coins = 0;
    const d1: number[] = [], d2: number[] = [], cl: number[] = [];
    const killers: Record<string, number> = {};
    for (let i = 0; i < runsPer; i++) {
      const ch = makeChar(p);
      const run = startRun(ch, 1000 + i * 31);
      const res = botPlayRun({ ch, run, autoRetaliate: true }, DEFAULT_BOT, i + 1);
      xp += res.xpEarned;
      depth += res.depth;
      coins += res.coinsBanked;
      if (res.outcome === 'death') {
        death++;
        const node = run.roomNode ? run.map.nodes[run.roomNode] : null;
        const where = `A${res.depth} ${node?.boss ?? node?.type ?? '?'}`;
        killers[where] = (killers[where] ?? 0) + 1;
        if (res.depth === 1) d1.push(res.xpEarned);
        if (res.depth === 2) d2.push(res.xpEarned);
      } else if (res.outcome === 'clear') {
        clear++;
        cl.push(res.xpEarned);
      } else retreat++;
    }
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length).toString() : '-').padStart(6);
    console.log(
      `${p.label.padEnd(20)} ${pct(death, runsPer)}  ${pct(retreat, runsPer)}  ${pct(clear, runsPer)} | ${(depth / runsPer).toFixed(2).padStart(15)} | ${String(Math.round(xp / runsPer)).padStart(7)} | ${avg(d1).padStart(15)} | ${avg(d2).padStart(15)} | ${avg(cl).padStart(11)} | ${String(Math.round(coins / runsPer)).padStart(6)}`,
    );
    if (verbose) {
      const top = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 6);
      console.log('    deaths at: ' + top.map(([k, v]) => `${k} ${v}`).join(', '));
    }
  }
}

/** One character from level 1, spending points sensibly and building the hub. */
function progress() {
  const plan: SkillId[] = ['hitpoints', 'attack', 'strength', 'prayer', 'prayer', 'prayer', 'defence', 'construction', 'construction', 'construction', 'hitpoints', 'strength', 'attack', 'prayer', 'prayer', 'prayer', 'defence', 'slayer', 'hitpoints', 'strength'];
  const ch = createCharacter('Sim', 'melee', 1);
  const milestones: Record<number, number> = {};
  for (let i = 1; i <= runsPer; i++) {
    const run = startRun(ch, 5000 + i * 17);
    const res = botPlayRun({ ch, run, autoRetaliate: true }, DEFAULT_BOT, i);
    storeVault(ch, res.keepable.filter((s) => s.qty === 1).slice(0, res.vaultSlots));
    while (unspentPoints(ch) > 0) {
      const next = plan.find((s) => (ch.skills[s] ?? 0) < 10) ?? 'slayer';
      if (raiseSkill(ch, next)) break;
    }
    for (const f of ['vault', 'chapel', 'workshop', 'study', 'portal']) buildUpgrade(ch, f);
    const lvl = levelForXp(ch.xp);
    for (const m of [10, 20, 30, 40, 50, 60]) if (lvl >= m && !milestones[m]) milestones[m] = i;
    if (i % 10 === 0 || i === 1) console.log(`run ${String(i).padStart(3)}: ${res.outcome.padEnd(7)} depth ${res.depth} xp +${String(res.xpEarned).padStart(5)} -> level ${lvl}, coins ${ch.coins}`);
  }
  console.log('\nRuns to reach level:', milestones, '(design doc: level 30 after ~8-10 runs, level 60 after ~40-50)');
}

if (mode === 'progress') progress();
else sweep();
