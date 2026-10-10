import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { PointerParallax, StudioLights, Tooth } from "./common";
import { CEMENTUM_PROPS, ENAMEL_PROPS, GUM_DEEP_PROPS, GUM_PROPS, makeMaterial } from "./materials";
import {
  CANINE,
  CANINE_ROOTS,
  INCISOR,
  INCISOR_ROOTS,
  MOLAR,
  MOLAR_ROOTS,
  PREMOLAR,
  PREMOLAR_ROOTS,
  createGumCollarGeometry,
  type CrownParams,
  type RootSpec,
} from "./toothGeometry";

const STATS_ARCH: { p: CrownParams; roots: RootSpec[]; s: number; warm?: boolean }[] = [
  { p: MOLAR, roots: MOLAR_ROOTS, s: 0.92 },
  { p: PREMOLAR, roots: PREMOLAR_ROOTS, s: 0.98 },
  { p: CANINE, roots: CANINE_ROOTS, s: 1, warm: true },
  { p: INCISOR, roots: INCISOR_ROOTS, s: 0.96 },
  { p: INCISOR, roots: INCISOR_ROOTS, s: 0.96, warm: true },
  { p: CANINE, roots: CANINE_ROOTS, s: 1 },
  { p: PREMOLAR, roots: PREMOLAR_ROOTS, s: 0.98 },
  { p: MOLAR, roots: MOLAR_ROOTS, s: 0.92 },
];

function statsArchXs(gap = -0.055) {
  const xs: number[] = [];
  let edge = 0;
  STATS_ARCH.forEach((t, i) => {
    const w = t.p.width * t.s;
    const x = i === 0 ? w / 2 : edge + gap + w / 2;
    xs.push(x);
    edge = x + w / 2;
  });
  const mid = (xs[0] + xs[xs.length - 1]) / 2;
  return xs.map((x) => x - mid);
}

const STATS_X = statsArchXs();
const statsZ = (x: number) => 0.07 * x * x;

