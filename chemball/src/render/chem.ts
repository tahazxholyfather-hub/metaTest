import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import "mathjax-full/js/input/tex/base/BaseConfiguration.js";
import "mathjax-full/js/input/tex/mhchem/MhchemConfiguration.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { SVG } from "mathjax-full/js/output/svg.js";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
  InputJax: new TeX({ packages: ["base", "mhchem"] }),
  OutputJax: new SVG({ fontCache: "none" }),
});

const PX_PER_EX = 8;
const svgCache = new Map<string, ChemSvg>();
const imageCache = new Map<string, HTMLImageElement>();

export interface ChemSvg {
  markup: string;
  width: number;
  height: number;
}

/**
 * Renders an mhchem formula (`H2O`, `Na+`, `H + O -> H2O`) to SVG markup in pixels.
 * `weight` thickens the Computer Modern strokes so small symbols stay legible on a bubble.
 */
export function chemSvg(source: string, weight = 0): ChemSvg {
  const key = `${source}|${weight}`;
  const hit = svgCache.get(key);
  if (hit) return hit;
  const node = doc.convert(`\\ce{${source}}`, { display: false });
  let markup = adaptor.innerHTML(node);
  const width = exToPx(/width="([\d.]+)ex"/.exec(markup)?.[1]);
  const height = exToPx(/height="([\d.]+)ex"/.exec(markup)?.[1]);
  markup = markup
    .replace(/width="[\d.]+ex"/, `width="${width}"`)
    .replace(/height="[\d.]+ex"/, `height="${height}"`)
    .replace(/ style="[^"]*"/, "")
    .replace('stroke-width="0"', `stroke-width="${weight}"`);
  const result = { markup, width, height };
  svgCache.set(key, result);
  return result;
}

/** Canvas image of a formula in a fixed color. Returns null until the image has decoded. */
export function chemImage(source: string, color: string, weight = 0): { image: HTMLImageElement; width: number; height: number } | null {
  const svg = chemSvg(source, weight);
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

function exToPx(value: string | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * PX_PER_EX * 100) / 100 : 0;
}
