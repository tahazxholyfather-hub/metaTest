import type { CSSProperties } from "react";

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

/** Breaking Bad–style backdrop: rising green smoke, embers, film grain. */
export function ChemSky() {
  return (
    <div className="sky" aria-hidden>
      <div className="smoke-layer">
        {SMOKE.map((style, index) => (
          <span className="smoke" key={index} style={style} />
        ))}
      </div>
      <span className="smoke-tex back" />
      <span className="smoke-tex" />
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
