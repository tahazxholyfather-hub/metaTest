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
  /** vertical superellipse exponent of the occlusal half: lower = flatter table */
  flatness?: number;
  segments?: number;
};

export type RootSpec = {
  x: number;
  z?: number;
  tilt: number;
  length: number;
  radius: number;
  /** Sideways curve of the apex, in units of root length (positive = toward +x). */
  bend?: number;
  /** Cross-section aspect: how much deeper (z) than wide the root is. */
  flatten?: number;
};

const sgnPow = (a: number, e: number) => Math.sign(a) * Math.pow(Math.abs(a), e);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, z: number, cx: number, cz: number, s: number) =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));

/** Gaussian falloff from the segment (ax,az)→(bx,bz); used for cusp ridges. */
function ridge(x: number, z: number, ax: number, az: number, bx: number, bz: number, s: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = clamp01(((x - ax) * dx + (z - az) * dz) / len2);
  const px = ax + dx * t;
  const pz = az + dz * t;
  return Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (2 * s * s));
}

/**
 * Procedural crown: a superellipsoid shell with a straight, slightly constricted
 * cervical third, a height of contour just above the equator and a sculpted
 * occlusal table (cusps, triangular ridges, fissures, marginal ridges).
 * Occupies y ∈ [-height, +height]; the neck is at the bottom.
 */
export function createCrownGeometry(p: CrownParams): THREE.BufferGeometry {
  const seg = p.segments ?? 128;
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const e2 = p.squareness ?? 0.6;
  const eTop = p.flatness ?? 0.7;
  const eBot = 0.42; // squarer below the equator → straighter walls, flatter cervical cut
  const cuspH = p.cuspHeight ?? 0.16;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const c = Math.min(1, Math.max(-1, v.y));
    const phi = Math.acos(c);
    const theta = Math.atan2(v.z, v.x);
    const sp = Math.sin(phi);
    const ev = c >= 0 ? eTop : eBot;
    const ux = sgnPow(Math.cos(theta), e2);
    const uz = sgnPow(Math.sin(theta), e2);
    const r = sgnPow(sp, ev);
    let y = sgnPow(c, ev);

    // Height of contour just above the equator, then a constriction toward the neck.
    const contour = 1 + 0.07 * Math.exp(-((y - 0.08) ** 2) / 0.09);
    const neck = 1 - 0.24 * smoothstep(-0.15, -1, y) ** 1.25;
    // Buccal side (+z) is a little fuller than the lingual side.
    const asym = 1 + 0.04 * uz * (0.6 + 0.4 * y);
    // Developmental grooves run down the walls between the cusp lobes (deepest on the buccal / lingual faces),
    // and a faint wave across the surface keeps the enamel from reading as a perfect plastic shell.
    const wall = smoothstep(-0.55, 0.35, y);
    let grooves = 0;
    if (p.cusps === 4) {
      const s2 = Math.sin(2 * theta);
      grooves = 0.02 * Math.exp(-(s2 * s2) / 0.07) * (0.45 + 0.55 * Math.sin(theta) ** 2) * wall;
    } else if (p.cusps === 2) {
      grooves = 0.04 * Math.exp(-(Math.cos(theta) ** 2) / 0.06) * wall; // mesial / distal marginal grooves
    } else if (p.cusps === 1) {
      grooves = -0.03 * Math.exp(-(Math.cos(theta) ** 2) / 0.1) * wall; // labial ridge stands proud
    }
    const wave = 0.004 * Math.sin(y * 42 + theta * 3) * (1 - Math.abs(y));
    const radial = contour * neck * asym * (1 - grooves + wave);
    let x = ux * r * radial;
    let z = uz * r * radial;

    if (y > 0) {
      const w = smoothstep(0.3, 0.92, y);
      // Normalised occlusal coordinates, table rim at |n| ≈ 1.
      const nx = x / Math.max(1e-4, contour);
      const nz = z / Math.max(1e-4, contour);
      const rho = Math.pow(Math.pow(Math.abs(nx), 2 / e2) + Math.pow(Math.abs(nz), 2 / e2), e2 / 2);
      const inner = 1 - smoothstep(0.78, 1, rho);
      const marginal = Math.exp(-((rho - 0.8) ** 2) / 0.012);
      let relief = 0;

      if (p.cusps === 4) {
        const tips: Array<[number, number, number]> = [
          [0.48, 0.5, 1.0], // mesio-buccal
          [-0.5, 0.5, 0.92], // disto-buccal
          [0.46, -0.5, 0.88], // mesio-lingual
          [-0.48, -0.48, 0.74], // disto-lingual
        ];
        let bumps = 0;
        let ridges = 0;
        for (const [cx, cz, h] of tips) {
          bumps += h * gauss(nx, nz, cx, cz, 0.3);
          ridges += 0.45 * h * ridge(nx, nz, cx, cz, 0, 0, 0.13);
        }
        const groove = 0.5 * (Math.exp(-(nz * nz) / 0.018) + Math.exp(-(nx * nx) / 0.018)) * inner;
        const fossa = 0.6 * gauss(nx, nz, 0, 0, 0.16) + 0.3 * gauss(nx, nz, 0.52, 0, 0.1) + 0.3 * gauss(nx, nz, -0.54, 0, 0.1);
        relief = bumps + ridges + 0.3 * marginal - groove - fossa;
      } else if (p.cusps === 2) {
        const bumps = gauss(nx, nz, 0, 0.5, 0.36) + 0.9 * gauss(nx, nz, 0, -0.5, 0.36);
        const ridges = 0.4 * (ridge(nx, nz, 0, 0.5, 0, 0, 0.14) + ridge(nx, nz, 0, -0.5, 0, 0, 0.14));
        const groove = 0.55 * Math.exp(-(nz * nz) / 0.018) * inner;
        const pits = 0.35 * (gauss(nx, nz, 0.55, 0, 0.1) + gauss(nx, nz, -0.55, 0, 0.1));
        relief = bumps + ridges + 0.28 * marginal - groove - pits;
      } else if (p.cusps === 1) {
        // Single pointed cusp with a labial ridge and two sloping cusp arms.
        const tip = 1.7 * gauss(nx, nz, 0, 0.05, 0.42);
        const arms = 0.35 * (ridge(nx, nz, 0, 0, 0.85, -0.1, 0.16) + ridge(nx, nz, 0, 0, -0.85, -0.1, 0.16));
        const labial = 0.25 * Math.exp(-(nx * nx) / 0.05) * smoothstep(-0.2, 0.9, nz);
        relief = tip + arms + labial;
      } else {
        // Incisal edge: a thin ridge along x with three faint mamelons.
        const edge = 1.1 * Math.exp(-(nz * nz) / 0.05);
        const mamelons = 0.18 * (gauss(nx, nz, -0.5, 0, 0.17) + gauss(nx, nz, 0, 0, 0.17) + gauss(nx, nz, 0.5, 0, 0.17));
        relief = edge + mamelons;
      }
      y += w * cuspH * relief;
    }

    pos.setXYZ(i, x * p.width, y * p.height, z * p.depth);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Root: flares to the full neck radius at the top, dips slightly below the
 * cervical line, tapers to a rounded apex and curves gently sideways.
 * Occupies y ∈ [-length, 0].
 */
export function createRootGeometry(length: number, radius: number, bend = 0.12): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 = neck, 1 = apex
    // Full-bodied for the first half, then a quick taper into a blunt, rounded apex.
    const taper = Math.pow(1 - Math.pow(t, 1.7), 0.6);
    const waist = 1 - 0.05 * Math.sin(Math.PI * Math.min(1, t * 2.4));
    const r = Math.max(0.002, radius * taper * waist);
    pts.push(new THREE.Vector2(r, -t * length));
  }
  pts.push(new THREE.Vector2(0.0005, -length - 0.004));
  // Profile runs neck → apex, so reverse to keep lathe faces pointing outward.
  const geo = new THREE.LatheGeometry(pts.reverse(), 56);

  if (bend !== 0) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = clamp01(-y / length);
      pos.setX(i, pos.getX(i) + bend * length * t * t);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

