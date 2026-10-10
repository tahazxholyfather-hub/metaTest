import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { COPY, type Copy, type Lang } from "./copy";

const STORAGE_KEY = "dl-lang";

type Ctx = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  t: Copy;
};

const LangContext = createContext<Ctx | null>(null);

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "fa";
  } catch {
    return "fa";
  }
}

/** Language for the landing page only. Restores the document's previous language on unmount. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  };
  const dir: "ltr" | "rtl" = lang === "fa" ? "rtl" : "ltr";
  const t = COPY[lang];

  useEffect(() => {
    const html = document.documentElement;
    const prev = {
      title: document.title,
      dir: html.getAttribute("dir"),
      lang: html.getAttribute("lang"),
    };
    return () => {
      document.title = prev.title;
      if (prev.dir) html.setAttribute("dir", prev.dir);
      else html.removeAttribute("dir");
      if (prev.lang) html.setAttribute("lang", prev.lang);
      else html.removeAttribute("lang");
    };
  }, []);

  useEffect(() => {
    document.title = t.meta.title;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir, t.meta.title]);

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const value = useContext(LangContext);
  if (!value) throw new Error("useLang must be used within LanguageProvider");
  return value;
}
