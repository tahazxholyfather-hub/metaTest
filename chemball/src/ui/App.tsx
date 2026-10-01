import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AudioBus } from "../audio/sfx";
import { REACTIONS } from "../data/reactions";
import { GameEngine } from "../game/engine";
import { reactionFormula } from "../game/formula";
import { makeLayout } from "../game/hex";
import { formatNumber } from "../game/score";
import type { DiscoveryNotice, HudSnapshot, RunSummary } from "../game/types";
import { hiddenLine, materialName, summaryLine, text } from "../i18n/copy";
import { renderFrame } from "../render/draw";
import type { LeaderboardEntry } from "../save/models";
import { LocalPlayerRepository } from "../save/localRepository";
import {
  BrandScreen,
  Countdown,
  HomeScreen,
  HowToPage,
  LeadersPage,
  LeaveDialog,
  OffScreen,
  SettingsPage,
  TourLayer,
  spotsFor,
} from "./front";

type Screen = "brand" | "home" | "leaders" | "howto" | "settings" | "off" | "play";
type PlayPhase = "tour" | "countdown" | "live";
type TourStep = "hydrogen" | "oxygen" | "aim" | "learn" | "danger";

const EMPTY_HUD: HudSnapshot = {
  status: "playing",
  score: 0,
  combo: 1,
  name: "Reza",
  avatar: "R",
  level: 1,
  xp: 0,
  bestScore: 0,
  hint: true,
  sound: true,
  discovered: [],
  language: "en",
  tourCompleted: false,
};

