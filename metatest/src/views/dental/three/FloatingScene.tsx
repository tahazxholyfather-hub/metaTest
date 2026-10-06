import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { CEMENTUM_PROPS, ENAMEL_PROPS, PointerParallax, StudioLights, Tooth, makeMaterial } from "./common";
import { CANINE, MOLAR } from "./toothGeometry";

const MOLAR_ROOTS = [
  { x: -0.24, tilt: 0.16, length: 0.98, radius: 0.15 },
  { x: 0.24, tilt: -0.16, length: 0.94, radius: 0.15 },
];
const CANINE_ROOTS = [{ x: 0, tilt: 0.03, length: 1.15, radius: 0.14 }];

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
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 3 - 1;
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
  const mats = useMemo(
    () => ({
      enamel: makeMaterial(ENAMEL_PROPS),
      root: makeMaterial(CEMENTUM_PROPS),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#eaf1ff",
        roughness: 0.08,
        metalness: 0,
        transmission: 1,
        thickness: 1.4,
        ior: 1.42,
        clearcoat: 1,
        envMapIntensity: 1.2,
        attenuationColor: new THREE.Color("#c6d6ff"),
        attenuationDistance: 2.5,
      }),
      bubble: new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.05,
        transmission: 1,
        thickness: 0.6,
        ior: 1.3,
        envMapIntensity: 1.4,
      }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const float = reducedMotion ? { speed: 0, rotationIntensity: 0, floatIntensity: 0 } : {};
  const spin = reducedMotion ? 0 : undefined;

  if (variant === "stats") {
    return (
      <>
        <StudioLights shadows={false} />
        <PointerParallax amount={0.14}>
          <Float speed={1.1} rotationIntensity={0.35} floatIntensity={0.9} {...float}>
            <Spinner speed={spin ?? 0.22}>
              <group rotation={[0.25, 0.4, -0.08]} scale={1.7} position={[0, 0.45, 0]}>
                <Tooth params={MOLAR} crownMaterial={mats.enamel} rootMaterial={mats.root} roots={MOLAR_ROOTS} castShadow={false} />
              </group>
            </Spinner>
          </Float>
          <Float speed={1.6} rotationIntensity={0.2} floatIntensity={1.2} {...float}>
            <mesh position={[-2.1, 1.6, -0.6]} material={mats.bubble}>
              <sphereGeometry args={[0.2, 48, 32]} />
            </mesh>
          </Float>
          <Float speed={1.3} rotationIntensity={0.2} floatIntensity={1} {...float}>
            <mesh position={[2.3, -1.6, -0.2]} material={mats.bubble}>
              <sphereGeometry args={[0.14, 48, 32]} />
            </mesh>
          </Float>
          <Float speed={0.9} rotationIntensity={0.5} floatIntensity={0.6} {...float}>
            <mesh position={[1.9, 1.9, -1.2]} rotation={[0.9, 0.3, 0]} material={mats.glass}>
              <torusGeometry args={[0.42, 0.06, 24, 80]} />
            </mesh>
          </Float>
          <Particles count={50} spread={6} />
        </PointerParallax>
      </>
    );
  }

  return (
    <>
      <StudioLights shadows={false} />
      <PointerParallax amount={0.1}>
        {/* Enamel molar, upper-left */}
        <Float speed={1.2} rotationIntensity={0.45} floatIntensity={0.9} {...float}>
          <Spinner speed={spin ?? 0.16}>
            <group position={[-2.1, 2.0, 0.3]} rotation={[0.35, 0.3, -0.15]} scale={0.85}>
              <Tooth params={MOLAR} crownMaterial={mats.enamel} rootMaterial={mats.root} roots={MOLAR_ROOTS} castShadow={false} />
            </group>
          </Spinner>
        </Float>

        {/* Translucent glass canine, lower-right */}
        <Float speed={1} rotationIntensity={0.5} floatIntensity={0.8} {...float}>
          <Spinner speed={spin ?? -0.12}>
            <group position={[2.35, -1.3, 0.6]} rotation={[-0.3, 0.2, 0.35]} scale={0.8}>
              <Tooth params={CANINE} crownMaterial={mats.glass} rootMaterial={mats.glass} roots={CANINE_ROOTS} castShadow={false} />
            </group>
          </Spinner>
        </Float>

        {/* Glass ring (aligner-like) */}
        <Float speed={0.8} rotationIntensity={0.6} floatIntensity={0.6} {...float}>
          <mesh position={[2.5, 1.5, -1]} rotation={[1.1, 0.4, 0]} material={mats.glass}>
            <torusGeometry args={[0.42, 0.06, 24, 90]} />
          </mesh>
        </Float>

        {/* Bubbles */}
        <Float speed={1.5} rotationIntensity={0} floatIntensity={1.4} {...float}>
          <mesh position={[-2.6, -1.0, 0.2]} material={mats.bubble}>
            <sphereGeometry args={[0.26, 48, 32]} />
          </mesh>
        </Float>
        <Float speed={1.8} rotationIntensity={0} floatIntensity={1.2} {...float}>
          <mesh position={[-2.0, -2.3, 0.8]} material={mats.bubble}>
            <sphereGeometry args={[0.14, 48, 32]} />
          </mesh>
        </Float>
        <Float speed={1.3} rotationIntensity={0} floatIntensity={1} {...float}>
          <mesh position={[1.6, 2.5, -0.5]} material={mats.bubble}>
            <sphereGeometry args={[0.12, 48, 32]} />
          </mesh>
        </Float>
        <Particles />
      </PointerParallax>
    </>
  );
}
