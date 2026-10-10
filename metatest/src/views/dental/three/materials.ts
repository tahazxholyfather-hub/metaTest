import * as THREE from "three";

export const ENAMEL_PROPS = {
  color: "#f7f4ee",
  roughness: 0.14,
  metalness: 0.04,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  sheen: 0.35,
  sheenColor: new THREE.Color("#e7eefc"),
  sheenRoughness: 0.35,
  envMapIntensity: 1.15,
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
  color: "#e07b80",
  roughness: 0.42,
  metalness: 0,
  clearcoat: 0.4,
  clearcoatRoughness: 0.32,
  sheen: 0.7,
  sheenColor: new THREE.Color("#ffd5d8"),
  sheenRoughness: 0.4,
  envMapIntensity: 0.7,
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
