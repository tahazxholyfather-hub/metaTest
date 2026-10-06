import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type CanvasProps } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { createCrownGeometry, createRootGeometry, type CrownParams } from "./toothGeometry";

/* ---------- Materials ---------- */

export const ENAMEL_PROPS = {
  color: "#f8f5ef",
  roughness: 0.2,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  sheen: 0.5,
  sheenColor: new THREE.Color("#dde7ff"),
  sheenRoughness: 0.55,
  envMapIntensity: 1.1,
};

export const CEMENTUM_PROPS = {
  color: "#ecdcc3",
  roughness: 0.55,
  metalness: 0,
  clearcoat: 0.2,
  clearcoatRoughness: 0.5,
  envMapIntensity: 0.7,
};

export const GUM_PROPS = {
  color: "#e9a3ad",
  roughness: 0.4,
  metalness: 0,
  clearcoat: 0.45,
  clearcoatRoughness: 0.35,
  sheen: 0.8,
  sheenColor: new THREE.Color("#ffd9df"),
  sheenRoughness: 0.5,
  envMapIntensity: 0.8,
};

export function makeMaterial(props: Record<string, unknown>, transparent = false) {
  const m = new THREE.MeshPhysicalMaterial(props as THREE.MeshPhysicalMaterialParameters);
  m.transparent = transparent;
  m.emissive = new THREE.Color("#5b8cff");
  m.emissiveIntensity = 0;
  return m;
}

/* ---------- Tooth ---------- */

type ToothProps = {
  params: CrownParams;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  crownMaterial: THREE.Material;
  rootMaterial?: THREE.Material;
  roots?: Array<{ x: number; z?: number; tilt: number; length: number; radius: number }>;
  castShadow?: boolean;
  renderOrder?: number;
};

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
  const rootGeos = useMemo(() => roots.map((r) => createRootGeometry(r.length, r.radius)), [roots]);
  useEffect(() => () => {
    crown.dispose();
    rootGeos.forEach((g) => g.dispose());
  }, [crown, rootGeos]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={crown} material={crownMaterial} castShadow={castShadow} receiveShadow renderOrder={renderOrder} />
      {rootMaterial &&
        roots.map((r, i) => (
          <mesh
            key={i}
            geometry={rootGeos[i]}
            material={rootMaterial}
            position={[r.x, -params.height * 0.96, r.z ?? 0]}
            rotation={[0, 0, r.tilt]}
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

/* ---------- Visibility-aware canvas: renders only while on screen ---------- */

export function LazyCanvas({
  children,
  className,
  style,
  ...rest
}: CanvasProps & { children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setMounted(true);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className={className} style={{ position: "absolute", inset: 0, ...style }}>
      {mounted && (
        <Canvas
          frameloop={visible ? "always" : "never"}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          {...rest}
        >
          {children}
        </Canvas>
      )}
    </div>
  );
}

/* ---------- Helpers ---------- */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

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
