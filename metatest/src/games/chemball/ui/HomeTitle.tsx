import { ElementTile } from "./ElementTile";

const CARBON = { symbol: "C", number: 6, mass: "12.011" };
const BARIUM = { symbol: "Ba", number: 56, mass: "137.33" };

const GLINTS = [
  { left: "6%", top: "4%", animationDelay: "0.4s" },
  { left: "88%", top: "18%", animationDelay: "2.1s" },
  { left: "52%", top: "92%", animationDelay: "3.6s" },
  { left: "30%", top: "46%", animationDelay: "5.2s" },
];

/** "ChemBall" set like a periodic-table title card: [C]hem / [Ba]ll. */
export function HomeTitle() {
  return (
    <div className="title-wrap">
      <h1 className="title" aria-label="ChemBall" dir="ltr">
        <span className="title-row">
          <ElementTile element={CARBON} className="title-tile" />
          <span className="title-text">hem</span>
        </span>
        <span className="title-row second">
          <ElementTile element={BARIUM} className="title-tile late" />
          <span className="title-text late">ll</span>
        </span>
        {GLINTS.map((style, index) => (
          <span className="glint" key={index} style={style} />
        ))}
      </h1>
      <p className="tagline">آزمایشگاه واکنش‌های زنجیره‌ای</p>
    </div>
  );
}
