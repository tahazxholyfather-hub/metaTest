import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MotionValue } from "framer-motion";
import { StudioLights, Tooth } from "./common";
import { CEMENTUM_PROPS, ENAMEL_PROPS, GUM_DEEP_PROPS, GUM_PROPS, makeMaterial } from "./materials";
import { ANATOMY, type AnatomyKey } from "../data";
import {
  CANINE,
  INCISOR,
  MOLAR,
  MOLAR_ROOTS,
  PREMOLAR,
  createCrownGeometry,
  createRidgeGeometry,
  createRootGeometry,
  type CrownParams,
} from "./toothGeometry";

type Targets = { enamel: number; dentin: number; pulp: number; gum: number; root: number; nerve: number };

const OPACITY: Record<AnatomyKey | "idle", Targets> = {
  idle: { enamel: 1, dentin: 1, pulp: 0, gum: 1, root: 1, nerve: 0 },
  enamel: { enamel: 1, dentin: 1, pulp: 0, gum: 1, root: 1, nerve: 0 },
  dentin: { enamel: 0.14, dentin: 1, pulp: 0, gum: 1, root: 1, nerve: 0 },
  pulp: { enamel: 0.08, dentin: 0.28, pulp: 1, gum: 1, root: 1, nerve: 0 },
  gum: { enamel: 1, dentin: 1, pulp: 0, gum: 1, root: 1, nerve: 0 },
  root: { enamel: 1, dentin: 1, pulp: 0, gum: 0.16, root: 1, nerve: 0 },
  nerve: { enamel: 0.1, dentin: 0.26, pulp: 0.45, gum: 0.12, root: 0.3, nerve: 1 },
};

const CAMERA: Record<AnatomyKey | "idle", { pos: [number, number, number]; look: [number, number, number] }> = {
  idle: { pos: [0.28, 0.42, 4.05], look: [0.22, -0.08, 0] },
  enamel: { pos: [0.1, 1.05, 2.7], look: [0.02, 0.2, 0] },
  dentin: { pos: [1.05, 0.4, 2.75], look: [0.02, 0.02, 0] },
  pulp: { pos: [0.15, 0.12, 2.45], look: [0, -0.06, 0] },
  gum: { pos: [1.15, 0.05, 3.15], look: [0.25, -0.32, 0] },
  root: { pos: [0.55, -0.72, 3.35], look: [0.02, -0.78, 0] },
  nerve: { pos: [0.25, -0.55, 2.95], look: [0, -0.62, 0] },
};

/** Necks share one gingival line so crowns read as one row, not a stack of spikes. */
const NECK = -0.48;
const placeY = (height: number, scale: number) => NECK + height * scale;

/**
 * A short clinical segment. Crowns overlap by ~0.02. The teaching molar stays at the origin
 * so the DOM hotspots (anchored in its local space) keep lining up.
 */
const SOFT_CANINE: CrownParams = { ...CANINE, height: 0.5, cuspHeight: 0.1 };
const NEIGHBORS: { p: CrownParams; x: number; s: number; warm?: boolean }[] = [
  { p: PREMOLAR, x: -0.444, s: 0.92 },
  { p: PREMOLAR, x: 0.444, s: 0.92 },
  { p: SOFT_CANINE, x: 0.72, s: 0.9 },
  { p: INCISOR, x: 0.99, s: 0.86, warm: true },
];

type Props = {
  active: AnatomyKey | null;
  scroll: MotionValue<number>;
  reducedMotion: boolean;
  /** DOM hotspots (rendered by the section) that follow the 3D anchors. */
  hotspotEls: RefObject<Array<HTMLDivElement | null>>;
};

