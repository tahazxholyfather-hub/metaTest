import { SEASONS, LEVEL_COUNT } from '../src/data/seasons'

console.log('LEVEL_COUNT', LEVEL_COUNT)
if (LEVEL_COUNT !== 44) throw new Error('expected 44 stages')
for (const s of SEASONS) {
  if (s.levels.length !== 11) throw new Error(s.id)
  const boss = s.levels.filter((l) => l.isBoss)
  if (boss.length !== 1) throw new Error('boss ' + s.id)
  for (const l of s.levels) {
    if (!l.platforms.length) throw new Error('no platforms ' + l.id)
    if (l.spawn.x === 0 && l.spawn.y === 0) throw new Error('spawn ' + l.id)
    if (l.isBoss && !l.boss) throw new Error('boss def ' + l.id)
    console.log(l.id.padEnd(8), l.archetype.padEnd(12), l.name, `p${l.platforms.length}`, `c${l.collectibles.length}`, `e${l.enemies.length}`)
  }
}
console.log('ok')
