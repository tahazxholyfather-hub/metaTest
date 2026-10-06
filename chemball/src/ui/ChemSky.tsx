import { useState } from "react";
import { Chem } from "./Chem";
import { SKY_COLORS, SKY_FORMULAS } from "./copy";

interface Slot {
  tex: string;
  color: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  tilt: number;
}

const SLOTS = 12;

function randomSlot(index: number, first: boolean): Slot {
  const column = index % 3;
  return {
    tex: SKY_FORMULAS[Math.floor(Math.random() * SKY_FORMULAS.length)] ?? "H2O",
    color: SKY_COLORS[Math.floor(Math.random() * SKY_COLORS.length)] ?? "#8fd4ff",
    x: 6 + column * 30 + Math.random() * 22,
    y: 12 + Math.random() * 56,
    size: 16 + Math.random() * 18,
    duration: 6 + Math.random() * 4,
    delay: first ? index * 0.7 + Math.random() * 0.6 : 0,
    tilt: Math.random() * 16 - 8,
  };
}

/** Chemistry formulas that fade in and out at random spots behind the start screen. */
export function ChemSky() {
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: SLOTS }, (_, index) => randomSlot(index, true)));
  return (
    <div className="sky" aria-hidden>
      {slots.map((slot, index) => (
        <span
          key={index}
          className="sky-item"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            color: slot.color,
            animationDuration: `${slot.duration}s`,
            animationDelay: `${slot.delay}s`,
            ["--tilt" as string]: `${slot.tilt}deg`,
          }}
          onAnimationIteration={() =>
            setSlots((current) => current.map((item, i) => (i === index ? { ...randomSlot(index, false), delay: item.delay, duration: item.duration } : item)))
          }
        >
          <Chem tex={slot.tex} size={slot.size} weight={10} />
        </span>
      ))}
    </div>
  );
}
