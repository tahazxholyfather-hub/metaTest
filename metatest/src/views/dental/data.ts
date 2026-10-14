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
  result: unsplash("1489278353717-f64c6ee8a4d2", 1400, 1000),
  avatars: [
    unsplash("1494790108377-be9c29b29330", 160, 160),
    unsplash("1507003211169-0a1dd7228f2d", 160, 160),
    unsplash("1500648767791-00dcc994a43e", 160, 160),
    unsplash("1544005313-94ddf0286df2", 160, 160),
    unsplash("1531123897727-8f129e1688ce", 160, 160),
  ],
};

export const NAV = [
  { label: "Home", href: "#top" },
  { label: "Services", href: "#services" },
  { label: "About", href: "#about" },
  { label: "Reviews", href: "#reviews" },
  { label: "Contact", href: "#contact" },
];

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
