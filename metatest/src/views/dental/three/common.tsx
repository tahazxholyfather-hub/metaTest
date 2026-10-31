import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { createCrownGeometry, createRidgeGeometry, createRootGeometry, type CrownParams, type RootSpec } from "./toothGeometry";

/* ---------- Tooth ---------- */

type ToothProps = {
  params: CrownParams;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  crownMaterial: THREE.Material;
  rootMaterial?: THREE.Material;
  roots?: RootSpec[];
  castShadow?: boolean;
  renderOrder?: number;
};

/** Height of the cementum trunk that joins multi-rooted teeth below the cervical line. */
const TRUNK_HEIGHT = 0.2;

export function Tooth({
  params,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  crownMaterial,
  rootMaterial,
  roots = [],
  castShadow = true,
  renderOrder = 0,
}: ToothProps) {
  const crown = useMemo(() => createCrownGeometry(params), [params]);
  const rootGeos = useMemo(() => roots.map((r) => createRootGeometry(r.length, r.radius, r.bend ?? 0)), [roots]);
  const trunk = useMemo(
    () => (roots.length > 1 ? createRidgeGeometry(params.width * 0.72, TRUNK_HEIGHT, params.depth * 0.72, params.squareness ?? 0.6, 0.5) : null),
    [roots.length, params],
  );
  useEffect(
    () => () => {
      crown.dispose();
      rootGeos.forEach((g) => g.dispose());
      trunk?.dispose();
    },
    [crown, rootGeos, trunk],
  );

  const neckY = -params.height * 0.97;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={crown} material={crownMaterial} castShadow={castShadow} receiveShadow renderOrder={renderOrder} />
      {rootMaterial && trunk && (
        <mesh geometry={trunk} material={rootMaterial} position={[0, neckY - TRUNK_HEIGHT * 0.15, 0]} castShadow={castShadow} renderOrder={renderOrder} />
      )}
      {rootMaterial &&
        roots.map((r, i) => (
          <mesh
            key={i}
            geometry={rootGeos[i]}
            material={rootMaterial}
            position={[r.x, neckY + 0.04, r.z ?? 0]}
            rotation={[0, 0, r.tilt]}
            scale={[1, 1, r.flatten ?? 1]}
            castShadow={castShadow}
            renderOrder={renderOrder}
          />
        ))}
    </group>
  );
}

/* ---------- Lighting rig (no external HDR; built from light formers) ---------- */

export function StudioLights({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[4, 7, 5]}
        intensity={1.5}
        color="#ffffff"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <directionalLight position={[-6, 2, -2]} intensity={0.5} color="#c7d7ff" />
      <directionalLight position={[2, -3, 4]} intensity={0.25} color="#e8e2ff" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#d9e2f1"]} />
        <Lightformer form="rect" intensity={3.2} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.6} position={[-6, 1.5, 2]} rotation-y={Math.PI / 2} scale={[7, 3, 1]} color="#d9e6ff" />
        <Lightformer form="rect" intensity={1.3} position={[6, 1, -1]} rotation-y={-Math.PI / 2} scale={[7, 3, 1]} color="#ebe4ff" />
        <Lightformer form="ring" intensity={0.9} position={[0, -5, 0]} rotation-x={-Math.PI / 2} scale={7} color="#f2f5ff" />
        <Lightformer form="rect" intensity={0.8} position={[0, 1, 7]} scale={[8, 4, 1]} color="#ffffff" />
      </Environment>
    </>
  );
}

/* ---------- Helpers ---------- */

/** Gentle pointer parallax on a group. */
export function PointerParallax({ children, amount = 0.08 }: { children: ReactNode; amount?: number }) {
  const ref = useRef<THREE.Group>(null);
  const pointer = useThree((s) => s.pointer);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const k = 1 - Math.pow(0.001, dt);
    ref.current.rotation.y += (pointer.x * amount - ref.current.rotation.y) * k;
    ref.current.rotation.x += (-pointer.y * amount * 0.6 - ref.current.rotation.x) * k;
  });
  return <group ref={ref}>{children}</group>;
}
