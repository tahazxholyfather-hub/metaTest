import * as THREE from "three";

export const ENAMEL_PROPS = {
  color: "#f4ead6",
  roughness: 0.22,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.12,
  sheen: 0.55,
  sheenColor: new THREE.Color("#d5e4ff"),
  sheenRoughness: 0.45,
  envMapIntensity: 1.05,
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
  color: "#e45b78",
  roughness: 0.38,
  metalness: 0,
  clearcoat: 0.55,
  clearcoatRoughness: 0.28,
  sheen: 0.9,
  sheenColor: new THREE.Color("#ffc1cf"),
  sheenRoughness: 0.42,
  envMapIntensity: 0.95,
};

export const GUM_DEEP_PROPS = {
  color: "#a8324e",
  roughness: 0.62,
  metalness: 0,
  clearcoat: 0.2,
  clearcoatRoughness: 0.5,
  sheen: 0.35,
  sheenColor: new THREE.Color("#ffb3c4"),
  envMapIntensity: 0.45,
};

export function makeMaterial(props: Record<string, unknown>, transparent = false, emissive = "#5b8cff", emissiveIntensity = 0) {
  const m = new THREE.MeshPhysicalMaterial(props as THREE.MeshPhysicalMaterialParameters);
  m.transparent = transparent;
  m.emissive = new THREE.Color(emissive);
  m.emissiveIntensity = emissiveIntensity;
  return m;
}
