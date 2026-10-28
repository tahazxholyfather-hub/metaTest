const PX_PER_EX = 8;
const svgCache = new Map<string, ChemSvg>();
const imageCache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

let enginePromise: Promise<ChemEngine | null> | null = null;
let engine: ChemEngine | null = null;

interface ChemEngine {
  tex2svg: (source: string, options?: { display?: boolean }) => { innerHTML?: string };
  startup?: { adaptor?: { innerHTML: (node: unknown) => string } };
}

export interface ChemSvg {
  markup: string;
  width: number;
  height: number;
}

/**
 * Renders an mhchem formula (`H2O`, `Na+`, `H + O -> H2O`) with the app's
 * MathJax 4. Returns null until that engine is ready.
 * `weight` thickens the strokes so small symbols stay legible on a bubble.
 */
export function chemSvg(source: string, weight = 0): ChemSvg | null {
  const ready = ensureEngine();
  if (!ready) return null;
  const key = `${source}|${weight}`;
  const hit = svgCache.get(key);
  if (hit) return hit;
  let markup = "";
  try {
    const node = ready.tex2svg(`\\ce{${source}}`, { display: false });
    markup = ready.startup?.adaptor?.innerHTML(node) ?? node.innerHTML ?? "";
  } catch (err) {
    console.error("ChemBall formula failed", err);
    return null;
  }
  const result = toPixelSvg(markup, weight);
  svgCache.set(key, result);
  return result;
}

/** Canvas image of a formula in a fixed color. Returns null until the image has decoded. */
export function chemImage(source: string, color: string, weight = 0): { image: HTMLImageElement; width: number; height: number } | null {
  const svg = chemSvg(source, weight);
  if (!svg?.markup) return null;
  const key = `${source}|${color}|${weight}`;
  let image = imageCache.get(key);
  if (!image) {
    image = new Image();
    const tinted = svg.markup.replaceAll("currentColor", color);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
    imageCache.set(key, image);
  }
  if (!image.complete || image.naturalWidth === 0) return null;
  return { image, width: svg.width, height: svg.height };
}

/** Re-render when MathJax 4 finishes loading. */
export function subscribeChemReady(listener: () => void): () => void {
  listeners.add(listener);
  void loadEngine();
  return () => listeners.delete(listener);
}

/** Turns MathJax SVG markup into a self-contained pixel-sized SVG string. */
export function toPixelSvg(markup: string, weight = 0): ChemSvg {
  const width = readLength(markup, "width");
  const height = readLength(markup, "height");
  const sized = markup
    .replace(/width="[\d.]+(?:ex|px)?"/, `width="${width}"`)
    .replace(/height="[\d.]+(?:ex|px)?"/, `height="${height}"`)
    .replace(/ style="[^"]*"/, "")
    .replace('stroke-width="0"', `stroke-width="${weight}"`);
  return { markup: sized, width, height };
}

function ensureEngine(): ChemEngine | null {
  if (engine?.tex2svg) return engine;
  void loadEngine();
  return null;
}

function loadEngine(): Promise<ChemEngine | null> {
  if (!enginePromise) {
    enginePromise = resolveEngine().then((next) => {
      engine = next;
      listeners.forEach((listener) => listener());
      return next;
    });
  }
  return enginePromise;
}

async function resolveEngine(): Promise<ChemEngine | null> {
  const page = await pageSvgEngine();
  if (page) return page;
  return iframeSvgEngine();
}

async function pageSvgEngine(): Promise<ChemEngine | null> {
  const started = performance.now();
  // The app injects MathJax at startup. Wait for that copy before loading another.
  const limit = document.querySelector('script[src*="mathjax"]') ? 8000 : 400;
  while (performance.now() - started < limit) {
    const mj = window.MathJax as ChemEngine | undefined;
    if (typeof mj?.tex2svg === "function") return mj;
    const pending = (mj as { startup?: { promise?: Promise<unknown> } } | undefined)?.startup?.promise;
    if (pending) {
      try {
        await pending;
      } catch {
        return null;
      }
      const ready = window.MathJax as ChemEngine | undefined;
      return typeof ready?.tex2svg === "function" ? ready : null;
    }
    await delay(40);
  }
  return null;
}

function iframeSvgEngine(): Promise<ChemEngine | null> {
  return new Promise((resolve) => {
    const src = svgScriptUrl();
    const base = src.replace(/\/[^/]*$/, "");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
    const config = {
      tex: { packages: { "[+]": ["mhchem"] } },
      loader: { load: ["[tex]/mhchem"], paths: { mathjax: base } },
      svg: { fontCache: "none" },
      output: { fontCache: "none" },
      options: { enableMenu: false },
      startup: { typeset: false },
    };
    iframe.srcdoc =
      `<!doctype html><html><head><script>window.MathJax=${JSON.stringify(config)};<\/script>` +
      `<script src=${JSON.stringify(src)}><\/script></head><body></body></html>`;
    const timer = window.setTimeout(() => resolve(null), 8000);
    iframe.onload = () => {
      const mj = (iframe.contentWindow as (Window & { MathJax?: ChemEngine & { startup?: { promise?: Promise<unknown> } } }) | null)?.MathJax;
      const pending = mj?.startup?.promise;
      if (!pending) {
        window.clearTimeout(timer);
        resolve(null);
        return;
      }
      pending.then(() => {
        window.clearTimeout(timer);
        resolve(typeof mj.tex2svg === "function" ? mj : null);
      }).catch(() => {
        window.clearTimeout(timer);
        resolve(null);
      });
    };
    document.body.appendChild(iframe);
  });
}

function svgScriptUrl(): string {
  const current = document.querySelector('script[src*="mathjax"]') as HTMLScriptElement | null;
  if (current?.src) return current.src.replace(/[^/]+$/, "tex-mml-svg.js");
  return "/mathjax/tex-mml-svg.js";
}

function readLength(markup: string, attr: "width" | "height"): number {
  const match = new RegExp(`${attr}="([\\d.]+)(ex|px)?"`).exec(markup);
  if (!match) return 0;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return 0;
  const px = match[2] === "px" ? n : n * PX_PER_EX;
  return Math.round(px * 100) / 100;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