export default function AnatomyScene({ active, scroll, reducedMotion, hotspotEls }: Props) {
  const group = useRef<THREE.Group>(null);
  const hero = useRef<THREE.Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const dragging = useRef(false);
  const focusing = useRef(true);
  const lookTarget = useRef(new THREE.Vector3(...CAMERA.idle.look));

  const mats = useMemo(
    () => ({
      enamel: makeMaterial(ENAMEL_PROPS, true),
      enamelNeighbor: makeMaterial(ENAMEL_PROPS, false),
      enamelWarm: makeMaterial({ ...ENAMEL_PROPS, color: "#f4eadc" }, false),
      dentin: makeMaterial({ ...CEMENTUM_PROPS, color: "#efe1c8", roughness: 0.5 }, true, "#6e9bff"),
      pulp: makeMaterial({ color: "#e5879b", roughness: 0.45, clearcoat: 0.3, sheen: 0.5, sheenColor: new THREE.Color("#ffc9d3") }, true, "#ff6f86"),
      root: makeMaterial(CEMENTUM_PROPS, true, "#6e9bff"),
      gum: makeMaterial(GUM_PROPS, true, "#ff6f86"),
      mouth: makeMaterial(GUM_DEEP_PROPS, false),
      nerve: makeMaterial({ color: "#e14c63", roughness: 0.35, clearcoat: 0.6 }, true, "#ff3b5c", 0.3),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const dentinGeo = useMemo(
    () => createCrownGeometry({ width: MOLAR.width * 0.84, depth: MOLAR.depth * 0.84, height: MOLAR.height * 0.86, cusps: 4, cuspHeight: 0.12, segments: 80 }),
    [],
  );
  const pulpGeo = useMemo(
    () => createCrownGeometry({ width: MOLAR.width * 0.42, depth: MOLAR.depth * 0.4, height: MOLAR.height * 0.34, cusps: 4, cuspHeight: 0.3, segments: 48 }),
    [],
  );
  const canalGeos = useMemo(() => MOLAR_ROOTS.map((r) => createRootGeometry(r.length * 0.92, 0.07, r.bend ?? 0)), []);
  const nerveGeos = useMemo(
    () =>
      MOLAR_ROOTS.map((r) => {
        // Follows the root axis (rotated about z by `tilt`, curving by `bend`) so the nerve sits inside the canal.
        const bend = r.bend ?? 0;
        const along = (d: number) => {
          const t = Math.min(1, d / r.length);
          return new THREE.Vector3(r.x + Math.sin(r.tilt) * d + bend * r.length * t * t, -0.46 - Math.cos(r.tilt) * d, 0);
        };
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.2, 0),
          new THREE.Vector3(r.x * 0.9, -0.4, 0),
          along(0.5),
          along(r.length),
          along(r.length + 0.3).add(new THREE.Vector3(r.x * 0.5, -0.05, 0.08)),
        ]);
        return new THREE.TubeGeometry(curve, 48, 0.02, 10, false);
      }),
    [],
  );
  // One smooth gingival volume. Crowns emerge from the top; roots stay inside until that layer is opened.
  const gumPad = useMemo(() => createRidgeGeometry(1.16, 0.74, 0.46, 0.48, 0.62), []);
  const gumLip = useMemo(() => createRidgeGeometry(1.02, 0.11, 0.1, 0.4, 0.7), []);

  useEffect(
    () => () => {
      dentinGeo.dispose();
      pulpGeo.dispose();
      canalGeos.forEach((g) => g.dispose());
      nerveGeos.forEach((g) => g.dispose());
      gumPad.dispose();
      gumLip.dispose();
    },
    [dentinGeo, pulpGeo, canalGeos, nerveGeos, gumPad, gumLip],
  );

  // Re-arm camera focus whenever the selection changes.
  useEffect(() => {
    focusing.current = true;
  }, [active]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const k = 1 - Math.pow(0.0025, dt); // smooth, frame-rate independent lerp
    const key = active ?? "idle";
    const target = OPACITY[key];

    const lerpMat = (m: THREE.MeshPhysicalMaterial, o: number, glow: number) => {
      m.opacity += (o - m.opacity) * k;
      m.depthWrite = m.opacity > 0.96;
      m.visible = m.opacity > 0.02;
      m.emissiveIntensity += (glow - m.emissiveIntensity) * k;
    };
    lerpMat(mats.enamel, target.enamel, active === "enamel" ? 0.22 : 0);
    lerpMat(mats.dentin, target.dentin, active === "dentin" ? 0.3 : 0);
    lerpMat(mats.pulp, target.pulp, active === "pulp" ? 0.45 : 0);
    lerpMat(mats.gum, target.gum, active === "gum" ? 0.3 : 0);
    lerpMat(mats.root, target.root, active === "root" ? 0.35 : 0);
    lerpMat(mats.nerve, target.nerve, active === "nerve" ? 1.1 : 0.3);

    if (group.current) {
      const t = state.clock.elapsedTime;
      const s = scroll.get();
      const base = reducedMotion ? 0 : Math.sin(t * 0.35) * 0.05;
      group.current.rotation.y = base + (s - 0.5) * 0.28;
      group.current.position.y = reducedMotion ? 0 : Math.sin(t * 0.7) * 0.035;
    }

    // Project anchors to screen space for the DOM hotspots.
    if (hero.current) {
      hero.current.updateWorldMatrix(true, false);
      ANATOMY.forEach((a, i) => {
        const el = hotspotEls.current?.[i];
        if (!el) return;
        tmp.set(...a.anchor);
        hero.current!.localToWorld(tmp).project(camera);
        const x = (tmp.x * 0.5 + 0.5) * state.size.width;
        const y = (-tmp.y * 0.5 + 0.5) * state.size.height;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.style.opacity = tmp.z < 1 ? "1" : "0";
      });
    }

    const c = controls.current;
    if (!c) return;
    if (focusing.current && !dragging.current) {
      const cam = CAMERA[key];
      // Narrow viewports need the camera further back to keep the arch framed.
      const aspect = state.size.width / Math.max(1, state.size.height);
      const fix = Math.max(1, 1.2 / aspect);
      lookTarget.current.set(...cam.look);
      tmp.set(...cam.pos).sub(lookTarget.current).multiplyScalar(fix).add(lookTarget.current);
      camera.position.lerp(tmp, k * 0.9);
      c.target.lerp(lookTarget.current, k * 0.9);
      if (camera.position.distanceTo(tmp) < 0.01 && c.target.distanceTo(lookTarget.current) < 0.01) {
        focusing.current = false;
      }
    }
    c.update();
  });

  return (
    <>
      <StudioLights />
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.55}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.78}
        minAzimuthAngle={-Math.PI * 0.6}
        maxAzimuthAngle={Math.PI * 0.6}
        autoRotate={!reducedMotion && !active}
        autoRotateSpeed={0.22}
        onStart={() => {
          dragging.current = true;
          focusing.current = false;
        }}
        onEnd={() => {
          dragging.current = false;
        }}
      />

      <group ref={group} position={[-0.06, 0.08, 0]}>
        <mesh material={mats.mouth} position={[0.28, -0.55, -0.72]} scale={[1.35, 0.85, 0.42]} renderOrder={0}>
          <sphereGeometry args={[1, 40, 28]} />
        </mesh>
        <mesh geometry={gumPad} material={mats.gum} position={[0.28, -0.96, -0.02]} castShadow receiveShadow renderOrder={2} />
        <mesh geometry={gumLip} material={mats.gum} position={[0.28, -0.36, 0.2]} renderOrder={5} />

        {/* Hero molar with internal anatomy. Stays at the local origin for hotspot projection. */}
        <group ref={hero} position={[0, 0, 0]}>
          <Tooth params={MOLAR} crownMaterial={mats.enamel} rootMaterial={mats.root} roots={MOLAR_ROOTS} renderOrder={4} />
          <mesh geometry={dentinGeo} material={mats.dentin} position={[0, -0.06, 0]} renderOrder={3} />
          <mesh geometry={pulpGeo} material={mats.pulp} position={[0, -0.26, 0]} renderOrder={2} />
          {MOLAR_ROOTS.map((r, i) => (
            <mesh key={i} geometry={canalGeos[i]} material={mats.pulp} position={[r.x, -0.42, 0]} rotation={[0, 0, r.tilt]} renderOrder={2} />
          ))}
          {nerveGeos.map((g, i) => (
            <mesh key={i} geometry={g} material={mats.nerve} renderOrder={1} />
          ))}
        </group>

        {NEIGHBORS.map((t, i) => (
          <Tooth
            key={i}
            params={t.p}
            scale={t.s}
            position={[t.x, placeY(t.p.height, t.s), 0.012 * t.x * t.x]}
            rotation={[0.02, -0.04 * t.x, 0]}
            crownMaterial={t.warm ? mats.enamelWarm : mats.enamelNeighbor}
            renderOrder={4}
          />
        ))}

        <ContactShadows position={[0.3, -1.62, 0.2]} opacity={0.28} scale={8} blur={2.4} far={2.2} resolution={512} color="#1b3a7a" frames={reducedMotion ? 1 : Infinity} />
      </group>
    </>
  );
}
