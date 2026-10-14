import type { ElementDef } from "../game/types";

export const ELEMENTS: ElementDef[] = [
  {
    id: "H",
    symbol: "H",
    name: "Hydrogen",
    visualStyle: { base: "#8fd4ff", glow: "#e7f7ff", rim: "#3d8ec4", ink: "#083044" },
    rarity: 1,
    tags: ["fuel", "gas"],
  },
  {
    id: "O",
    symbol: "O",
    name: "Oxygen",
    visualStyle: { base: "#ff8d7a", glow: "#ffd2c8", rim: "#c45448", ink: "#3d1210" },
    rarity: 1,
    tags: ["gas", "oxidizer"],
  },
  {
    id: "C",
    symbol: "C",
    name: "Carbon",
    visualStyle: { base: "#9aa3b5", glow: "#e7ebf3", rim: "#5c6578", ink: "#151820" },
    rarity: 1,
    tags: ["fuel", "solid"],
  },
  {
    id: "N",
    symbol: "N",
    name: "Nitrogen",
    visualStyle: { base: "#9b8cff", glow: "#e4dcff", rim: "#5b4ec4", ink: "#1a1440" },
    rarity: 3,
    tags: ["gas", "cryogenic"],
  },
  {
    id: "Na",
    symbol: "Na",
    name: "Sodium",
    visualStyle: { base: "#ffc15a", glow: "#fff0cc", rim: "#c4842a", ink: "#3a2504" },
    rarity: 2,
    tags: ["metal", "alkali"],
  },
  {
    id: "Cl",
    symbol: "Cl",
    name: "Chlorine",
    visualStyle: { base: "#b6e36a", glow: "#f3ffd4", rim: "#6a9a32", ink: "#1c3008" },
    rarity: 2,
    tags: ["gas", "halogen"],
  },
  {
    id: "Ca",
    symbol: "Ca",
    name: "Calcium",
    visualStyle: { base: "#f4efe4", glow: "#ffffff", rim: "#b3a894", ink: "#3a342c" },
    rarity: 4,
    tags: ["metal"],
  },
  {
    id: "Mg",
    symbol: "Mg",
    name: "Magnesium",
    visualStyle: { base: "#d5f6ff", glow: "#ffffff", rim: "#7eb8c9", ink: "#10343c" },
    rarity: 3,
    tags: ["metal", "fuel"],
  },
  {
    id: "Fe",
    symbol: "Fe",
    name: "Iron",
    visualStyle: { base: "#e08a52", glow: "#ffd2b8", rim: "#8d4d2c", ink: "#2c140c" },
    rarity: 3,
    tags: ["metal"],
  },
  {
    id: "S",
    symbol: "S",
    name: "Sulfur",
    visualStyle: { base: "#ffe15c", glow: "#fff6c4", rim: "#c6a322", ink: "#3a3004" },
    rarity: 2,
    tags: ["fuel", "solid"],
  },
  {
    id: "Al",
    symbol: "Al",
    name: "Aluminum",
    visualStyle: { base: "#c5d4e4", glow: "#f5f9ff", rim: "#7e93a8", ink: "#1b2833" },
    rarity: 4,
    tags: ["metal"],
  },
  {
    id: "K",
    symbol: "K",
    name: "Potassium",
    visualStyle: { base: "#e3a4ff", glow: "#f8e4ff", rim: "#9a5cbc", ink: "#301040" },
    rarity: 4,
    tags: ["metal", "alkali"],
  },
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
