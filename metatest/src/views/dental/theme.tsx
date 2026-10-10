import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

const STORAGE_KEY = "dl-theme";

export type ThemeMode = "light" | "dark";

export type Palette = {
  id: string;
  primary: string;
  secondary: string;
};

export const PALETTES: Palette[] = [
  { id: "clinic", primary: "#2f6bff", secondary: "#7a5cff" },
  { id: "lagoon", primary: "#0f766e", secondary: "#0284c7" },
  { id: "garden", primary: "#047857", secondary: "#0f766e" },
  { id: "saffron", primary: "#c2410c", secondary: "#b45309" },
  { id: "rose", primary: "#be185d", secondary: "#7c3aed" },
];

type Saved = {
  mode: ThemeMode;
  preset: string;
  custom: { primary: string; secondary: string } | null;
};

type Ctx = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  preset: string;
  custom: { primary: string; secondary: string } | null;
  primary: string;
  secondary: string;
  setPreset: (id: string) => void;
  setCustom: (primary: string, secondary: string) => void;
  vars: CSSProperties;
};

const ThemeContext = createContext<Ctx | null>(null);

function readSaved(): Saved {
  const fallback: Saved = { mode: "light", preset: "clinic", custom: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const mode = parsed.mode === "dark" ? "dark" : "light";
    const preset = PALETTES.some((p) => p.id === parsed.preset) ? (parsed.preset as string) : "clinic";
    const custom =
      parsed.custom && isHex(parsed.custom.primary) && isHex(parsed.custom.secondary)
        ? { primary: parsed.custom.primary, secondary: parsed.custom.secondary }
        : null;
    return { mode, preset, custom };
  } catch {
    return fallback;
  }
}

function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: string, b: string, t: number) {
  const A = rgb(a);
  const B = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  const h = (v: number) => v.toString(16).padStart(2, "0");
  return `#${h(c(A.r, B.r))}${h(c(A.g, B.g))}${h(c(A.b, B.b))}`;
}

function deepen(hex: string) {
  return mix(hex, "#06101f", 0.28);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(readSaved);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* private mode */
    }
  }, [saved]);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = saved.mode === "dark" ? "#0c1220" : "#ffffff";
    return () => {
      document.body.style.background = prev;
    };
  }, [saved.mode]);

  const palette = PALETTES.find((p) => p.id === saved.preset) ?? PALETTES[0];
  const primary = saved.custom?.primary ?? palette.primary;
  const secondary = saved.custom?.secondary ?? palette.secondary;
  const { r, g, b } = rgb(primary);

  const value = useMemo<Ctx>(() => {
    const vars = {
      "--dl-blue": primary,
      "--dl-blue-deep": deepen(primary),
      "--dl-violet": secondary,
      "--dl-cyan": mix(mix(primary, secondary, 0.45), "#e7fbff", 0.28),
      "--dl-glow": `rgba(${r}, ${g}, ${b}, 0.22)`,
    } as CSSProperties;
    return {
      mode: saved.mode,
      setMode: (mode) => setSaved((s) => ({ ...s, mode })),
      toggleMode: () => setSaved((s) => ({ ...s, mode: s.mode === "dark" ? "light" : "dark" })),
      preset: saved.preset,
      custom: saved.custom,
      primary,
      secondary,
      setPreset: (id) => setSaved((s) => ({ ...s, preset: id, custom: null })),
      setCustom: (nextPrimary, nextSecondary) =>
        setSaved((s) => ({ ...s, custom: { primary: nextPrimary, secondary: nextSecondary } })),
      vars,
    };
  }, [saved, primary, secondary, r, g, b]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
