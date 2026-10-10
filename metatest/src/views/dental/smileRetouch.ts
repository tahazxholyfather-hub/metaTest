/**
 * Builds the "before" and "after" layers of the smile comparison from a single
 * photo, so the two sides stay perfectly aligned and only the teeth change.
 *
 * Teeth are found as bright, low-saturation pixels that are *not* connected to
 * the picture border (a flood fill removes the white studio background), then
 * the mask is feathered. Colour stays inside each tooth: "before" warms the
 * existing enamel, "after" lifts it slightly. Highlights and shading are kept.
 */
export type RetouchResult = { before: HTMLCanvasElement; after: HTMLCanvasElement };

const WORK_WIDTH = 1100;

export async function retouchSmile(src: string, signal?: AbortSignal): Promise<RetouchResult> {
  const img = await loadImage(src, signal);
  const w = Math.min(WORK_WIDTH, img.naturalWidth);
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w);

  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const ctx = base.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h); // throws if the image is CORS-tainted

  const mask = teethMask(data);
  // Low values near the mask edge = gum line / contact points, where stains build up.
  const interior = blur(blur(mask, w, h, 5), w, h, 5);
  const painted = focusMouth(paint(data, mask, interior, "before"), paint(data, mask, interior, "after"), mask, w, h);
  return painted;
}

/** Crop both layers around the teeth so the divider crosses the smile, with lip around it. */
function focusMouth(before: HTMLCanvasElement, after: HTMLCanvasElement, mask: Float32Array, w: number, h: number) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let n = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (mask[y * w + x] < 0.2) continue;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (n < 40) return { before, after };
  const bw = Math.max(8, maxX - minX);
  const bh = Math.max(8, maxY - minY);
  const x0 = Math.max(0, Math.floor(minX - bw * 0.55));
  const x1 = Math.min(w, Math.ceil(maxX + bw * 0.85));
  const y0 = Math.max(0, Math.floor(minY - bh * 1.05));
  const y1 = Math.min(h, Math.ceil(maxY + bh * 0.95));
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  const cut = (src: HTMLCanvasElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext("2d")!.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
    return canvas;
  };
  return { before: cut(before), after: cut(after) };
}

function loadImage(src: string, signal?: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed"));
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    img.src = src;
  });
}

/** Soft ellipse over the mouth; the photo is focal-point cropped so the teeth sit here. */
const ROI = { cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.22 };

function teethMask({ data, width: w, height: h }: ImageData): Float32Array {
  const n = w * h;
  const candidate = new Uint8Array(n);
  const backdrop = new Uint8Array(n);
  const roi = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    // Enamel is bright with little chroma; lips are far more saturated. The threshold is low enough
    // to keep the shaded teeth at the corner of the smile, so pale skin is excluded by the ROI instead.
    // Enamel in this photo is bright and slightly cool. Lips are redder, so a tight chroma cut keeps the stain on the teeth.
    if (max > 165 && sat < 0.16 && max - min < 38) candidate[i] = 1;
    if (max > 200 && sat < 0.12) backdrop[i] = 1;
    const dx = (i % w) / w - ROI.cx;
    const dy = Math.floor(i / w) / h - ROI.cy;
    const e = (dx * dx) / (ROI.rx * ROI.rx) + (dy * dy) / (ROI.ry * ROI.ry);
    roi[i] = 1 - smooth((e - 1.05) / 0.5);
  }

  // Flood fill the white studio backdrop from the border so it is never mistaken for enamel.
  const background = new Uint8Array(n);
  const stack: number[] = [];
  const push = (i: number) => {
    if (backdrop[i] && !background[i]) {
      background[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }

  // Keep only sizeable connected blobs: teeth are large, skin highlights are specks.
  const hard = new Float32Array(n);
  const minArea = n * 0.0005;
  const seen = new Uint8Array(n);
  const ok = (i: number) => candidate[i] === 1 && background[i] === 0 && roi[i] > 0.02;
  for (let s = 0; s < n; s++) {
    if (!ok(s) || seen[s]) continue;
    const comp: number[] = [s];
    seen[s] = 1;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k];
      const x = i % w;
      const tryPush = (j: number) => {
        if (ok(j) && !seen[j]) {
          seen[j] = 1;
          comp.push(j);
        }
      };
      if (x > 0) tryPush(i - 1);
      if (x < w - 1) tryPush(i + 1);
      if (i >= w) tryPush(i - w);
      if (i < n - w) tryPush(i + w);
    }
    if (comp.length >= minArea) for (const i of comp) hard[i] = roi[i];
  }
  // A single erosion pulls the mask off the lip line. Two passes were eating the lower crown and leaving a hard stain edge.
  const opened = dilate(erode(hard, w, h), w, h);
  return blur(blur(opened, w, h, 7), w, h, 7);
}

function dilate(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[i] = Math.max(src[i], src[i - 1], src[i + 1], src[i - w], src[i + w]);
    }
  }
  return out;
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

function erode(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[i] = Math.min(src[i], src[i - 1], src[i + 1], src[i - w], src[i + w]);
    }
  }
  return out;
}

function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += src[y * w + Math.min(w - 1, Math.max(0, x + d))];
      tmp[y * w + x] = s * k;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += tmp[Math.min(h - 1, Math.max(0, y + d)) * w + x];
      out[y * w + x] = s * k;
    }
  }
  return out;
}

function paint(source: ImageData, mask: Float32Array, interior: Float32Array, mode: "before" | "after"): HTMLCanvasElement {
  const { width: w, height: h } = source;
  const out = new ImageData(new Uint8ClampedArray(source.data), w, h);
  const d = out.data;
  for (let i = 0; i < w * h; i++) {
    const m = mask[i];
    if (m <= 0.002) continue;
    const o = i * 4;
    let r = d[o];
    let g = d[o + 1];
    let b = d[o + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const highlight = smooth((lum - 168) / 70);
    if (mode === "before") {
      // Warm the photograph in place. Highlights stay bright streaks; the crown does not become a yellow fill.
      const body = 0.9 + 0.1 * Math.min(1, interior[i]);
      const amt = m * body * 0.92 * (1 - 0.5 * highlight);
      const shade = 1 - 0.14 * amt;
      r = r * (1 + 0.1 * amt) * shade;
      g = g * (1 - 0.16 * amt) * shade;
      b = b * (1 - 0.42 * amt) * shade;
    } else {
      // Same photo, clearer in the shaded enamel. Specular streaks stay in the original pixels.
      const amt = m * 0.28 * (1 - 0.65 * highlight);
      r = r + (255 - r) * amt;
      g = g + (255 - g) * amt;
      b = b + (255 - b) * amt * 0.9;
    }
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.putImageData(out, 0, 0);
  return canvas;
}
