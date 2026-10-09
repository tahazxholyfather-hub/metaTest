const CLASSROOM: Record<string, string> = {
  water: "آب",
  fire: "آتش",
  steam: "بخار آب",
  acid: "هیدروکلریک اسید",
  explosive: "مادهٔ منفجره",
  ice: "یخ",
  energy: "انرژی",
  crystal: "نمک طعام",
  smoke: "کربن دی‌اکسید",
  corrosion: "زنگ آهن",
  charged: "یون هیدرونیوم",
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
  charged: "یون",
};

/** mhchem source for the formula printed under a material icon. Empty means icon only. */
const TEX: Record<string, string> = {
  water: "H2O",
  steam: "H2O(g)",
  ice: "H2O(s)",
  acid: "HCl",
  crystal: "NaCl",
  smoke: "CO2",
  corrosion: "Fe2O3",
  charged: "H3O+",
};

export function materialName(id: string): string {
  return CLASSROOM[id] ?? "ماده";
}

export function materialShort(id: string): string {
  return SHORT[id] ?? "ماده";
}

export function materialTex(id: string): string {
  return TEX[id] ?? "";
}

export function scoreLabel(kind: string, materialId?: string): string {
  if (kind === "explosion") return "انفجار";
  if (kind === "match") return materialShort(materialId ?? "");
  if (kind === "reaction") return "واکنش";
  if (kind === "clear") return "پاک‌سازی";
  return "امتیاز";
}

export function faDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
}