function StatsSmile() {
  const mats = useMemo(
    () => ({
      enamel: makeMaterial(ENAMEL_PROPS),
      warm: makeMaterial({ ...ENAMEL_PROPS, color: "#f6d7b4" }),
      root: makeMaterial(CEMENTUM_PROPS),
      gum: makeMaterial(GUM_PROPS),
      mouth: makeMaterial(GUM_DEEP_PROPS),
    }),
    [],
  );
  const collars = useMemo(
    () => STATS_ARCH.map((t) => createGumCollarGeometry(t.p.width * 0.78 * t.s, t.p.depth * 0.78 * t.s, 0.12, 0.1)),
    [],
  );
  const ridge = useMemo(() => {
    const pts = [-1.7, -0.8, 0, 0.8, 1.7].map((x) => new THREE.Vector3(x, 0, statsZ(x)));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 72, 0.34, 24, false);
  }, []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      collars.forEach((g) => g.dispose());
      ridge.dispose();
    },
    [mats, collars, ridge],
  );

  return (
    <group>
      <mesh material={mats.mouth} position={[0, -0.08, -0.72]} scale={[1.9, 0.82, 0.42]}>
        <sphereGeometry args={[1, 40, 28]} />
      </mesh>
      <mesh geometry={ridge} material={mats.gum} position={[0, -0.72, 0]} scale={[1.05, 1.12, 1]} />
      {STATS_ARCH.map((t, i) => (
        <group key={i} position={[STATS_X[i], 0, statsZ(STATS_X[i])]} rotation={[0.05, -Math.atan(0.14 * STATS_X[i]), 0]}>
          <Tooth
            params={t.p}
            scale={t.s}
            position={[0, (t.p.height - 0.5) * t.s, 0]}
            crownMaterial={t.warm ? mats.warm : mats.enamel}
            rootMaterial={mats.root}
            roots={t.roots}
            castShadow={false}
          />
          <mesh geometry={collars[i]} material={mats.gum} position={[0, -0.4 * t.s, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
    </group>
  );
}

function Spinner({ children, speed = 0.18, axis = "y" }: { children: ReactNode; speed?: number; axis?: "x" | "y" }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function Particles({ count = 70, spread = 7 }: { count?: number; spread?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    // Deterministic scatter (mulberry32) so re-renders never reshuffle the particles.
    let seed = 1337 + count;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rand() - 0.5) * spread;
      arr[i * 3 + 1] = (rand() - 0.5) * spread;
      arr[i * 3 + 2] = (rand() - 0.5) * 3 - 1;
    }
    return arr;
  }, [count, spread]);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#6f8fff" transparent opacity={0.45} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function FloatingScene({ variant, reducedMotion }: { variant: "hero" | "stats"; reducedMotion: boolean }) {
  const viewport = useThree((s) => s.viewport);
  const mats = useMemo(
    () => ({
      enamel: makeMaterial(ENAMEL_PROPS),
      root: makeMaterial(CEMENTUM_PROPS),
      // Transmission needs an opaque backdrop to refract; on this alpha canvas it rendered as
      // dark, broken shapes. Glossy, lightly transparent surfaces read as glass without that.
      glass: new THREE.MeshPhysicalMaterial({
        color: "#dfe9ff",
        roughness: 0.1,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0.82,
        envMapIntensity: 1.6,
        specularIntensity: 1,
      }),
      bubble: new THREE.MeshPhysicalMaterial({
        color: "#f4f8ff",
        roughness: 0.06,
        clearcoat: 1,
        transparent: true,
        opacity: 0.7,
        envMapIntensity: 1.8,
        specularIntensity: 1,
      }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const float = reducedMotion ? { speed: 0, rotationIntensity: 0, floatIntensity: 0 } : {};
  const spin = reducedMotion ? 0 : undefined;
  // Visible extents at z = 0, so compositions hold across aspect ratios.
  const hw = viewport.width / 2;
  const hh = viewport.height / 2;

  if (variant === "stats") {
    const s = Math.min(hw, hh) * 0.42;
    return (
      <>
        <StudioLights shadows={false} />
        <PointerParallax amount={0.12}>
          <Float speed={0.8} rotationIntensity={0.18} floatIntensity={0.45} {...float}>
            <group rotation={[0.35, -0.35, 0]} scale={s} position={[0, hh * 0.04, 0]}>
              <Spinner speed={spin ?? 0.12}>
                <StatsSmile />
              </Spinner>
            </group>
          </Float>
          <Particles count={36} spread={5} />
        </PointerParallax>
      </>
    );
  }

  // Hero: the portrait spans roughly ±0.55·hw of the canvas; objects sit just outside that band so they
  // frame the doctor without covering the face, and stay inside ±0.8 so the section edge never slices them.
  const unit = Math.min(hw, hh);
  return (
    <>
      <StudioLights shadows={false} />
      <PointerParallax amount={0.1}>
        {/* Enamel molar, upper-left of the portrait */}
        <Float speed={1.2} rotationIntensity={0.45} floatIntensity={0.9} {...float}>
            <group position={[-hw * 0.6, hh * 0.46, 0.3]} rotation={[0.35, 0.3, -0.15]} scale={unit * 0.21}>
            <Spinner speed={spin ?? 0.16}>
              <Tooth params={MOLAR} crownMaterial={mats.enamel} rootMaterial={mats.root} roots={MOLAR_ROOTS} castShadow={false} />
            </Spinner>
          </group>
        </Float>

        {/* Enamel canine, lower-right */}
        <Float speed={1} rotationIntensity={0.5} floatIntensity={0.8} {...float}>
          <group position={[hw * 0.58, -hh * 0.32, 0.6]} rotation={[-0.3, 0.2, 0.35]} scale={unit * 0.16}>
            <Spinner speed={spin ?? -0.12}>
              <Tooth params={CANINE} crownMaterial={mats.enamel} rootMaterial={mats.root} roots={CANINE_ROOTS} castShadow={false} />
            </Spinner>
          </group>
        </Float>

        {/* Aligner-like ring, upper-right */}
        <Float speed={0.8} rotationIntensity={0.6} floatIntensity={0.6} {...float}>
          <mesh position={[hw * 0.66, hh * 0.5, -1]} rotation={[1.1, 0.4, 0]} material={mats.glass}>
            <torusGeometry args={[unit * 0.15, unit * 0.024, 32, 120]} />
          </mesh>
        </Float>

        {/* Bubbles */}
        <Float speed={1.5} rotationIntensity={0} floatIntensity={1.4} {...float}>
          <mesh position={[-hw * 0.66, -hh * 0.1, 0.2]} material={mats.bubble}>
            <sphereGeometry args={[unit * 0.05, 48, 32]} />
          </mesh>
        </Float>
        <Float speed={1.8} rotationIntensity={0} floatIntensity={1.2} {...float}>
          <mesh position={[-hw * 0.56, -hh * 0.72, 0.8]} material={mats.bubble}>
            <sphereGeometry args={[unit * 0.032, 48, 32]} />
          </mesh>
        </Float>
        <Float speed={1.3} rotationIntensity={0} floatIntensity={1} {...float}>
          <mesh position={[hw * 0.6, hh * 0.8, -0.5]} material={mats.bubble}>
            <sphereGeometry args={[unit * 0.036, 48, 32]} />
          </mesh>
        </Float>
        <Particles spread={Math.max(hw, hh) * 2.2} />
      </PointerParallax>
    </>
  );
}
