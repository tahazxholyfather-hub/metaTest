import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MotionValue } from "framer-motion";
import { CEMENTUM_PROPS, ENAMEL_PROPS, GUM_PROPS, StudioLights, Tooth, makeMaterial } from "./common";
import { CANINE, MOLAR, PREMOLAR, createCrownGeometry, createRootGeometry } from "./toothGeometry";

export type AnatomyKey = "enamel" | "dentin" | "pulp" | "gum" | "root" | "nerve";

export const ANATOMY: Array<{
  key: AnatomyKey;
  label: string;
  short: string;
  description: string;
  anchor: [number, number, number];
}> = [
  {
    key: "enamel",
    label: "Enamel",
    short: "The hardest substance in the body",
    description:
      "A translucent mineral shell that protects the crown from daily wear, temperature and acids. Enamel cannot regrow, which is why preventive care and gentle polishing matter so much.",
    anchor: [0.32, 0.64, 0.3],
  },
  {
    key: "dentin",
    label: "Dentin",
    short: "The living core beneath the enamel",
    description:
      "Slightly yellow and softer than enamel, dentin gives teeth their warmth and resilience. Microscopic tubules carry sensation, which is why exposed dentin can feel sensitive.",
    anchor: [0.62, 0.12, 0.08],
  },
  {
    key: "pulp",
    label: "Pulp",
    short: "Blood supply and vitality",
    description:
      "The soft chamber at the centre of the tooth houses blood vessels and connective tissue. Keeping it healthy is the goal of every restorative treatment we plan.",
    anchor: [0, -0.02, 0.56],
  },
  {
    key: "gum",
    label: "Gum",
    short: "The seal around every tooth",
    description:
      "Healthy gingiva fits snugly around the neck of each tooth, protecting the bone underneath. Firm, pale-pink tissue is the foundation of a long-lasting smile.",
    anchor: [0.78, -0.42, 0.42],
  },
  {
    key: "root",
    label: "Root",
    short: "Anchored deep in the jaw",
    description:
      "Two-thirds of a tooth sits below the surface. Roots are covered in cementum and held by ligament fibres, which is what implants are designed to replicate.",
    anchor: [0.3, -1.1, 0.32],
  },
  {
    key: "nerve",
    label: "Nerve",
    short: "Sensation and feedback",
    description:
      "Fine nerve fibres enter through the apex of each root. Modern root canal therapy gently treats this canal while preserving the natural tooth.",
    anchor: [0, -1.56, 0.3],
  },
];

type Targets = { enamel: number; dentin: number; pulp: number; gum: number; root: number; nerve: number };

const OPACITY: Record<AnatomyKey | "idle", Targets> = {
  idle: { enamel: 1, dentin: 1, pulp: 1, gum: 1, root: 1, nerve: 1 },
  enamel: { enamel: 1, dentin: 1, pulp: 1, gum: 1, root: 1, nerve: 1 },
  dentin: { enamel: 0.14, dentin: 1, pulp: 1, gum: 1, root: 1, nerve: 1 },
  pulp: { enamel: 0.08, dentin: 0.28, pulp: 1, gum: 1, root: 1, nerve: 1 },
  gum: { enamel: 1, dentin: 1, pulp: 1, gum: 1, root: 1, nerve: 1 },
  root: { enamel: 1, dentin: 1, pulp: 1, gum: 0.16, root: 1, nerve: 1 },
  nerve: { enamel: 0.1, dentin: 0.26, pulp: 0.6, gum: 0.12, root: 0.32, nerve: 1 },
};

const CAMERA: Record<AnatomyKey | "idle", { pos: [number, number, number]; look: [number, number, number] }> = {
  idle: { pos: [0.5, 1.1, 5.4], look: [0.3, -0.35, 0] },
  enamel: { pos: [0.7, 2.2, 3.4], look: [0, 0.35, 0] },
  dentin: { pos: [1.5, 0.7, 3.1], look: [0.1, 0.05, 0] },
  pulp: { pos: [0.6, 0.3, 2.8], look: [0, -0.05, 0] },
  gum: { pos: [1.7, 0.1, 3.4], look: [0.5, -0.5, 0] },
  root: { pos: [1.3, -0.5, 3.4], look: [0.1, -0.95, 0] },
  nerve: { pos: [0.9, -0.9, 2.9], look: [0, -1.25, 0] },
};

