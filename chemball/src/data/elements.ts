import type { Charge, ElementDef } from "../game/types";

const INK = "#1a1c22";
const PAPER = "#f6f3ee";

function light(tint: string): ElementDef["visualStyle"] {
  return { base: PAPER, glow: "#ffffff", rim: "#e6e1d8", ink: INK, tint };
}

export const ELEMENTS: ElementDef[] = [
  { id: "H", symbol: "H", name: "Hydrogen", visualStyle: light("#d5e3f0"), rarity: 1, tags: ["fuel", "gas", "cation"] },
  { id: "O", symbol: "O", name: "Oxygen", visualStyle: light("#f0ddd8"), rarity: 1, tags: ["gas", "oxidizer", "anion"] },
  { id: "C", symbol: "C", name: "Carbon", visualStyle: light("#e3e4e8"), rarity: 2, tags: ["fuel", "solid"] },
  { id: "N", symbol: "N", name: "Nitrogen", visualStyle: light("#e4e0f2"), rarity: 3, tags: ["gas", "cryogenic"] },
  { id: "Na", symbol: "Na", name: "Sodium", visualStyle: light("#f3e6cc"), rarity: 3, tags: ["metal", "alkali", "cation"] },
  { id: "Cl", symbol: "Cl", name: "Chlorine", visualStyle: light("#e3f0d8"), rarity: 3, tags: ["gas", "halogen", "anion"] },
  { id: "Ca", symbol: "Ca", name: "Calcium", visualStyle: light("#f3efe6"), rarity: 4, tags: ["metal", "cation"] },
  { id: "Mg", symbol: "Mg", name: "Magnesium", visualStyle: light("#e4f1f4"), rarity: 4, tags: ["metal", "fuel", "cation"] },
  { id: "Fe", symbol: "Fe", name: "Iron", visualStyle: light("#f0e0d4"), rarity: 4, tags: ["metal", "cation"] },
  { id: "S", symbol: "S", name: "Sulfur", visualStyle: light("#f4ecc8"), rarity: 3, tags: ["fuel", "solid", "anion"] },
  { id: "Al", symbol: "Al", name: "Aluminum", visualStyle: light("#e6ebf1"), rarity: 4, tags: ["metal", "cation"] },
  { id: "K", symbol: "K", name: "Potassium", visualStyle: light("#efe4f4"), rarity: 4, tags: ["metal", "alkali", "cation"] },
  { id: "P", symbol: "P", name: "Phosphorus", visualStyle: light("#f6e6d4"), rarity: 4, tags: ["solid"] },
  { id: "F", symbol: "F", name: "Fluorine", visualStyle: light("#e5f4ea"), rarity: 4, tags: ["gas", "halogen", "anion"] },
];

const BY_ID = new Map(ELEMENTS.map((element) => [element.id, element]));

export function getElement(id: string): ElementDef {
  const element = BY_ID.get(id);
  if (!element) throw new Error(`Unknown element ${id}`);
  return element;
}

export function elementIds(): string[] {
  return ELEMENTS.map((element) => element.id);
}

export function hasTag(id: string, tag: string): boolean {
  return getElement(id).tags.includes(tag);
}

/** Metals and hydrogen give up an electron. Halogens and oxygen take one. */
export function ionCharge(id: string): Charge {
  if (hasTag(id, "cation")) return 1;
  if (hasTag(id, "anion")) return -1;
  return 0;
}
