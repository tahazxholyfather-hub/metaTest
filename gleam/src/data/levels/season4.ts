import { compileLevel, bossLevel } from './compiler'

const S = 'season-4'

export const SEASON_4_LEVELS = [
  compileLevel(
    S,
    1,
    'Membrane',
    'intro',
    `
..................................................
..........o..............o..............o.........
P....~~~~~~~~~~.....................~~~~~~~~~~.G..
##################################################
`,
    { parTime: 24, subtitle: 'It wants to keep you', intro: 'Sticky walls cling. Jump twice as you peel off.' },
  ),

  compileLevel(
    S,
    2,
    'Cytoplasm',
    'physics',
    `
........................................................
........o.............o.............o.............*.....
P....................................................G..
########################################################
`,
    {
      parTime: 28,
      subtitle: 'Swim more than you bounce',
      zones: [{ x: 160, y: 80, w: 1600, h: 160, fluid: true }],
    },
  ),

  compileLevel(
    S,
    3,
    'Toxin Bloom',
    'precision',
    `
........................................................
..........o.........o.........o.........*...............
P......T......T.........T.........T..................G..
########################################################
`,
    { parTime: 30, subtitle: 'Green is not grass here' },
  ),

  compileLevel(
    S,
    4,
    'Mitosis Path',
    'moving',
    `
........................................................
..........o...............o...............o.............
P............1.................2.................3...G..
####..............................................#######
`,
    {
      parTime: 34,
      subtitle: 'The path splits, then joins',
      movers: {
        '1': { dx: 140, dy: 0, period: 3.2, type: 'membrane' },
        '2': { dx: 0, dy: -80, period: 2.8, type: 'membrane' },
        '3': { dx: 100, dy: 50, period: 3.6, type: 'membrane' },
      },
    },
  ),

  compileLevel(
    S,
    5,
    'Antibody',
    'enemy',
    `
........................................................
........o.........o.........o.........*.................
P..........e.........d.........x.........n...........G..
########################################################
`,
    { parTime: 32, subtitle: 'They think you are the virus' },
  ),

  compileLevel(
    S,
    6,
    'Viral Stream',
    'escape',
    `
................................................................
o.o.o.o.o.o.o.o.o.o.o...........................................
P~~~~..............TTTT........x....x........................G..
################################################################
`,
    { parTime: 20, subtitle: 'The current is infected. Leave.' },
  ),

  compileLevel(
    S,
    7,
    'Nucleus Climb',
    'vertical',
    `
......G...
....o.....
..~~~~....
..........
....o.....
~~~~~~....
..........
..*.......
..TTTT....
..........
o.........
~~~~......
..........
P.........
####......
`,
    { parTime: 40, subtitle: 'Stick, peel, climb' },
  ),

  compileLevel(
    S,
    8,
    'Hemorrhage',
    'speed',
    `
................................................................
o...o...o...o...o...o...o...o...o.............................
P~~~~^^........~~~~........^^~~~~..........................G..
######TTTT....######....TTTT######....TTTT....#################
`,
    { parTime: 18, subtitle: 'Ride the pulse or drown in it' },
  ),

  compileLevel(
    S,
    9,
    'Hidden Genome',
    'exploration',
    `
.?..............................................................
H###############################################################
................o...........o.............*.....................
P....~~~~....................................................G..
########..............TTTT..............................#########
`,
    { parTime: 46, subtitle: 'A codon out of place', easterEgg: 'The membrane above the spawn is a fold, not a wall.' },
  ),

  compileLevel(
    S,
    10,
    'Organelle Storm',
    'precision',
    `
......................................................................
..o....1....o....T....o....2....*....~~~~....x....o....?...........G..
P......................................................................
####..............!!!!..............................TTTT......#########
`,
    {
      parTime: 52,
      subtitle: 'The cell does not want you here',
      movers: {
        '1': { dx: 120, dy: -40, period: 2.6, type: 'membrane' },
        '2': { dx: 0, dy: 90, period: 2.2 },
      },
    },
  ),

  bossLevel(
    S,
    'Prime Virus',
    `
................................................
................................................
.....................B..........................
................................................
P.............................................G.
################################################
`,
    {
      parTime: 130,
      subtitle: 'A true finale',
      intro: 'Three bodies. One nucleus. Do not let the membrane close.',
      boss: {
        kind: 'prime-virus',
        x: 880,
        y: 200,
        phases: [
          { hp: 8, name: 'Capsid', telegraph: 'The shell pulses. Spikes bloom.' },
          { hp: 8, name: 'Replication', telegraph: 'It splits. Each half bites.' },
          { hp: 10, name: 'Nucleus', telegraph: 'The core hunts. Membranes seal exits.' },
        ],
      },
    },
  ),
]