const MOLAR_ROOTS = [
  { x: -0.24, tilt: 0.16, length: 1.12, radius: 0.16 },
  { x: 0.24, tilt: -0.16, length: 1.08, radius: 0.16 },
];
const PREMOLAR_ROOTS = [{ x: 0, tilt: 0, length: 1.15, radius: 0.17 }];
const CANINE_ROOTS = [{ x: 0, tilt: 0.04, length: 1.3, radius: 0.15 }];

const arcZ = (x: number) => 0.045 * x * x;

type Props = {
  active: AnatomyKey | null;
  onSelect: (k: AnatomyKey | null) => void;
  scroll: MotionValue<number>;
  reducedMotion: boolean;
};

export default function AnatomyScene({ active, onSelect, scroll, reducedMotion }: Props) {
  const group = useRef<THREE.Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const dragging = useRef(false);
  const focusing = useRef(true);
  const lookTarget = useRef(new THREE.Vector3(...CAMERA.idle.look));

  const mats = useMemo(
    () => ({
      enamel: makeMaterial(ENAMEL_PROPS, true),
      enamelNeighbor: makeMaterial(ENAMEL_PROPS, false),
      dentin: makeMaterial({ ...CEMENTUM_PROPS, color: "#efe1c8", roughness: 0.5 }, true),
      pulp: makeMaterial({ color: "#e5879b", roughness: 0.45, clearcoat: 0.3, sheen: 0.5, sheenColor: new THREE.Color("#ffc9d3") }, true),
      root: makeMaterial(CEMENTUM_PROPS, true),
      rootNeighbor: makeMaterial(CEMENTUM_PROPS, false),
      gum: makeMaterial(GUM_PROPS, true),
      nerve: makeMaterial({ color: "#e14c63", roughness: 0.35, clearcoat: 0.6 }, true),
    }),
    [],
  );
  useEffect(() => {
    mats.gum.emissive.set("#ff6f86");
    mats.pulp.emissive.set("#ff6f86");
    mats.nerve.emissive.set("#ff3b5c");
    mats.dentin.emissive.set("#6e9bff");
    mats.root.emissive.set("#6e9bff");
    mats.nerve.emissiveIntensity = 0.25;
    return () => Object.values(mats).forEach((m) => m.dispose());
  }, [mats]);

  const dentinGeo = useMemo(
    () => createCrownGeometry({ width: MOLAR.width * 0.84, depth: MOLAR.depth * 0.84, height: MOLAR.height * 0.86, cusps: 4, cuspHeight: 0.12, segments: 80 }),
    [],
  );
  const pulpGeo = useMemo(
    () => createCrownGeometry({ width: MOLAR.width * 0.42, depth: MOLAR.depth * 0.4, height: MOLAR.height * 0.34, cusps: 4, cuspHeight: 0.3, segments: 48 }),
    [],
  );
  const canalGeo = useMemo(() => createRootGeometry(1.0, 0.07), []);
  const nerveGeos = useMemo(
    () =>
      MOLAR_ROOTS.map((r) => {
        const sx = r.x;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(sx * 0.4, -0.25, 0),
          new THREE.Vector3(sx + Math.sin(r.tilt) * 0.5, -0.95, 0.02),
          new THREE.Vector3(sx + Math.sin(r.tilt) * 1.05, -1.55, 0.04),
          new THREE.Vector3(sx + Math.sin(r.tilt) * 1.35 + sx * 0.6, -1.95, 0.12),
        ]);
        return new THREE.TubeGeometry(curve, 40, 0.022, 10, false);
      }),
    [],
  );
  const ridge = useMemo(() => {
    const pts = [-2.4, -1.2, 0.2, 1.6, 3.0, 3.9].map((x) => new THREE.Vector3(x, 0, arcZ(x)));
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 48, 0.46, 36, false);
  }, []);

  useEffect(
    () => () => {
      dentinGeo.dispose();
      pulpGeo.dispose();
      canalGeo.dispose();
      nerveGeos.forEach((g) => g.dispose());
      ridge.dispose();
    },
    [dentinGeo, pulpGeo, canalGeo, nerveGeos, ridge],
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
      m.emissiveIntensity += (glow - m.emissiveIntensity) * k;
    };
    lerpMat(mats.enamel, target.enamel, active === "enamel" ? 0.22 : 0);
    lerpMat(mats.dentin, target.dentin, active === "dentin" ? 0.3 : 0);
    lerpMat(mats.pulp, target.pulp, active === "pulp" ? 0.45 : 0);
    lerpMat(mats.gum, target.gum, active === "gum" ? 0.3 : 0);
    lerpMat(mats.root, target.root, active === "root" ? 0.35 : 0);
    lerpMat(mats.nerve, target.nerve, active === "nerve" ? 1.1 : 0.25);

    if (group.current) {
      const t = state.clock.elapsedTime;
      const s = scroll.get();
      const base = reducedMotion ? 0 : Math.sin(t * 0.35) * 0.08;
      group.current.rotation.y = base + (s - 0.5) * 0.9;
      group.current.position.y = reducedMotion ? 0 : Math.sin(t * 0.7) * 0.035;
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
        <group position={[0, -0.97, 0]} scale={[1, 1.45, 1]}>
          <mesh geometry={ridge} material={mats.gum} receiveShadow castShadow renderOrder={4} />
          <mesh material={mats.gum} position={[-2.4, 0, arcZ(-2.4)]} renderOrder={4}>
            <sphereGeometry args={[0.46, 32, 24]} />
          </mesh>
          <mesh material={mats.gum} position={[3.9, 0, arcZ(3.9)]} renderOrder={4}>
            <sphereGeometry args={[0.46, 32, 24]} />
          </mesh>
        </group>

        {/* Hero molar with internal anatomy */}
        <group position={[0, 0, 0]}>
          <Tooth params={MOLAR} crownMaterial={mats.enamel} rootMaterial={mats.root} roots={MOLAR_ROOTS} renderOrder={3} />
          <mesh geometry={dentinGeo} material={mats.dentin} position={[0, -0.06, 0]} renderOrder={2} />
          <mesh geometry={pulpGeo} material={mats.pulp} position={[0, -0.26, 0]} renderOrder={1} />
          {MOLAR_ROOTS.map((r, i) => (
            <mesh key={i} geometry={canalGeo} material={mats.pulp} position={[r.x, -0.44, 0]} rotation={[0, 0, r.tilt]} renderOrder={1} />
          ))}
          {nerveGeos.map((g, i) => (
            <mesh key={i} geometry={g} material={mats.nerve} renderOrder={0} />
          ))}
          {/* Gum collar */}
          <mesh material={mats.gum} position={[0, -0.36, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[MOLAR.width * 0.78, MOLAR.depth * 0.78, 1]} renderOrder={4}>
            <torusGeometry args={[1, 0.11, 18, 56]} />
          </mesh>

          {ANATOMY.map((a) => (
            <Html key={a.key} position={a.anchor} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
              <div className={`dl-hotspot ${active === a.key ? "is-active" : ""}`}>
                <button
                  type="button"
                  aria-label={a.label}
                  className="dl-hotspot-dot"
                  style={{ pointerEvents: "auto" }}
                  onClick={() => onSelect(active === a.key ? null : a.key)}
                />
                <span className="dl-hotspot-line" />
                <span className="dl-hotspot-label">{a.label}</span>
              </div>
            </Html>
          ))}
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
            <mesh
              material={mats.gum}
              position={[0, -0.36, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[t.p.width * 0.78 * t.s, t.p.depth * 0.78 * t.s, 1]}
              renderOrder={4}
            >
              <torusGeometry args={[1, 0.1, 18, 56]} />
            </mesh>
          </group>
        ))}

        <ContactShadows position={[0.6, -1.72, 0.3]} opacity={0.32} scale={12} blur={2.6} far={2.5} resolution={512} color="#1b3a7a" frames={reducedMotion ? 1 : Infinity} />
      </group>
    </>
  );
}
