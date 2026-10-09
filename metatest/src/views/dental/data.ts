/* Shared, non-component data for the Lumière Dental landing page. */

export const EASE = [0.22, 1, 0.36, 1] as const;

const unsplash = (id: string, w: number, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}${h ? `&h=${h}` : ""}`;

export const IMAGES = {
  dentist: unsplash("1612349317150-e413f6a5b16d", 1000, 1300),
  clinic: unsplash("1629909613654-28e377c37b09", 1400, 1000),
  clinicChair: unsplash("1445527815219-ecbfec67492e", 1200, 1500),
  consult: unsplash("1606811841689-23dfddce3e95", 1200, 900),
  xray: unsplash("1588776814546-1ffcf47267a5", 1000, 800),
  team: unsplash("1622253692010-333f2da6031d", 900, 1100),
  smile: unsplash("1580489944761-15a19d654956", 1100, 1400),
  // Focal-point crop keeps the teeth centred so the comparison divider always crosses them.
  result: `${unsplash("1677026010083-78ec7f1b84ed", 1400, 960)}&crop=focalpoint&fp-x=0.6&fp-y=0.46&fp-z=1.3`,
  avatars: [
    unsplash("1494790108377-be9c29b29330", 160, 160),
    unsplash("1507003211169-0a1dd7228f2d", 160, 160),
    unsplash("1500648767791-00dcc994a43e", 160, 160),
    unsplash("1544005313-94ddf0286df2", 160, 160),
    unsplash("1531123897727-8f129e1688ce", 160, 160),
  ],
};

export type AnatomyKey = "enamel" | "dentin" | "pulp" | "gum" | "root" | "nerve";

/** Hotspot anchors in tooth space. Labels live in copy.ts so both languages share one model. */
export const ANATOMY: Array<{ key: AnatomyKey; anchor: [number, number, number] }> = [
  { key: "enamel", anchor: [0.32, 0.64, 0.3] },
  { key: "dentin", anchor: [0.62, 0.12, 0.08] },
  { key: "pulp", anchor: [0, -0.02, 0.56] },
  { key: "gum", anchor: [0.78, -0.42, 0.42] },
  { key: "root", anchor: [0.3, -1.1, 0.32] },
  { key: "nerve", anchor: [0, -1.56, 0.3] },
];
