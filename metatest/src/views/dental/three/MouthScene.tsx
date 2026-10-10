import { useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { StudioLights, Tooth } from "./common";
import { ENAMEL_PROPS, GUM_DEEP_PROPS, GUM_PROPS, makeMaterial } from "./materials";
import { createRidgeGeometry, type CrownParams } from "./toothGeometry";

type Slot = { params: CrownParams; x: number };

const CENTRAL: CrownParams = { width: 0.2, depth: 0.13, height: 0.26, cusps: 0, cuspHeight: 0.03, squareness: 0.58, flatness: 0.82, segments: 26 };
const LATERAL: CrownParams = { width: 0.16, depth: 0.12, height: 0.24, cusps: 0, cuspHeight: 0.03, squareness: 0.64, flatness: 0.82, segments: 22 };
const CANINE: CrownParams = { width: 0.15, depth: 0.13, height: 0.24, cusps: 1, cuspHeight: 0.05, squareness: 0.78, flatness: 0.74, segments: 22 };
const BACK: CrownParams = { width: 0.17, depth: 0.14, height: 0.18, cusps: 2, cuspHeight: 0.05, squareness: 0.62, flatness: 0.74, segments: 20 };

function pack(specs: CrownParams[], gap = 0.008): Slot[] {
  const right: Slot[] = [];
  let edge = 0;
  specs.forEach((params, i) => {
    const x = edge + params.width / 2 + (i === 0 ? 0 : gap);
    right.push({ params, x });
    edge = x + params.width / 2;
  });
  return [...right.map(({ params, x }) => ({ params, x: -x })).reverse(), ...right];
}

const UPPER = pack([CENTRAL, LATERAL, CANINE, BACK]);
const LOWER = pack([
  { ...CENTRAL, width: 0.17, height: 0.22 },
  { ...LATERAL, width: 0.14, height: 0.2 },
  { ...CANINE, height: 0.2, cuspHeight: 0.04 },
  { ...BACK, height: 0.16 },
]);

const UPPER_NECK = 0.58;
const LOWER_NECK = -0.5;
const bow = (x: number) => 0.09 * x * x;

export default function MouthScene({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      enamel: makeMaterial(ENAMEL_PROPS),
      warm: makeMaterial({ ...ENAMEL_PROPS, color: "#f6efe4" }),
      gum: makeMaterial({ ...GUM_PROPS, color: "#e56d79" }),
      tongue: makeMaterial({ ...GUM_PROPS, color: "#f3a4aa", roughness: 0.42, clearcoat: 0.4 }),
      cavity: makeMaterial({ ...GUM_DEEP_PROPS, color: "#5c1628" }),
    }),
    [],
  );
  const upperGum = useMemo(() => createRidgeGeometry(1.2, 0.58, 0.52, 0.48, 0.58), []);
  const lowerGum = useMemo(() => createRidgeGeometry(1.08, 0.42, 0.48, 0.48, 0.58), []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      upperGum.dispose();
      lowerGum.dispose();
    },
    [mats, upperGum, lowerGum],
  );

  useFrame((state) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y = -0.28 + Math.sin(state.clock.elapsedTime * 0.35) * 0.05;
  });

  return (
    <>
      <StudioLights shadows={false} />
      <group ref={group} rotation={[0.38, -0.28, 0]}>
        <mesh material={mats.cavity} position={[0, 0.02, -0.28]} scale={[0.85, 0.48, 0.32]}>
          <sphereGeometry args={[1, 32, 22]} />
        </mesh>

        <mesh geometry={upperGum} material={mats.gum} position={[0, 0.92, 0]} />
        {UPPER.map(({ params, x }, i) => (
          <group key={`u${i}`} position={[x, UPPER_NECK - params.height - bow(x), 0.16 - bow(x)]} rotation={[0.08, 0, Math.PI]}>
            <Tooth params={params} crownMaterial={i % 3 === 0 ? mats.warm : mats.enamel} castShadow={false} />
          </group>
        ))}

        <mesh geometry={lowerGum} material={mats.gum} position={[0, -0.78, 0.02]} />
        {LOWER.map(({ params, x }, i) => (
          <group key={`l${i}`} position={[x, LOWER_NECK + params.height + bow(x) * 0.55, 0.14 - bow(x)]} rotation={[-0.12, 0, 0]}>
            <Tooth params={params} crownMaterial={i % 3 === 1 ? mats.warm : mats.enamel} castShadow={false} />
          </group>
        ))}

        <mesh material={mats.tongue} position={[0, -0.02, 0.12]} rotation={[-0.55, 0, 0]} scale={[0.5, 0.1, 0.28]}>
          <sphereGeometry args={[1, 28, 20]} />
        </mesh>
      </group>
    </>
  );
}
