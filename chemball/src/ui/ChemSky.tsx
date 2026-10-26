import type { CSSProperties } from "react";
import homeBg from "./home-bg.svg";

const PHOTO: CSSProperties = { backgroundImage: `url("${homeBg}")` };

/** Start-screen photograph with dark fades at the top and bottom. The center stays uncovered. */
export function ChemSky() {
  return (
    <div className="sky" aria-hidden>
      <div className="home-photo" style={PHOTO} />
      <div className="home-fade home-fade-top" />
      <div className="home-fade home-fade-bottom" />
    </div>
  );
}
