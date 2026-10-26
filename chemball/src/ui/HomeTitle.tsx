import { ElementTile } from "./ElementTile";

const CARBON = { symbol: "C", number: 6, mass: "12.011" };
const BARIUM = { symbol: "Ba", number: 56, mass: "137.33" };

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
      </h1>
      <p className="tagline">آزمایشگاه واکنش‌های زنجیره‌ای</p>
    </div>
  );
}
