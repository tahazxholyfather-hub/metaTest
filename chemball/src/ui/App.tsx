import { BookOpen, Pause, Play, Settings, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { AudioBus } from "../audio/sfx";
import { GameEngine } from "../game/engine";
import { makeLayout } from "../game/hex";
import { faDigits } from "../game/labels";
import { formatNumber } from "../game/score";
import type { DiscoveryNotice, HudSnapshot, Layout, RunSummary } from "../game/types";
import { renderFrame } from "../render/draw";
import type { LeaderboardEntry } from "../save/models";
import { LocalPlayerRepository } from "../save/localRepository";
import { Chem } from "./Chem";
import { ChemSky } from "./ChemSky";
import { TIPS, type TipId } from "./copy";
import { GadgetButton, GadgetPicker } from "./GadgetButton";
import { Avatar, GuidePage, LeaderboardPage, PauseSheet, SettingsPage } from "./pages";

const EMPTY_HUD: HudSnapshot = {
  status: "playing",
  score: 0,
  combo: 1,
  name: "رضا",
  avatar: "ر",
  level: 1,
  xp: 0,
  bestScore: 0,
  hint: true,
  sound: true,
  discovered: [],
  gadget: { selected: "nitrogen", burnerArmed: false, catalystReady: false, chill: 0, cooldowns: {} },
  nearDanger: false,
};

const TIP_KEY = "chemball-tips-v2";
const TIP_MS = 3600;

type Mode = "home" | "play";
type Page = "settings" | "guide" | "leaders" | null;

function seenTips(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(TIP_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function App() {
  const phoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const repoRef = useRef(new LocalPlayerRepository());
  const modeRef = useRef<Mode>("home");
  const scoreRef = useRef(0);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [layout, setLayout] = useState<Layout>(() => makeLayout(390, 844));
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryNotice | null>(null);
  const [mode, setMode] = useState<Mode>("home");
  const [page, setPage] = useState<Page>(null);
  const [paused, setPaused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [pop, setPop] = useState(0);
  const [tip, setTip] = useState<{ id: TipId; key: number } | null>(null);
  const tipQueue = useRef<TipId[]>([]);
  const seen = useRef<Set<string>>(seenTips());

  const showTip = useCallback((id: TipId, once = true) => {
    if (once) {
      if (seen.current.has(id)) return;
      seen.current.add(id);
      localStorage.setItem(TIP_KEY, JSON.stringify([...seen.current]));
    }
    setTip((current) => {
      if (!current) return { id, key: Date.now() };
      if (current.id !== id && !tipQueue.current.includes(id)) tipQueue.current.push(id);
      return current;
    });
  }, []);

  useEffect(() => {
    if (!tip) return;
    const timer = window.setTimeout(() => {
      const next = tipQueue.current.shift();
      setTip(next ? { id: next, key: Date.now() } : null);
    }, TIP_MS);
    return () => window.clearTimeout(timer);
  }, [tip]);

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
      }, 2200);
    };
    engine.onSummary = (next) => {
      setSummary(next);
      setPaused(false);
      setPicking(false);
    };

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

    const resize = () => {
      const rect = phone.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const next = makeLayout(rect.width, rect.height);
      engine.setLayout(next);
      setLayout(next);
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

  const live = mode === "play" && !summary && !paused && !picking && !page;

  useEffect(() => {
    if (mode !== "play") return;
    if (!hud.hint) return;
    const timer = window.setTimeout(() => showTip("aim"), 500);
    return () => window.clearTimeout(timer);
  }, [mode, hud.hint, showTip]);

  useEffect(() => {
    if (mode === "play" && hud.discovered.length > 0 && !hud.hint) showTip("match");
  }, [mode, hud.discovered.length, hud.hint, showTip]);

  useEffect(() => {
    if (mode === "play" && hud.nearDanger) showTip("danger");
  }, [mode, hud.nearDanger, showTip]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setTimeout(() => showTip("gadget"), 22000);
    return () => window.clearTimeout(timer);
  }, [live, showTip]);

  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!live) return;
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.pointer(event.clientX - rect.left, event.clientY - rect.top);
  };

  const resume = () => {
    engineRef.current?.pause(false);
    setPaused(false);
    setPicking(false);
  };

  const begin = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.unlockAudio();
    modeRef.current = "play";
    engine.restart();
    setSummary(null);
    setPage(null);
    setPaused(false);
    setMode("play");
  };

  const goHome = () => {
    engineRef.current?.pause(true);
    modeRef.current = "home";
    setSummary(null);
    setPaused(false);
    setPicking(false);
    setPage(null);
    setTip(null);
    setMode("home");
  };

  const openLeaders = async () => {
    const engine = engineRef.current;
    if (engine) setLeaders(await engine.leaderboard());
    setPage("leaders");
  };

  const nextX = Math.max(46, layout.drawRadius + 28);
  const dockStyle = { left: layout.width - nextX - 34, top: layout.launcherY + 10 - 34 };
  const pickerStyle = { right: 12, bottom: layout.height - (layout.launcherY + 10 - 46) };

  return (
    <div className="stage" dir="rtl">
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
            <ChemSky />
            <header className="home-bar" dir="ltr">
              <button className="player-pill" type="button" onClick={() => setPage("settings")}>
                <Avatar name={hud.name} size={34} />
                <span dir="auto">{hud.name}</span>
              </button>
              <div className="best" dir="rtl">
                <small>بهترین امتیاز</small>
                <b className="num">{formatNumber(hud.bestScore)}</b>
              </div>
            </header>
            <div className="home-center">
              <button className="play" type="button" aria-label="شروع بازی" onClick={begin}>
                <span className="play-ring" />
                <span className="play-ring late" />
                <span className="play-face">
                  <Play size={40} strokeWidth={2.2} fill="currentColor" />
                </span>
              </button>
            </div>
            <nav className="home-foot">
              <button type="button" onClick={() => setPage("settings")}>
                <Settings size={20} />
                <span>تنظیمات</span>
              </button>
              <button type="button" onClick={() => setPage("guide")}>
                <BookOpen size={20} />
                <span>راهنما</span>
              </button>
              <button type="button" onClick={() => void openLeaders()}>
                <Trophy size={20} />
                <span>رتبه‌بندی</span>
              </button>
            </nav>
          </div>
        )}

        {mode === "play" && (
          <>
            <header className="hud" dir="ltr">
              <button
                className="round-btn hud-pause"
                type="button"
                aria-label="توقف"
                onClick={() => {
                  engineRef.current?.pause(true);
                  setPaused(true);
                }}
              >
                <Pause size={18} />
              </button>
              <div className="hud-score">
                <div className="score num pop" key={pop}>
                  {formatNumber(hud.score)}
                </div>
                {hud.combo > 1 && !summary && <div className="combo num">x{hud.combo}</div>}
              </div>
              <span className="hud-spacer" />
            </header>
            {!summary && (
              <GadgetButton
                hud={hud.gadget}
                style={dockStyle}
                picking={picking}
                onUse={() => {
                  if (!live) return;
                  if (!engineRef.current?.useGadget()) showTip("charging", false);
                }}
                onHold={() => {
                  if (summary) return;
                  engineRef.current?.pause(true);
                  setPicking(true);
                }}
              />
            )}
          </>
        )}

        {mode === "play" && tip && !summary && (
          <div className="toast-tip" key={tip.key} role="status" style={{ ["--tint" as string]: TIPS[tip.id].tint }}>
            <span className="toast-dot" />
            <span>{TIPS[tip.id].text}</span>
          </div>
        )}

        {discovery && mode === "play" && !summary && (
          <div className="discovery" role="status">
            <small>واکنش تازه</small>
            {discovery.formula.startsWith("|") ? (
              <span className="found-words">{discovery.formula.slice(1)}</span>
            ) : (
              <Chem tex={discovery.formula} size={22} weight={14} />
            )}
            <strong>{discovery.product}</strong>
          </div>
        )}

        {picking && (
          <GadgetPicker
            hud={hud.gadget}
            style={pickerStyle}
            onPick={(id) => {
              engineRef.current?.selectGadget(id);
              resume();
            }}
            onClose={resume}
          />
        )}

        {paused && !summary && !page && (
          <PauseSheet
            sound={hud.sound}
            onResume={resume}
            onGuide={() => setPage("guide")}
            onSound={() => void engineRef.current?.setSound(!hud.sound)}
            onHome={goHome}
          />
        )}

        {summary && (
          <div className="overlay">
            <section className="endcard">
              <small className="end-kicker">پایان آزمایش</small>
              <p className="record num">{formatNumber(summary.score)}</p>
              {summary.isRecord ? <div className="badge">رکورد تازه!</div> : <p className="best-line">بهترین: <b className="num">{formatNumber(summary.bestScore)}</b></p>}
              <div className="end-stats">
                <span>
                  <b>{faDigits(summary.reactionsCreated)}</b>
                  واکنش
                </span>
                <span>
                  <b>{faDigits(summary.materialsMatched)}</b>
                  جورشدن
                </span>
                <span>
                  <b>{faDigits(summary.highestChain)}</b>
                  بلندترین زنجیره
                </span>
              </div>
              <button className="cta" type="button" onClick={begin}>
                <Play size={18} fill="currentColor" />
                دوباره
              </button>
              <button className="soft wide" type="button" onClick={goHome}>
                خانه
              </button>
            </section>
          </div>
        )}

        {page === "settings" && (
          <SettingsPage
            name={hud.name}
            sound={hud.sound}
            onRename={(name) => void engineRef.current?.rename(name)}
            onSound={() => void engineRef.current?.setSound(!hud.sound)}
            onResetTips={() => {
              seen.current.clear();
              localStorage.removeItem(TIP_KEY);
            }}
            onBack={() => setPage(null)}
          />
        )}
        {page === "guide" && <GuidePage discovered={hud.discovered} onBack={() => setPage(null)} />}
        {page === "leaders" && <LeaderboardPage entries={leaders} onBack={() => setPage(null)} />}
      </div>
    </div>
  );
}
