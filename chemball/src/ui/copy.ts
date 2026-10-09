export type TipId = "match" | "danger" | "charging";

export const TIPS: Record<TipId, { text: string; tint: string }> = {
  match: { text: "سه مادهٔ همسان کنار هم، اثرشان را آزاد می‌کنند", tint: "#ffc15a" },
  danger: { text: "ردیف‌ها نزدیک خط قرمزند؛ نیتروژن مایع کمک می‌کند", tint: "#ff8d8d" },
  charging: { text: "این ابزار هنوز در حال شارژ است", tint: "#c9d3e6" },
};

export interface ElementCard {
  symbol: string;
  number: number;
  mass: string;
}

export interface GadgetCopy {
  id: string;
  name: string;
  text: string;
  tint: string;
}

export const GADGET_COPY: GadgetCopy[] = [
  { id: "nitrogen", name: "نیتروژن مایع", text: "سقوط ردیف‌ها را ۸ ثانیه منجمد می‌کند", tint: "#7ed3f0" },
  { id: "burner", name: "شعلهٔ بونزن", text: "پرتاب بعدی، گوی‌های اطراف برخورد را می‌سوزاند", tint: "#ff9a4a" },
  { id: "catalyst", name: "کاتالیزگر", text: "امتیاز زنجیرهٔ بعدی دو برابر می‌شود", tint: "#9ad85a" },
];

export const STEPS = [
  { id: "drag", title: "بکش", text: "مسیر پرتاب روشن می‌شود" },
  { id: "release", title: "رها کن", text: "گوی به هدف می‌چسبد" },
  { id: "react", title: "واکنش بده", text: "عنصرهای همسایه ماده می‌سازند" },
] as const;

export const RECIPES = [
  { tex: "H + O -> H2O", name: "آب", note: "پایهٔ همهٔ زنجیره‌ها", tint: "#5eb0f0" },
  { tex: "Na + Cl -> NaCl", name: "نمک طعام", note: "پیوند یونی", tint: "#c9a8ff" },
  { tex: "H + Cl -> HCl", name: "اسید", note: "فلز را حل می‌کند", tint: "#8fe06a" },
  { tex: "C + 2O -> CO2", name: "کربن دی‌اکسید", note: "گاز است و بالا می‌رود", tint: "#aeb6c8" },
  { tex: "Fe + O -> Fe2O3", name: "زنگ آهن", note: "اکسایش آهن", tint: "#e08a52" },
  { tex: "S + O -> SO2", name: "آتش", note: "گوگرد می‌سوزد", tint: "#ff8a5a" },
] as const;

export const BEHAVIORS = [
  { id: "water", name: "آب", text: "به پایین می‌پاشد" },
  { id: "fire", name: "آتش", text: "پخش می‌شود" },
  { id: "steam", name: "بخار", text: "بالا می‌رود" },
  { id: "acid", name: "اسید", text: "حل می‌کند" },
  { id: "ice", name: "یخ", text: "نگه می‌دارد" },
  { id: "explosive", name: "منفجره", text: "پاک می‌کند" },
] as const;
