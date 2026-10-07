import { useState, type CSSProperties } from "react";
import { Chem } from "./Chem";
import { SKY_COLORS, SKY_ELEMENTS, SKY_FORMULAS } from "./copy";
import { ElementTile } from "./ElementTile";

interface Slot {
  kind: "tile" | "formula";
  pick: number;
  color: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  tilt: number;
  drift: number;
}

const TILE_SLOTS = 8;
const FORMULA_SLOTS = 5;

const SMOKE: CSSProperties[] = [
  { left: "-20%", top: "58%", width: "90%", ["--c" as string]: "rgba(70, 160, 90, 0.51)", animationDuration: "26s" },
  { left: "35%", top: "66%", width: "95%", ["--c" as string]: "rgba(150, 190, 70, 0.39)", animationDuration: "31s", animationDelay: "-9s" },
  { left: "-10%", top: "20%", width: "70%", ["--c" as string]: "rgba(40, 120, 80, 0.42)", animationDuration: "34s", animationDelay: "-17s" },
  { left: "45%", top: "8%", width: "75%", ["--c" as string]: "rgba(90, 150, 60, 0.33)", animationDuration: "29s", animationDelay: "-5s" },
  { left: "10%", top: "40%", width: "85%", ["--c" as string]: "rgba(30, 90, 60, 0.48)", animationDuration: "38s", animationDelay: "-22s" },
  { left: "50%", top: "38%", width: "60%", ["--c" as string]: "rgba(180, 200, 90, 0.21)", animationDuration: "24s", animationDelay: "-13s" },
];

const EMBERS = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 37 + 11) % 96}%`,
  animationDuration: `${9 + (index % 5) * 2.4}s`,
  animationDelay: `${-index * 1.7}s`,
  ["--sway" as string]: `${(index % 2 ? 1 : -1) * (8 + (index % 4) * 6)}px`,
  ["--d" as string]: `${2 + (index % 3)}px`,
}));

function randomSlot(index: number, first: boolean): Slot {
  const tile = index < TILE_SLOTS;
  const lane = tile ? index % 4 : index % 3;
  return {
    kind: tile ? "tile" : "formula",
    pick: Math.floor(Math.random() * (tile ? SKY_ELEMENTS.length : SKY_FORMULAS.length)),
    color: SKY_COLORS[Math.floor(Math.random() * SKY_COLORS.length)] ?? "#9be7a8",
    x: tile ? 8 + lane * 24 + Math.random() * 12 : 12 + lane * 30 + Math.random() * 16,
    y: 44 + Math.random() * 36,
    size: tile ? 0.75 + Math.random() * 0.75 : 14 + Math.random() * 10,
    duration: tile ? 7.5 + Math.random() * 4 : 9 + Math.random() * 5,
    delay: first ? index * 0.9 + Math.random() * 1.2 : 0,
    tilt: Math.random() * 14 - 7,
    drift: -(12 + Math.random() * 26),
  };
}

/** Breaking Bad–style backdrop: drifting smoke, periodic tiles racking in and out of focus, film grain. */
export function ChemSky() {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: TILE_SLOTS + FORMULA_SLOTS }, (_, index) => randomSlot(index, true)),
  );
  const reshuffle = (index: number) =>
    setSlots((current) =>
      current.map((item, i) => (i === index ? { ...randomSlot(index, false), delay: item.delay, duration: item.duration } : item)),
    );

  return (
    <div className="sky" aria-hidden>
      <div className="smoke-layer">
        {SMOKE.map((style, index) => (
          <span className="smoke" key={index} style={style} />
        ))}
      </div>
      <span className="smoke-tex back" />
      <span className="smoke-tex" />
      <span className="beam" />
      <span className="beam late" />
      {slots.map((slot, index) => {
        const style = {
          left: `${slot.x}%`,
          top: `${slot.y}%`,
          animationDuration: `${slot.duration}s`,
          animationDelay: `${slot.delay}s`,
          ["--tilt" as string]: `${slot.tilt}deg`,
          ["--drift" as string]: `${slot.drift}px`,
        };
        if (slot.kind === "tile") {
          const element = SKY_ELEMENTS[slot.pick] ?? SKY_ELEMENTS[0]!;
          return (
            <span
              key={index}
              className="sky-item sky-tile"
              style={{ ...style, ["--s" as string]: slot.size }}
              onAnimationIteration={(event) => event.target === event.currentTarget && reshuffle(index)}
            >
              <ElementTile element={element} />
            </span>
          );
        }
        return (
          <span
            key={index}
            className="sky-item sky-formula"
            style={{ ...style, color: slot.color }}
            onAnimationIteration={(event) => event.target === event.currentTarget && reshuffle(index)}
          >
            <Chem tex={SKY_FORMULAS[slot.pick] ?? "H2O"} size={slot.size} weight={10} />
          </span>
        );
      })}
      <div className="embers">
        {EMBERS.map((style, index) => (
          <span className="ember" key={index} style={style} />
        ))}
      </div>
      <span className="grain" />
      <span className="vignette" />
    </div>
  );
}
