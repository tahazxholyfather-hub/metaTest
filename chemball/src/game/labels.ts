const CLASSROOM: Record<string, string> = {
  water: "آب",
  fire: "آتش",
  steam: "بخار",
  acid: "اسید",
  explosive: "مادهٔ انفجاری",
  ice: "یخ",
  energy: "انرژی",
  crystal: "نمک",
  smoke: "کربن دی‌اکسید",
  corrosion: "زنگ آهن",
  charged: "آب باردار",
};

const SHORT: Record<string, string> = {
  water: "آب",
  fire: "آتش",
  steam: "بخار",
  acid: "اسید",
  explosive: "انفجار",
  ice: "یخ",
  energy: "انرژی",
  crystal: "نمک",
  smoke: "گاز",
  corrosion: "زنگ",
  charged: "بار",
};

export function materialName(id: string): string {
  return CLASSROOM[id] ?? "ماده";
}

export function materialShort(id: string): string {
  return SHORT[id] ?? "ماده";
}

export function scoreLabel(kind: string, materialId?: string): string {
  if (kind === "explosion") return "انفجار";
  if (kind === "match") return materialShort(materialId ?? "");
  if (kind === "reaction") return "واکنش";
  if (kind === "clear") return "پاک";
  return "امتیاز";
}

export function chemicalGlyph(formula: string): string {
  if (/[a-z0-9₂₃₄₊⁺+\-]/.test(formula)) return formula;
  return "";
}
