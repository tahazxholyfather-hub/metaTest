export const TIPS = [
  { k: "هدف", t: "انگشت را بکش تا مسیر پرتاب روشن شود." },
  { k: "پرتاب", t: "انگشت را رها کن تا گوی به هدف برسد." },
  { k: "آب", t: "هیدروژن کنار اکسیژن آب می‌سازد." },
  { k: "نمک", t: "سدیم و کلر کنار هم بلور نمک می‌سازند." },
  { k: "زنجیره", t: "سه مادهٔ یکسان را به هم برسان تا اثرشان آزاد شود." },
  { k: "ابزار", t: "دکمهٔ پایین راست، ابزار شلیک بعدی را انتخاب می‌کند." },
  { k: "خطر", t: "اگر گوی‌ها به خط قرمز برسند، آزمایش تمام می‌شود." },
] as const;

export const SIGNS = [
  { s: "H", c: "#3d8ec4", x: "14%", y: "18%", d: "0s", n: 72 },
  { s: "O", c: "#c45448", x: "72%", y: "14%", d: "0.6s", n: 64 },
  { s: "Na", c: "#c4842a", x: "8%", y: "42%", d: "1.1s", n: 70 },
  { s: "Cl", c: "#5f8a28", x: "76%", y: "40%", d: "0.3s", n: 68 },
  { s: "C", c: "#5c6578", x: "20%", y: "64%", d: "1.4s", n: 58 },
  { s: "Fe", c: "#8d4d2c", x: "68%", y: "66%", d: "0.8s", n: 60 },
  { s: "S", c: "#b59216", x: "46%", y: "24%", d: "1.7s", n: 52 },
] as const;

export interface GadgetCopy {
  id: string;
  name: string;
  text: string;
  tint: string;
}

export const GADGET_COPY: GadgetCopy[] = [
  { id: "frost", name: "سرما", text: "همسایه‌های برخورد تا سه ردیف یخ می‌زنند.", tint: "#7ec8dc" },
  { id: "void", name: "خلأ", text: "گوی برخورد را، اگر به سقف نچسبیده باشد، برمی‌دارد.", tint: "#b7c3d6" },
  { id: "magnet", name: "آهنربا", text: "گوی‌های نزدیک یک خانه به سمت برخورد جمع می‌شوند.", tint: "#d59af2" },
  { id: "spark", name: "جرقه", text: "انرژی فعال‌سازی؛ واکنش‌های کناری بیدار می‌شوند.", tint: "#e6c84a" },
  { id: "catalyst", name: "کاتالیز", text: "امتیاز واکنش بعدی دو برابر می‌شود.", tint: "#8fce55" },
];

export interface Lesson {
  id: string;
  title: string;
  text: string;
  tint: string;
}

export const LESSONS: Lesson[] = [
  { id: "aim", title: "پرتاب", text: "بکش تا هدف را بگیری. رها کن تا شلیک شود.", tint: "#8fd4ff" },
  { id: "element", title: "عنصر", text: "نماد، رنگ عنصر را دارد. حباب همان رنگ را روشن‌تر نشان می‌دهد.", tint: "#ffc15a" },
  { id: "material", title: "ماده", text: "آیکون یعنی ماده. سه تای به‌هم‌پیوسته اثرش را آزاد می‌کند.", tint: "#ff8a5a" },
  { id: "water", title: "آب", text: "H کنار O آب می‌سازد. در بازی یک به یک کافی است.", tint: "#5eb0f0" },
  { id: "salt", title: "نمک", text: "Na و Cl بلور نمک می‌سازند.", tint: "#b6e36a" },
  { id: "acid", title: "اسید", text: "H و Cl اسید می‌سازند و فلز را حل می‌کنند.", tint: "#8fe06a" },
  { id: "gas", title: "گاز کربن", text: "C با دو O کربن دی‌اکسید می‌سازد و بالا می‌رود.", tint: "#aeb6c8" },
  { id: "rust", title: "زنگ", text: "آهن کنار اکسیژن زنگ می‌زند.", tint: "#e08a52" },
  { id: "danger", title: "خط قرمز", text: "گوی‌ها اگر به خط پایین برسند، آزمایش تمام است.", tint: "#ff8d8d" },
];

export const BEHAVIORS = [
  { id: "water", name: "آب", text: "می‌شوید" },
  { id: "fire", name: "آتش", text: "پخش می‌شود" },
  { id: "steam", name: "بخار", text: "بالا می‌رود" },
  { id: "acid", name: "اسید", text: "حل می‌کند" },
  { id: "ice", name: "یخ", text: "نگه می‌دارد" },
  { id: "explosive", name: "انفجار", text: "پاک می‌کند" },
] as const;
