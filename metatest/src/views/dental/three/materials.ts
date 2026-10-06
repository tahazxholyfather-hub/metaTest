import * as THREE from "three";

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

export function makeMaterial(props: Record<string, unknown>, transparent = false, emissive = "#5b8cff", emissiveIntensity = 0) {
  const m = new THREE.MeshPhysicalMaterial(props as THREE.MeshPhysicalMaterialParameters);
  m.transparent = transparent;
  m.emissive = new THREE.Color(emissive);
  m.emissiveIntensity = emissiveIntensity;
  return m;
}
