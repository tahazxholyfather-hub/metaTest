import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MotionValue } from "framer-motion";
import { StudioLights, Tooth } from "./common";
import { CEMENTUM_PROPS, ENAMEL_PROPS, GUM_PROPS, makeMaterial } from "./materials";
import { ANATOMY, type AnatomyKey } from "../data";
import {
  CANINE,
  CANINE_ROOTS,
  MOLAR,
  MOLAR_ROOTS,
  PREMOLAR,
  PREMOLAR_ROOTS,
  createCrownGeometry,
  createGumCollarGeometry,
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
  idle: { pos: [0.5, 1.1, 5.6], look: [0.3, -0.35, 0] },
  enamel: { pos: [0.8, 2.6, 4.2], look: [0, 0.3, 0] },
  dentin: { pos: [1.8, 0.9, 4.0], look: [0.1, 0, 0] },
  pulp: { pos: [0.8, 0.4, 3.8], look: [0, -0.1, 0] },
  gum: { pos: [2.0, 0.3, 4.2], look: [0.5, -0.5, 0] },
  root: { pos: [1.6, -0.5, 4.3], look: [0.1, -0.9, 0] },
  nerve: { pos: [1.2, -0.9, 4.0], look: [0, -1.1, 0] },
};

const arcZ = (x: number) => 0.045 * x * x;

/** Scalloped gingival margin around one tooth neck. */
function GumCollar({ params, scale = 1, material, renderOrder }: { params: CrownParams; scale?: number; material: THREE.Material; renderOrder: number }) {
  const geo = useMemo(() => createGumCollarGeometry(params.width * 0.8 * scale, params.depth * 0.8 * scale, 0.13, 0.11), [params, scale]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={material} position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={renderOrder} />;
}

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
      dentin: makeMaterial({ ...CEMENTUM_PROPS, color: "#efe1c8", roughness: 0.5 }, true, "#6e9bff"),
      pulp: makeMaterial({ color: "#e5879b", roughness: 0.45, clearcoat: 0.3, sheen: 0.5, sheenColor: new THREE.Color("#ffc9d3") }, true, "#ff6f86"),
      root: makeMaterial(CEMENTUM_PROPS, true, "#6e9bff"),
      rootNeighbor: makeMaterial(CEMENTUM_PROPS, false),
      gum: makeMaterial(GUM_PROPS, true, "#ff6f86"),
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
  const ridge = useMemo(() => {
    const pts = [-2.4, -1.2, 0.2, 1.6, 3.0, 3.9].map((x) => new THREE.Vector3(x, 0, arcZ(x)));
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 64, 0.5, 40, false);
  }, []);

  useEffect(
    () => () => {
      dentinGeo.dispose();
      pulpGeo.dispose();
      canalGeos.forEach((g) => g.dispose());
      nerveGeos.forEach((g) => g.dispose());
      ridge.dispose();
    },
    [dentinGeo, pulpGeo, canalGeos, nerveGeos, ridge],
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
      const base = reducedMotion ? 0 : Math.sin(t * 0.35) * 0.08;
      group.current.rotation.y = base + (s - 0.5) * 0.9;
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
        autoRotateSpeed={0.35}
        onStart={() => {
          dragging.current = true;
          focusing.current = false;
        }}
        onEnd={() => {
          dragging.current = false;
        }}
      />

      <group ref={group} position={[-0.3, 0.05, 0]}>
        {/* Gum ridge */}
        <group position={[0, -1.02, 0]} scale={[1, 1.4, 1]}>
          <mesh geometry={ridge} material={mats.gum} receiveShadow castShadow renderOrder={4} />
          <mesh material={mats.gum} position={[-2.4, 0, arcZ(-2.4)]} renderOrder={4}>
            <sphereGeometry args={[0.5, 32, 24]} />
          </mesh>
          <mesh material={mats.gum} position={[3.9, 0, arcZ(3.9)]} renderOrder={4}>
            <sphereGeometry args={[0.5, 32, 24]} />
          </mesh>
        </group>

        {/* Hero molar with internal anatomy */}
        <group ref={hero} position={[0, 0, 0]}>
          <Tooth params={MOLAR} crownMaterial={mats.enamel} rootMaterial={mats.root} roots={MOLAR_ROOTS} renderOrder={3} />
          <mesh geometry={dentinGeo} material={mats.dentin} position={[0, -0.06, 0]} renderOrder={2} />
          <mesh geometry={pulpGeo} material={mats.pulp} position={[0, -0.26, 0]} renderOrder={1} />
          {MOLAR_ROOTS.map((r, i) => (
            <mesh key={i} geometry={canalGeos[i]} material={mats.pulp} position={[r.x, -0.42, 0]} rotation={[0, 0, r.tilt]} renderOrder={1} />
          ))}
          {nerveGeos.map((g, i) => (
            <mesh key={i} geometry={g} material={mats.nerve} renderOrder={0} />
          ))}
          <GumCollar params={MOLAR} material={mats.gum} renderOrder={4} />
        </group>

        {/* Neighbouring teeth along the arch */}
        {[
          { p: MOLAR, x: -1.5, roots: MOLAR_ROOTS, s: 0.96 },
          { p: PREMOLAR, x: 1.2, roots: PREMOLAR_ROOTS, s: 1 },
          { p: PREMOLAR, x: 2.1, roots: PREMOLAR_ROOTS, s: 0.96 },
          { p: CANINE, x: 2.95, roots: CANINE_ROOTS, s: 1 },
        ].map((t, i) => (
          <group key={i} position={[t.x, 0, arcZ(t.x)]} rotation={[0, -Math.atan(2 * 0.045 * t.x) * 0.8, 0]}>
            <Tooth
              params={t.p}
              scale={t.s}
              position={[0, (t.p.height - 0.5) * t.s, 0]}
              crownMaterial={mats.enamelNeighbor}
              rootMaterial={mats.rootNeighbor}
              roots={t.roots}
            />
            <GumCollar params={t.p} scale={t.s} material={mats.gum} renderOrder={4} />
          </group>
        ))}

        <ContactShadows position={[0.6, -1.72, 0.3]} opacity={0.32} scale={12} blur={2.6} far={2.5} resolution={512} color="#1b3a7a" frames={reducedMotion ? 1 : Infinity} />
      </group>
    </>
  );
}