/** Soft, rounded superellipsoid (gum ridge, root trunk). */
export function createRidgeGeometry(w: number, h: number, d: number, e = 0.5, ev = 0.55): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 96, 48);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const phi = Math.acos(Math.min(1, Math.max(-1, v.y)));
    const theta = Math.atan2(v.z, v.x);
    const sp = Math.sin(phi);
    const x = sgnPow(sp, ev) * sgnPow(Math.cos(theta), e);
    const z = sgnPow(sp, ev) * sgnPow(Math.sin(theta), e);
    const y = sgnPow(Math.cos(phi), ev);
    pos.setXYZ(i, x * w, y * h, z * d);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Gum collar: a torus whose centre line rises between the teeth (interdental
 * papillae at ±x) and dips at the facial / lingual surfaces, like a real gingival margin.
 */
export function createGumCollarGeometry(rx: number, rz: number, tube: number, scallop: number): THREE.BufferGeometry {
  const radial = 20;
  const tubular = 72;
  const geo = new THREE.TorusGeometry(1, tube, radial, tubular);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(y, x); // torus lies in xy; we map y → arch depth below
    const rise = scallop * (0.5 + 0.5 * Math.cos(2 * ang));
    // Local tube offset from the centre ring.
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const ox = x - cx;
    const oy = y - cy;
    pos.setXYZ(i, (cx + ox) * rx, (cy + oy) * rz, z + rise);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export const MOLAR: CrownParams = { width: 0.56, depth: 0.52, height: 0.48, cusps: 4, cuspHeight: 0.16, squareness: 0.58, flatness: 0.68 };
export const PREMOLAR: CrownParams = { width: 0.4, depth: 0.46, height: 0.52, cusps: 2, cuspHeight: 0.2, squareness: 0.68, flatness: 0.66 };
export const CANINE: CrownParams = { width: 0.34, depth: 0.4, height: 0.58, cusps: 1, cuspHeight: 0.24, squareness: 0.82 };
export const INCISOR: CrownParams = { width: 0.36, depth: 0.26, height: 0.56, cusps: 0, cuspHeight: 0.12, squareness: 0.75 };

export const MOLAR_ROOTS: RootSpec[] = [
  { x: -0.2, tilt: -0.22, length: 1.0, radius: 0.2, bend: -0.08, flatten: 1.6 },
  { x: 0.2, tilt: 0.2, length: 0.94, radius: 0.2, bend: 0.1, flatten: 1.6 },
];
export const PREMOLAR_ROOTS: RootSpec[] = [{ x: 0, tilt: 0.02, length: 1.1, radius: 0.26, bend: 0.08, flatten: 1.25 }];
export const CANINE_ROOTS: RootSpec[] = [{ x: 0, tilt: 0.03, length: 1.25, radius: 0.23, bend: 0.1, flatten: 1.2 }];
export const INCISOR_ROOTS: RootSpec[] = [{ x: 0, tilt: 0.02, length: 1.05, radius: 0.22, bend: 0.06, flatten: 0.8 }];
