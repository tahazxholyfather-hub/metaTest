import { useMemo } from "react";
import type { Copy } from "../i18n/copy";
import { formatNumber } from "../game/score";
import type { ViewState } from "../game/view";
import type { LeaderboardEntry } from "../save/models";

const SIGNS = ["H", "O", "Na", "Cl", "H₂O", "C", "Fe", "Mg", "N", "S", "Ca", "K", "Δ", "⇌", "OH", "CO₂"];

export function ChemField() {
  const signs = useMemo(
    () =>
      SIGNS.map((glyph, index) => {
        const side = index % 2 === 0;
        return {
          glyph,
          left: side ? 2 + ((index * 9) % 20) : 74 + ((index * 7) % 20),
          top: 8 + ((index * 23) % 78),
          delay: -((index * 1.4) % 9),
          duration: 9 + (index % 4),
          size: 16 + (index % 5) * 6,
        };
      }),
    [],
  );
  return (
    <div className="chem-field" aria-hidden>
      {signs.map((sign) => (
        <span
          key={sign.glyph + sign.left}
          className="chem-sign"
          style={{
            left: `${sign.left}%`,
            top: `${sign.top}%`,
            fontSize: sign.size,
            animationDelay: `${sign.delay}s`,
            animationDuration: `${sign.duration}s`,
          }}
        >
          {sign.glyph}
        </span>
      ))}
    </div>
  );
}

export function BrandScreen({ copy, onDone }: { copy: Copy; onDone: () => void }) {
  return (
    <button className="brand-screen" type="button" data-testid="brand" onClick={onDone}>
      <div className="brand-mark">
        <svg width="74" height="74" viewBox="0 0 72 72" aria-hidden>
          <polygon
            points="36,5 63,20.5 63,51.5 36,67 9,51.5 9,20.5"
            fill="none"
            stroke="rgba(244,247,255,0.86)"
            strokeWidth="1.4"
          />
          <circle cx="36" cy="36" r="9" fill="none" stroke="rgba(244,247,255,0.92)" strokeWidth="1.5" />
          <circle cx="36" cy="36" r="2.2" fill="rgba(244,247,255,0.95)" />
        </svg>
        <p className="brand-kicker">{copy.brandKicker}</p>
        <p className="brand-name">{copy.brandName}</p>
      </div>
    </button>
  );
}

export function HomeScreen({
  copy,
  name,
  best,
  onPlay,
  onLeaders,
  onHow,
  onSettings,
  language,
  onLanguage,
  onLeave,
}: {
  copy: Copy;
  name: string;
  best: number;
  language: "en" | "fa";
  onPlay: () => void;
  onLeaders: () => void;
  onHow: () => void;
  onSettings: () => void;
  onLanguage: () => void;
  onLeave: () => void;
}) {
  return (
    <section className="home" data-testid="home">
      <ChemField />
      <header className="topbar" dir="ltr">
        <button className="bare" type="button" data-testid="lang" aria-label={copy.switchLanguage} onClick={onLanguage}>
          {language === "en" ? "FA" : "EN"}
        </button>
        <button className="bare" type="button" data-testid="leave" aria-label={copy.leave} onClick={onLeave}>
          <PowerIcon />
        </button>
      </header>
      <div className="home-body">
        <h1 className="title-shine">CHEMBALL</h1>
        <button className="play-btn" type="button" data-testid="play" onClick={onPlay}>
          {copy.play}
        </button>
        <p className="home-name">{name}</p>
        <p className="home-record-label">{copy.record}</p>
        <p className="home-record">{formatNumber(best)}</p>
        <nav className="home-links">
          <button type="button" data-testid="open-leaders" onClick={onLeaders}>
            {copy.leaderboard}
          </button>
          <button type="button" data-testid="open-howto" onClick={onHow}>
            {copy.howTo}
          </button>
          <button type="button" data-testid="open-settings" onClick={onSettings}>
            {copy.settings}
          </button>
        </nav>
      </div>
    </section>
  );
}

function PowerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3.5v7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <path d="M7.1 6.6a7 7 0 1 0 9.8 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function LeadersPage({
  copy,
  rows,
  onBack,
}: {
  copy: Copy;
  rows: LeaderboardEntry[];
  onBack: () => void;
}) {
  return (
    <section className="page" data-testid="leaders">
      <button className="back" type="button" data-testid="back" onClick={onBack}>
        {copy.back}
      </button>
      <h1>{copy.leaderboard}</h1>
      <div className="page-body">
        {rows.map((entry, index) => (
          <div className={entry.you ? "row you" : "row"} key={entry.id}>
            <span>
              {index + 1}. {entry.name}
            </span>
            <b>{formatNumber(entry.score)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowToPage({
  copy,
  discovered,
  hidden,
  onBack,
  onReplay,
}: {
  copy: Copy;
  discovered: Array<{ id: string; formula: string; product: string }>;
  hidden: string;
  onBack: () => void;
  onReplay: () => void;
}) {
  const steps = [
    [copy.how1t, copy.how1d],
    [copy.how2t, copy.how2d],
    [copy.how3t, copy.how3d],
    [copy.how4t, copy.how4d],
  ];
  return (
    <section className="page" data-testid="howto">
      <button className="back" type="button" data-testid="back" onClick={onBack}>
        {copy.back}
      </button>
      <h1>{copy.howTitle}</h1>
      <button className="primary lesson" type="button" data-testid="replay-lesson" onClick={onReplay}>
        {copy.tourReplay}
      </button>
      <div className="page-body">
        {steps.map(([title, body], index) => (
          <article className="step" key={title}>
            <span>{index + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </article>
        ))}
        <h2 className="section-label">{copy.discovered}</h2>
        {discovered.length === 0 && <p className="quiet">{copy.noneYet}</p>}
        {discovered.map((item) => (
          <div className="row" key={item.id}>
            <span>{item.formula}</span>
            <b>{item.product}</b>
          </div>
        ))}
        <p className="quiet">{hidden}</p>
      </div>
    </section>
  );
}

export function SettingsPage({
  copy,
  name,
  sound,
  language,
  level,
  xp,
  onBack,
  onName,
  onSound,
  onLanguage,
}: {
  copy: Copy;
  name: string;
  sound: boolean;
  language: "en" | "fa";
  level: number;
  xp: string;
  onBack: () => void;
  onName: (name: string) => void;
  onSound: () => void;
  onLanguage: (language: "en" | "fa") => void;
}) {
  return (
    <section className="page" data-testid="settings">
      <button className="back" type="button" data-testid="back" onClick={onBack}>
        {copy.back}
      </button>
      <h1>{copy.settings}</h1>
      <div className="page-body">
        <form
          className="name-row"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onName(String(data.get("name") ?? ""));
          }}
        >
          <input name="name" aria-label={copy.nameLabel} defaultValue={name} maxLength={16} />
          <button type="submit">{copy.save}</button>
        </form>
        <button className="text-row" type="button" onClick={onSound}>
          <span>{sound ? copy.soundOn : copy.soundOff}</span>
        </button>
        <div className="lang-switch" role="group" aria-label={copy.language}>
          <button type="button" className={language === "en" ? "on" : ""} onClick={() => onLanguage("en")}>
            {copy.english}
          </button>
          <button type="button" className={language === "fa" ? "on" : ""} onClick={() => onLanguage("fa")}>
            {copy.persian}
          </button>
        </div>
        <p className="quiet">
          {copy.levelLine} {level} · {xp} {copy.xp}
        </p>
      </div>
    </section>
  );
}

export function OffScreen({ copy, onReturn }: { copy: Copy; onReturn: () => void }) {
  return (
    <button className="off-screen" type="button" data-testid="off" onClick={onReturn}>
      <p>{copy.poweredOff}</p>
      <span>{copy.return}</span>
    </button>
  );
}

export function LeaveDialog({
  copy,
  onStay,
  onLeave,
}: {
  copy: Copy;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="confirm" role="dialog" aria-modal="true" data-testid="leave-dialog">
      <div className="confirm-card">
        <h2>{copy.leaveTitle}</h2>
        <p>{copy.leaveBody}</p>
        <button className="primary" type="button" onClick={onStay}>
          {copy.stay}
        </button>
        <button className="ghost" type="button" data-testid="confirm-leave" onClick={onLeave}>
          {copy.leave}
        </button>
      </div>
    </div>
  );
}

export function Countdown({ value }: { value: number }) {
  return (
    <div className="countdown" data-testid="countdown" aria-live="assertive">
      <span key={value}>{value}</span>
    </div>
  );
}

export interface Spot {
  x: number;
  y: number;
  r: number;
  wide?: boolean;
}

const LORD = {
  hydrogen: "https://cdn.lordicon.com/gqzfzudq.json",
  oxygen: "https://cdn.lordicon.com/wxnxiano.json",
  aim: "https://cdn.lordicon.com/iltqorsz.json",
  learn: "https://cdn.lordicon.com/tqywkdcz.json",
  danger: "https://cdn.lordicon.com/dnmvmpfk.json",
} as const;

export function TourLayer({
  copy,
  step,
  spots,
  guide,
  onNext,
  onSkip,
}: {
  copy: Copy;
  step: "hydrogen" | "oxygen" | "aim" | "learn" | "danger";
  spots: Spot[];
  guide: { x1: number; y1: number; x2: number; y2: number } | null;
  onNext: () => void;
  onSkip: () => void;
}) {
  const card =
    step === "hydrogen"
      ? [copy.tourIntroT, copy.tourIntroD, copy.next]
      : step === "oxygen"
        ? [copy.tourOT, copy.tourOD, copy.next]
        : step === "aim"
          ? [copy.tourAimT, copy.tourAimD, ""]
          : step === "learn"
            ? [copy.tourLearnT, copy.tourLearnD, copy.next]
            : [copy.tourDangerT, copy.tourDangerD, copy.ready];
  const action = card[2];
  const raised = step === "hydrogen" || step === "aim" || step === "danger";
  return (
    <div className="tour" data-testid="tour">
      <svg className="tour-dim" aria-hidden>
        <defs>
          <mask id="tour-holes">
            <rect width="100%" height="100%" fill="white" />
            {spots.map((spot, index) =>
              spot.wide ? (
                <ellipse key={index} cx={spot.x} cy={spot.y} rx={spot.r} ry={16} fill="black" />
              ) : (
                <circle key={index} cx={spot.x} cy={spot.y} r={spot.r} fill="black" />
              ),
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(5,7,14,0.58)" mask="url(#tour-holes)" />
      </svg>
      {guide && (
        <svg className="tour-guide" aria-hidden>
          <path d={`M ${guide.x1} ${guide.y1} L ${guide.x2} ${guide.y2}`} />
        </svg>
      )}
      {spots.map((spot, index) => (
        <div
          key={index}
          className={spot.wide ? "spot-ring wide" : "spot-ring"}
          style={
            spot.wide
              ? { left: spot.x - spot.r, top: spot.y - 16, width: spot.r * 2, height: 32 }
              : { left: spot.x - spot.r, top: spot.y - spot.r, width: spot.r * 2, height: spot.r * 2 }
          }
        />
      ))}
      <div className={raised ? "cine high" : "cine"} key={step} data-testid="tour-card">
        <lord-icon src={LORD[step]} trigger="loop" colors="primary:#f4f1ea,secondary:#b7c0cc" />
        <h2>{card[0]}</h2>
        <p>{card[1]}</p>
        <div className="cine-actions">
          <button className="skip" type="button" data-testid="tour-skip" onClick={onSkip}>
            {copy.skip}
          </button>
          {action && (
            <button className="next" type="button" data-testid="tour-next" onClick={onNext}>
              {action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function spotsFor(
  step: "hydrogen" | "oxygen" | "aim" | "learn" | "danger",
  view: ViewState,
  beat: { x: number; y: number } | null,
): Spot[] {
  if (step === "hydrogen") {
    if (view.current) return [{ x: view.current.x, y: view.current.y, r: view.current.r * 1.7 }];
    return [{ x: view.launcherX, y: view.launcherY, r: 42 }];
  }
  if (step === "oxygen" && view.guide) return [{ x: view.guide.x, y: view.guide.y, r: view.guide.r * 1.55 }];
  if (step === "learn" && beat) return [{ x: beat.x, y: beat.y, r: 52 }];
  if (step === "aim") {
    const spots: Spot[] = [];
    if (view.current) spots.push({ x: view.current.x, y: view.current.y, r: view.current.r * 1.35 });
    if (view.guide) spots.push({ x: view.guide.x, y: view.guide.y, r: view.guide.r * 1.45 });
    return spots;
  }
  if (step === "danger") {
    return [{ x: view.width / 2, y: view.dangerY, r: Math.max(80, view.width * 0.38), wide: true }];
  }
  if (!view.balls.length) return [{ x: view.width / 2, y: view.height * 0.34, r: 110 }];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ball of view.balls) {
    minX = Math.min(minX, ball.x);
    maxX = Math.max(maxX, ball.x);
    minY = Math.min(minY, ball.y);
    maxY = Math.max(maxY, ball.y);
  }
  return [
    {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      r: Math.max(maxX - minX, maxY - minY) / 2 + 22,
    },
  ];
}
