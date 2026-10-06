import * as THREE from "three";

export type CrownParams = {
  width: number;
  depth: number;
  height: number;
  /** 0 = incisor edge, 1 = canine tip, 2 = premolar, 4 = molar */
  cusps: 0 | 1 | 2 | 4;
  cuspHeight?: number;
  /** horizontal superellipse exponent: lower = squarer */
  squareness?: number;
  /** vertical superellipse exponent: lower = flatter occlusal table */
  flatness?: number;
  segments?: number;
};

const sgnPow = (a: number, e: number) => Math.sign(a) * Math.pow(Math.abs(a), e);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, z: number, cx: number, cz: number, s: number) =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));

/**
 * Procedural crown: a superellipsoid shell, tapered toward the neck,
 * with cusps and fissures sculpted into the occlusal table.
 * The crown occupies y ∈ [-height, +height], neck at the bottom.
 */
export function createCrownGeometry(p: CrownParams): THREE.BufferGeometry {
  const seg = p.segments ?? 112;
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const e2 = p.squareness ?? 0.62;
  const e1 = p.flatness ?? 0.72;
  const cuspH = p.cuspHeight ?? 0.16;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const phi = Math.acos(Math.min(1, Math.max(-1, v.y)));
    const theta = Math.atan2(v.z, v.x);
    const sp = Math.sin(phi);
    let x = sgnPow(sp, e1) * sgnPow(Math.cos(theta), e2);
    let z = sgnPow(sp, e1) * sgnPow(Math.sin(theta), e2);
    let y = sgnPow(Math.cos(phi), e1);

    // bulge slightly above the neck, then taper toward the gum line
    const bulge = 1 + 0.06 * Math.exp(-((y - 0.1) ** 2) / 0.12);
    const taper = 1 - 0.3 * smoothstep(0, 1, -y) ** 1.4;
    x *= bulge * taper;
    z *= bulge * taper;

    // occlusal sculpting
    if (y > 0) {
      const w = smoothstep(0.35, 0.95, y);
      let bump = 0;
      let groove = 0;
      if (p.cusps === 4) {
        bump =
          gauss(x, z, 0.5, 0.5, 0.33) +
          gauss(x, z, -0.5, 0.5, 0.33) +
          gauss(x, z, 0.5, -0.5, 0.33) +
          gauss(x, z, -0.5, -0.5, 0.33);
        groove = 0.55 * (Math.exp(-(x * x) / 0.03) + Math.exp(-(z * z) / 0.03));
      } else if (p.cusps === 2) {
        bump = gauss(x, z, 0, 0.5, 0.38) + gauss(x, z, 0, -0.5, 0.38);
        groove = 0.5 * Math.exp(-(z * z) / 0.03);
      } else if (p.cusps === 1) {
        bump = 1.6 * gauss(x, z, 0, 0, 0.5);
      } else {
        // incisal edge: ridge along x, pinched in z
        bump = 1.1 * Math.exp(-(z * z) / 0.08);
      }
      y += w * cuspH * (bump - groove);
    }

    pos.setXYZ(i, x * p.width, y * p.height, z * p.depth);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Tapered, gently curved root built from a lathe profile. */
export function createRootGeometry(length: number, radius: number): THREE.BufferGeometry {
  // Profile runs apex → neck so the lathe faces point outward.
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0005, -length)];
  const n = 18;
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    // radius shrinks toward the apex
    const r = radius * (1 - 0.86 * Math.pow(t, 1.3));
    pts.push(new THREE.Vector2(Math.max(0.001, r), -t * length));
  }
  return new THREE.LatheGeometry(pts, 40);
}

/** Soft, rounded gum ridge (superellipsoid). */
export function createRidgeGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 96, 48);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const phi = Math.acos(Math.min(1, Math.max(-1, v.y)));
    const theta = Math.atan2(v.z, v.x);
    const sp = Math.sin(phi);
    const x = sgnPow(sp, 0.55) * sgnPow(Math.cos(theta), 0.5);
    const z = sgnPow(sp, 0.55) * sgnPow(Math.sin(theta), 0.5);
    const y = sgnPow(Math.cos(phi), 0.55);
    pos.setXYZ(i, x * w, y * h, z * d);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export const MOLAR: CrownParams = { width: 0.56, depth: 0.52, height: 0.5, cusps: 4, cuspHeight: 0.18 };
export const PREMOLAR: CrownParams = { width: 0.4, depth: 0.46, height: 0.52, cusps: 2, cuspHeight: 0.16, squareness: 0.7 };
export const CANINE: CrownParams = { width: 0.34, depth: 0.4, height: 0.58, cusps: 1, cuspHeight: 0.22, squareness: 0.85 };
export const INCISOR: CrownParams = { width: 0.36, depth: 0.26, height: 0.56, cusps: 0, cuspHeight: 0.12, squareness: 0.75 };
