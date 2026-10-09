import type { GameItemDefinition, ItemType, ScienceFact, ScienceQuestion } from './types'

export const ITEM_CATALOG: Record<ItemType, GameItemDefinition> = {
  COIN: {
    type: 'COIN',
    title: 'Coin',
    description: 'Saved for later systems.',
    rarity: 'common',
    spawnWeight: 22,
    stackable: true,
    consumeOnUse: false,
    collection: 'instant',
    duration: null,
  },
  XP: {
    type: 'XP',
    title: 'XP',
    description: 'A small burst of experience.',
    rarity: 'common',
    spawnWeight: 18,
    stackable: true,
    consumeOnUse: true,
    collection: 'instant',
    duration: null,
  },
  POINT: {
    type: 'POINT',
    title: 'Points',
    description: 'Match points for the scoreboard.',
    rarity: 'common',
    spawnWeight: 12,
    stackable: true,
    consumeOnUse: false,
    collection: 'instant',
    duration: null,
  },
  MOVE_PLUS_2: {
    type: 'MOVE_PLUS_2',
    title: '+2 Move',
    description: 'Add two steps to your next move.',
    rarity: 'uncommon',
    spawnWeight: 16,
    stackable: true,
    consumeOnUse: true,
    collection: 'inventory',
    duration: null,
  },
  MOVE_PLUS_4: {
    type: 'MOVE_PLUS_4',
    title: '+4 Move',
    description: 'Add four steps to your next move.',
    rarity: 'rare',
    spawnWeight: 8,
    stackable: true,
    consumeOnUse: true,
    collection: 'inventory',
    duration: null,
  },
  MUSIC: {
    type: 'MUSIC',
    title: 'Music',
    description: 'Play a short melody.',
    rarity: 'uncommon',
    spawnWeight: 10,
    stackable: true,
    consumeOnUse: true,
    collection: 'inventory',
    duration: 1800,
  },
  MYSTERY: {
    type: 'MYSTERY',
    title: 'Mystery Box',
    description: 'Opens into a random reward.',
    rarity: 'rare',
    spawnWeight: 8,
    stackable: true,
    consumeOnUse: true,
    collection: 'inventory',
    duration: null,
  },
  SCIENCE_FACT: {
    type: 'SCIENCE_FACT',
    title: 'Science',
    description: 'A tiny fact from the world.',
    rarity: 'uncommon',
    spawnWeight: 10,
    stackable: false,
    consumeOnUse: true,
    collection: 'instant',
    duration: null,
  },
  QUESTION: {
    type: 'QUESTION',
    title: 'Question',
    description: 'A short science question.',
    rarity: 'uncommon',
    spawnWeight: 6,
    stackable: false,
    consumeOnUse: true,
    collection: 'instant',
    duration: null,
  },
}

export const DROP_ITEM_TYPES: ItemType[] = [
  'COIN',
  'XP',
  'POINT',
  'MOVE_PLUS_2',
  'MOVE_PLUS_4',
  'MUSIC',
  'MYSTERY',
  'SCIENCE_FACT',
]

export const SPECIAL_TILE_KINDS = ['SCIENCE_FACT', 'QUESTION', 'POINT', 'XP', 'COIN'] as const

export const SCIENCE_FACTS: ScienceFact[] = [
  {
    id: 'venus-day',
    category: 'Astronomy',
    title: 'Did you know?',
    body: 'A day on Venus is longer than a year on Venus.',
  },
  {
    id: 'octupus-brains',
    category: 'Biology',
    title: 'Did you know?',
    body: 'An octopus has three hearts and blue blood.',
  },
  {
    id: 'water-solid',
    category: 'Physics',
    title: 'Did you know?',
    body: 'Water is one of the few substances that expands when it freezes.',
  },
  {
    id: 'banana-radiation',
    category: 'Physics',
    title: 'Did you know?',
    body: 'Bananas are naturally a little radioactive because of potassium-40.',
  },
  {
    id: 'honey-forever',
    category: 'Biology',
    title: 'Did you know?',
    body: 'Honey stored well can last thousands of years without spoiling.',
  },
  {
    id: 'light-sun',
    category: 'Astronomy',
    title: 'Did you know?',
    body: 'Sunlight takes about eight minutes to reach Earth.',
  },
  {
    id: 'glass-liquid',
    category: 'Chemistry',
    title: 'Did you know?',
    body: 'Glass is an amorphous solid — its atoms are jumbled, not crystalline.',
  },
  {
    id: 'brain-energy',
    category: 'Human body',
    title: 'Did you know?',
    body: 'Your brain uses about a fifth of your body’s energy.',
  },
  {
    id: 'neutron-star',
    category: 'Space',
    title: 'Did you know?',
    body: 'A teaspoon of neutron star would weigh billions of tonnes.',
  },
  {
    id: 'zero-invented',
    category: 'Mathematics',
    title: 'Did you know?',
    body: 'The modern zero as a number was developed in ancient India.',
  },
  {
    id: 'titan-lakes',
    category: 'Space',
    title: 'Did you know?',
    body: 'Saturn’s moon Titan has lakes of liquid methane and ethane.',
  },
  {
    id: 'dna-length',
    category: 'Human body',
    title: 'Did you know?',
    body: 'Stretched out, the DNA in one human cell is about two metres long.',
  },
  {
    id: 'graphene',
    category: 'Technology',
    title: 'Did you know?',
    body: 'Graphene is a single layer of carbon atoms and stronger than steel.',
  },
  {
    id: 'sharks-trees',
    category: 'Biology',
    title: 'Did you know?',
    body: 'Trees are a more recent invention than sharks — sharks are older.',
  },
  {
    id: 'hot-cold',
    category: 'Physics',
    title: 'Did you know?',
    body: 'There is a lowest possible temperature, but no highest one.',
  },
]

export const SCIENCE_QUESTIONS: ScienceQuestion[] = [
  {
    id: 'q-light',
    category: 'Physics',
    prompt: 'Which is faster, light or sound?',
    options: ['Light', 'Sound'],
    correctIndex: 0,
    fact: 'Light in vacuum travels about 300,000 km per second; sound in air about 343 m/s.',
  },
  {
    id: 'q-venus',
    category: 'Astronomy',
    prompt: 'Which planet has a day longer than its year?',
    options: ['Mercury', 'Venus'],
    correctIndex: 1,
    fact: 'Venus rotates so slowly that one day lasts longer than one orbit of the Sun.',
  },
  {
    id: 'q-water',
    category: 'Chemistry',
    prompt: 'Does water expand or shrink when it freezes?',
    options: ['Expands', 'Shrinks'],
    correctIndex: 0,
    fact: 'Ice is less dense than liquid water, which is why it floats.',
  },
  {
    id: 'q-hearts',
    category: 'Biology',
    prompt: 'How many hearts does an octopus have?',
    options: ['One', 'Three'],
    correctIndex: 1,
    fact: 'Two pump blood to the gills; the third pumps it to the rest of the body.',
  },
]

export function itemTitle(type: ItemType): string {
  return ITEM_CATALOG[type].title
}

export function weightedPick<T extends { spawnWeight: number }>(items: T[], rand: () => number): T {
  const total = items.reduce((sum, item) => sum + item.spawnWeight, 0)
  let cursor = rand() * total
  for (const item of items) {
    cursor -= item.spawnWeight
    if (cursor <= 0) return item
  }
  return items[items.length - 1]!
}
