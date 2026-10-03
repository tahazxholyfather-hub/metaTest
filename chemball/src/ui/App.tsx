import { Atom, Play, Trophy } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { AudioBus } from "../audio/sfx";
import { GameEngine } from "../game/engine";
import { makeLayout } from "../game/hex";
import { formatNumber } from "../game/score";
import type { DiscoveryNotice, HudSnapshot, RunSummary } from "../game/types";
import { renderFrame } from "../render/draw";
import { LocalPlayerRepository } from "../save/localRepository";
import { SIGNS, TIPS } from "./copy";
import { GadgetSheet, Guide } from "./panels";

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
  armedGadget: "",
  gadgetCharges: "frost:2,void:1,magnet:2,spark:2,catalyst:2",
};

type Mode = "home" | "play";
type Sheet = "gadgets" | "guide" | null;

export function App() {
  const phoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const repoRef = useRef(new LocalPlayerRepository());
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryNotice | null>(null);
  const [mode, setMode] = useState<Mode>("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("Reza");
  const [tip, setTip] = useState(0);
  const [pop, setPop] = useState(0);
  const scoreRef = useRef(0);
  const modeRef = useRef<Mode>("home");

  useEffect(() => {
    const canvas = canvasRef.current;
    const phone = phoneRef.current;
    if (!canvas || !phone) return;
    const engine = new GameEngine(repoRef.current, new AudioBus());
    engineRef.current = engine;
    engine.onHud = (next) => {
      setHud(next);
      if (next.score !== scoreRef.current) {
        scoreRef.current = next.score;
        setPop((value) => value + 1);
      }
    };
    engine.onDiscovery = (notice) => {
      setDiscovery(notice);
      window.setTimeout(() => {
        setDiscovery((current) => (current?.id === notice.id ? null : current));
      }, 1700);
    };
    engine.onSummary = (next) => {
      setSummary(next);
      setSheet(null);
    };

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      engine.update(dt);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderFrame(ctx, engine.snapshot(), dpr);
      }
      frame = requestAnimationFrame(loop);
    };

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
    void engine.init().then(() => {
      if (modeRef.current === "home") engine.pause(true);
      resize();
      last = performance.now();
      frame = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    if (mode !== "play" || summary || sheet) return;
    const timer = window.setTimeout(() => {
      setTip((current) => (current < TIPS.length - 1 ? current + 1 : current));
    }, 3400);
    return () => window.clearTimeout(timer);
  }, [mode, summary, sheet, tip]);

  const live = mode === "play" && !sheet && !summary;

  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!live) return;
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.pointer(event.clientX - rect.left, event.clientY - rect.top);
  };

  const begin = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.unlockAudio();
    modeRef.current = "play";
    if (hud.status === "gameover") engine.restart();
    else engine.pause(false);
    setSummary(null);
    setSheet(null);
    setNaming(false);
    setTip(0);
    setMode("play");
  };

  const openGadgets = () => {
    engineRef.current?.pause(true);
    setSheet("gadgets");
  };

  const closeSheet = () => {
    if (hud.status !== "gameover") engineRef.current?.pause(false);
    setSheet(null);
  };

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    void engineRef.current?.rename(draftName);
    setNaming(false);
  };

  const charges = parseCharges(hud.gadgetCharges);
  const chargeTotal = Object.values(charges).reduce((sum, value) => sum + value, 0);
  const lesson = TIPS[tip] ?? TIPS[0];

  return (
    <div className="stage">
      <div className="phone" ref={phoneRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            if (!live) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            engineRef.current?.unlockAudio();
            aim(event);
          }}
          onPointerMove={aim}
          onPointerUp={() => {
            if (live) engineRef.current?.shoot();
          }}
        />
        {mode === "home" && (
          <div className="home">
            <header className="home-bar">
              <div className="best-chip">
                <Trophy size={15} />
                <span>
                  <small>رکورد</small>
                  <b>{formatNumber(hud.bestScore)}</b>
                </span>
              </div>
              {naming ? (
                <form className="name-form" onSubmit={saveName}>
                  <input
                    aria-label="نام"
                    value={draftName}
                    maxLength={16}
                    autoFocus
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => {
                      void engineRef.current?.rename(draftName);
                      setNaming(false);
                    }}
                  />
                </form>
              ) : (
                <button
                  className="name-chip"
                  type="button"
                  onClick={() => {
                    setDraftName(hud.name);
                    setNaming(true);
                  }}
                >
                  {hud.name}
                </button>
              )}
            </header>
            <div className="field" aria-hidden>
              {SIGNS.map((sign) => (
                <span
                  key={sign.s}
                  className="sign"
                  style={{
                    left: sign.x,
                    top: sign.y,
                    width: sign.n,
                    height: sign.n,
                    color: sign.c,
                    animationDelay: sign.d,
                  }}
                >
                  {sign.s}
                </span>
              ))}
            </div>
            <button className="play" type="button" aria-label="شروع" onClick={begin}>
              <span className="play-ring" />
              <span className="play-ring late" />
              <Play size={34} strokeWidth={2.4} className="play-icon" />
            </button>
          </div>
        )}
        {mode === "play" && (
          <header className="hud">
            <div className={pop > 0 ? "score pop" : "score"} key={pop}>
              {formatNumber(hud.score)}
            </div>
            {hud.combo > 1 && !summary && <div className="combo">×{hud.combo}</div>}
          </header>
        )}
        {live && lesson && (
          <div className="snack rtl" role="status">
            <b>{lesson.k}</b>
            <span>{lesson.t}</span>
          </div>
        )}
        {mode === "play" && !summary && sheet !== "guide" && (
          <button
            className={hud.armedGadget ? "gadget-btn armed" : "gadget-btn"}
            type="button"
            aria-label="ابزارها"
            onClick={openGadgets}
          >
            <Atom size={26} />
            <em>{chargeTotal}</em>
          </button>
        )}
        {discovery && mode === "play" && (
          <div className="toast rtl" role="status">
            <p className="kicker">واکنش تازه</p>
            <strong dir="ltr">{discovery.formula}</strong>
            <em>{discovery.product}</em>
          </div>
        )}
        {summary && (
          <div className="overlay">
            <section className="endcard rtl">
              <p className="wordmark">شیمی‌بال</p>
              <p className="record-label">رکورد این آزمایش</p>
              <p className="record">{formatNumber(summary.score)}</p>
              <p className="xp">+{formatNumber(summary.xpEarned)} تجربه</p>
              {summary.isRecord && <div className="badge">رکورد تازه</div>}
              <p className="best">بهترین {formatNumber(summary.bestScore)}</p>
              <p className="stats">
                {summary.reactionsCreated} واکنش · {summary.materialsMatched} جور · زنجیره {summary.highestChain}
              </p>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setSummary(null);
                  setTip(0);
                  engineRef.current?.restart();
                }}
              >
                دوباره
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setSummary(null);
                  setSheet(null);
                  modeRef.current = "home";
                  setMode("home");
                }}
              >
                خانه
              </button>
            </section>
          </div>
        )}
        {sheet === "gadgets" && !summary && (
          <GadgetSheet
            charges={charges}
            armed={hud.armedGadget}
            sound={hud.sound}
            onArm={(id) => engineRef.current?.armGadget(id)}
            onSound={() => void engineRef.current?.setSound(!hud.sound)}
            onGuide={() => setSheet("guide")}
            onClose={closeSheet}
          />
        )}
        {sheet === "guide" && !summary && <Guide discovered={hud.discovered} onBack={() => setSheet("gadgets")} />}
      </div>
    </div>
  );
}

function parseCharges(raw: string): Record<string, number> {
  const charges: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const [id, count] = part.split(":");
    if (id) charges[id] = Number(count) || 0;
  }
  return charges;
}