export function App() {
  const phoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const repoRef = useRef(new LocalPlayerRepository());
  const sessionRef = useRef(false);
  const tourStepRef = useRef<TourStep>("hydrogen");
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("brand");
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryNotice | null>(null);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [playPhase, setPlayPhase] = useState<PlayPhase>("live");
  const [tourStep, setTourStep] = useState<TourStep>("hydrogen");
  const [beat, setBeat] = useState<{ x: number; y: number } | null>(null);
  const [count, setCount] = useState(3);
  tourStepRef.current = tourStep;
  const copy = text(hud.language);

  useEffect(() => {
    if (screen !== "brand") return;
    const id = window.setTimeout(() => setScreen("home"), 2600);
    return () => window.clearTimeout(id);
  }, [screen]);

  useEffect(() => {
    const engine = new GameEngine(repoRef.current, new AudioBus());
    engineRef.current = engine;
    engine.onHud = (next) => setHud(next);
    engine.onDiscovery = (notice) => {
      setDiscovery(notice);
      window.setTimeout(() => {
        setDiscovery((current) => (current?.id === notice.id ? null : current));
      }, 2800);
    };
    engine.onSummary = (next) => {
      setSummary(next);
      setPauseOpen(false);
    };
    engine.onBeat = (next) => {
      setBeat({ x: next.x, y: next.y });
      if (next.kind === "reaction") setTourStep("learn");
    };
    void engine.init().then(() => setReady(true));
    return () => {
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setChrome({ next: copy.nextBall, chain: copy.chain });
    document.documentElement.lang = hud.language === "fa" ? "fa" : "en";
  }, [copy.chain, copy.nextBall, hud.language]);

  useEffect(() => {
    if (screen !== "play" || !ready) return;
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    const phone = phoneRef.current;
    if (!engine || !canvas || !phone) return;

    const resize = () => {
      const rect = phone.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      engine.setLayout(makeLayout(rect.width, rect.height));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(phone);

    if (!sessionRef.current) {
      sessionRef.current = true;
      if (engine.needsTour()) {
        engine.beginTutorial();
        setPlayPhase("tour");
        setTourStep("hydrogen");
        setBeat(null);
      } else {
        engine.restart("live");
        engine.pause(true);
        setPlayPhase("countdown");
        setCount(3);
      }
    }

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      engine.update(dt);
      const ctx = canvas.getContext("2d");
      if (ctx) renderFrame(ctx, engine.snapshot(), Math.min(2, window.devicePixelRatio || 1));
      frame = requestAnimationFrame(loop);
    };
    last = performance.now();
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [screen, ready]);

  useEffect(() => {
    if (screen !== "play" || playPhase !== "countdown") return;
    const engine = engineRef.current;
    engine?.pause(true);
    setCount(3);
    let left = 3;
    const id = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(id);
        engine?.pause(false);
        setPlayPhase("live");
      } else {
        setCount(left);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, playPhase]);

  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.pointer(event.clientX - rect.left, event.clientY - rect.top);
  };

  const goHome = () => {
    sessionRef.current = false;
    engineRef.current?.pause(true);
    setPauseOpen(false);
    setSummary(null);
    setScreen("home");
  };

  const finishTour = () => {
    setDiscovery(null);
    void engineRef.current?.completeTour().then(() => {
      setPlayPhase("countdown");
      setCount(3);
    });
  };

  const replayLesson = () => {
    void engineRef.current?.replayLesson().then(() => {
      sessionRef.current = false;
      setSummary(null);
      setPauseOpen(false);
      setDiscovery(null);
      setBeat(null);
      setTourStep("hydrogen");
      setScreen("play");
    });
  };

  const onTourNext = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (tourStep === "hydrogen") {
      setTourStep("oxygen");
      return;
    }
    if (tourStep === "oxygen") {
      setTourStep("aim");
      return;
    }
    if (tourStep === "learn") {
      engine.releaseBeat();
      setTourStep("danger");
      return;
    }
    if (tourStep === "danger") finishTour();
  };

  const openLeaders = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    setLeaders(await engine.leaderboard());
    setScreen("leaders");
  };

  const known = new Set(hud.discovered);
  const discovered = REACTIONS.filter((reaction) => known.has(reaction.id)).map((reaction) => ({
    id: reaction.id,
    formula: reactionFormula(reaction),
    product: materialName(hud.language, reaction.products[0]?.id ?? ""),
  }));
  const tourCard = tourStep;
  const showTour = screen === "play" && playPhase === "tour" && !summary;
  const tourView = showTour && engineRef.current ? engineRef.current.snapshot() : null;
  const aimLocked = playPhase === "tour" && tourStep !== "aim";
  const guideLine =
    tourStep === "aim" && tourView?.current && tourView.guide
      ? shotLine(tourView.current, tourView.guide)
      : null;

  return (
    <div className="stage">
      <div className="phone" ref={phoneRef} lang={hud.language} dir={hud.language === "fa" ? "rtl" : "ltr"}>
        {screen === "brand" && <BrandScreen copy={copy} onDone={() => setScreen("home")} />}
        {screen === "off" && <OffScreen copy={copy} onReturn={() => setScreen("brand")} />}
        {screen === "home" && (
          <HomeScreen
            copy={copy}
            name={hud.name}
            best={hud.bestScore}
            language={hud.language}
            onPlay={() => {
              if (!ready) return;
              setSummary(null);
              setPauseOpen(false);
              setScreen("play");
            }}
            onLeaders={() => void openLeaders()}
            onHow={() => setScreen("howto")}
            onSettings={() => setScreen("settings")}
            onLanguage={() => void engineRef.current?.setLanguage(hud.language === "en" ? "fa" : "en")}
            onLeave={() => setLeaveAsk(true)}
          />
        )}
        {screen === "leaders" && <LeadersPage copy={copy} rows={leaders} onBack={() => setScreen("home")} />}
        {screen === "howto" && (
          <HowToPage
            copy={copy}
            discovered={discovered}
            hidden={hiddenLine(hud.language, REACTIONS.length - discovered.length)}
            onBack={() => setScreen("home")}
            onReplay={replayLesson}
          />
        )}
        {screen === "settings" && (
          <SettingsPage
            copy={copy}
            name={hud.name}
            sound={hud.sound}
            language={hud.language}
            level={hud.level}
            xp={formatNumber(hud.xp)}
            onBack={() => setScreen("home")}
            onName={(name) => void engineRef.current?.rename(name)}
            onSound={() => void engineRef.current?.setSound(!hud.sound)}
            onLanguage={(language) => void engineRef.current?.setLanguage(language)}
          />
        )}
        {leaveAsk && screen === "home" && (
          <LeaveDialog
            copy={copy}
            onStay={() => setLeaveAsk(false)}
            onLeave={() => {
              setLeaveAsk(false);
              setScreen("off");
            }}
          />
        )}
        {screen === "play" && (
          <>
            <canvas
              ref={canvasRef}
              data-testid="board"
              style={{ pointerEvents: aimLocked ? "none" : "auto" }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                engineRef.current?.unlockAudio();
                aim(event);
              }}
              onPointerMove={aim}
              onPointerUp={() => engineRef.current?.shoot()}
            />
            <header className="hud">
              <div className="who">
                <div className="avatar" aria-hidden>
                  {hud.avatar}
                </div>
                <span>{hud.name}</span>
              </div>
              <div className="score">{formatNumber(hud.score)}</div>
              <button
                className="menu-btn"
                type="button"
                aria-label={copy.menu}
                onClick={() => {
                  if (playPhase !== "live" || summary) return;
                  engineRef.current?.pause(true);
                  setPauseOpen(true);
                }}
              >
                ☰
              </button>
            </header>
            {hud.hint && playPhase === "live" && !summary && <div className="hint">{copy.hint}</div>}
            {discovery && playPhase !== "tour" && (
              <div className="toast" role="status">
                <lord-icon
                  src="https://cdn.lordicon.com/tqywkdcz.json"
                  trigger="loop"
                  colors="primary:#f4f1ea,secondary:#b7c0cc"
                />
                <p className="kicker">{copy.newReaction}</p>
                <strong>{discovery.formula}</strong>
                <em>{materialName(hud.language, REACTIONS.find((item) => item.id === discovery.reactionId)?.products[0]?.id ?? "")}</em>
                <p className="why">{discovery.explanation}</p>
              </div>
            )}
            {playPhase === "countdown" && !summary && <Countdown value={count} />}
            {showTour && tourView && tourCard && (
              <TourLayer
                copy={copy}
                step={tourCard}
                spots={spotsFor(tourCard, tourView, beat)}
                guide={guideLine}
                onNext={onTourNext}
                onSkip={finishTour}
              />
            )}
            {summary && (
              <div className="overlay">
                <section className="endcard">
                  <p className="wordmark">CHEMBALL</p>
                  <p className="record-label">{copy.record}</p>
                  <p className="record">{formatNumber(summary.score)}</p>
                  <p className="xp">
                    +{formatNumber(summary.xpEarned)} {copy.xp}
                  </p>
                  {summary.isRecord && <div className="badge">{copy.newRecord}</div>}
                  <p className="best">
                    {copy.best} {formatNumber(summary.bestScore)}
                  </p>
                  <p className="stats">
                    {summaryLine(hud.language, summary.reactionsCreated, summary.materialsMatched, summary.highestChain)}
                  </p>
                  <button
                    className="primary"
                    type="button"
                    onClick={() => {
                      setSummary(null);
                      engineRef.current?.restart("live");
                      engineRef.current?.pause(true);
                      setPlayPhase("countdown");
                    }}
                  >
                    {copy.playAgain}
                  </button>
                </section>
              </div>
            )}
            {pauseOpen && !summary && (
              <div className="overlay">
                <section className="sheet pause-card">
                  <button
                    className="primary"
                    type="button"
                    onClick={() => {
                      setPauseOpen(false);
                      engineRef.current?.pause(false);
                    }}
                  >
                    {copy.resume}
                  </button>
                  <button className="ghost" type="button" onClick={() => void engineRef.current?.setSound(!hud.sound)}>
                    {hud.sound ? copy.soundOn : copy.soundOff}
                  </button>
                  <button className="ghost" type="button" onClick={goHome}>
                    {copy.home}
                  </button>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function shotLine(
  from: { x: number; y: number; r: number },
  to: { x: number; y: number; r: number },
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: from.x + ux * from.r * 1.05,
    y1: from.y + uy * from.r * 1.05,
    x2: to.x - ux * to.r * 1.25,
    y2: to.y - uy * to.r * 1.25,
  };
}
