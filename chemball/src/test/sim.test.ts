import { beforeEach, describe, expect, it } from "vitest";
import { createSilentSfx } from "../audio/sfx";
import { Board, createBall, resetIds } from "../game/board";
import { difficultyFactor, fallSpeed } from "../game/difficulty";
import { GameEngine } from "../game/engine";
import { COLS, cellCenter, hexDistance, makeLayout, neighborCoords } from "../game/hex";
import { mulberry32 } from "../game/rng";
import { chainBonus, levelFromXp } from "../game/score";
import { findLoose, resolveAll } from "../game/sim";
import { applyPower } from "../game/powers";
import { createInitialBoard, shiftDown } from "../game/spawn";
import type { RunSummary } from "../game/types";
import { MemoryPlayerRepository } from "../save/memoryRepository";
import { normalizeProfile } from "../save/models";

beforeEach(() => {
  resetIds();
});

describe("hex grid", () => {
  it("connects every neighbor at distance 1", () => {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        for (const [nc, nr] of neighborCoords(col, row)) {
          if (nc < 0 || nc >= COLS || nr < 0) continue;
          expect(hexDistance(col, row, nc, nr)).toBe(1);
        }
      }
    }
  });
});

describe("reactions", () => {
  it("does not clear three identical elements", () => {
    const board = anchored();
    board.add(createBall({ kind: "element", elementId: "N", col: 3, row: 1 }));
    const ids = [2, 3, 4].map((col) => {
      const ball = createBall({ kind: "element", elementId: "H", col, row: 2 });
      board.add(ball);
      return ball.id;
    });
    const result = resolveAll(board, [ids[0]!]);
    expect(result.log.some((line) => line.startsWith("match"))).toBe(false);
    expect(ids.every((id) => board.getId(id))).toBe(true);
  });

  it("prefers carbon dioxide when two oxygens touch carbon", () => {
    const board = anchored();
    board.add(createBall({ kind: "element", elementId: "N", col: 3, row: 1 }));
    const carbon = createBall({ kind: "element", elementId: "C", col: 3, row: 2 });
    board.add(carbon);
    board.add(createBall({ kind: "element", elementId: "O", col: 2, row: 2 }));
    board.add(createBall({ kind: "element", elementId: "O", col: 4, row: 2 }));
    const result = resolveAll(board, [carbon.id]);
    expect(result.log[0]).toBe("reaction:co2-full");
    expect(result.log.some((line) => line.startsWith("reaction:carbon-gas"))).toBe(false);
  });

  it("chains a water collision into steam when fire is beside the product", () => {
    const board = quenchPocket();
    const shot = createBall({ kind: "element", elementId: "H", col: 3, row: 3 });
    board.add(shot);
    const result = resolveAll(board, [shot.id], 20);
    expect(result.log).toContain("reaction:water");
    expect(result.log.some((line) => line.startsWith("match"))).toBe(false);
    expect(result.log).toContain("reaction:quench");
    expect(result.steps).toBeGreaterThanOrEqual(2);
    expect(result.steps).toBeLessThanOrEqual(12);
  });

  it("leaves three water orbs untouched", () => {
    const board = anchored();
    board.add(createBall({ kind: "element", elementId: "C", col: 3, row: 1 }));
    const ids = [
      [3, 2],
      [4, 2],
      [3, 3],
    ].map(([col, row]) => {
      const ball = createBall({ kind: "material", materialId: "water", col: col!, row: row! });
      board.add(ball);
      return ball.id;
    });
    const result = resolveAll(board, [ids[0]!]);
    expect(result.log.some((line) => line.startsWith("match"))).toBe(false);
    expect(ids.every((id) => board.getId(id))).toBe(true);
  });

  it("does not form salt until sodium and chlorine are ionized", () => {
    const board = anchored();
    board.add(createBall({ kind: "element", elementId: "C", col: 3, row: 1 }));
    const sodium = createBall({ kind: "element", elementId: "Na", col: 3, row: 2 });
    const chlorine = createBall({ kind: "element", elementId: "Cl", col: 4, row: 2 });
    board.add(sodium);
    board.add(chlorine);
    const quiet = resolveAll(board, [sodium.id]);
    expect(quiet.log.some((line) => line.startsWith("reaction:salt"))).toBe(false);
    expect(board.getId(sodium.id)?.elementId).toBe("Na");
    sodium.charge = 1;
    chlorine.charge = -1;
    const formed = resolveAll(board, [sodium.id]);
    expect(formed.log).toContain("reaction:salt");
    expect(board.getId(sodium.id)?.materialId).toBe("crystal");
  });

  it("pulls opposite ions together and then forms salt", () => {
    const board = anchored();
    board.add(createBall({ kind: "element", elementId: "C", col: 3, row: 1 }));
    const sodium = createBall({ kind: "element", elementId: "Na", col: 3, row: 2 });
    const chlorine = createBall({ kind: "element", elementId: "Cl", col: 3, row: 4 });
    board.add(sodium);
    board.add(chlorine);
    const outcome = applyPower(board, "ion", 3, 3);
    expect(outcome.log).toBe("power:ion");
    expect(sodium.charge).toBe(1);
    expect(chlorine.charge).toBe(-1);
    const result = resolveAll(board, outcome.focusIds, 20);
    expect(result.log).toContain("drift");
    expect(result.log).toContain("reaction:salt");
  });
});

describe("board", () => {
  it("keeps the opening pocket attached and empty at the landing cell", () => {
    const board = createInitialBoard(mulberry32(7), true);
    expect(board.get(3, 5)).toBeUndefined();
    expect(board.get(2, 5)).toBeUndefined();
    expect(board.get(3, 4)?.elementId).toBe("O");
    expect(board.get(4, 4)?.elementId).toBe("H");
    expect(board.get(3, 0)?.elementId).toBe("H");
    expect(board.all().every((ball) => ball.elementId === "H" || ball.elementId === "O")).toBe(true);
    const loose = findLoose(board);
    expect(loose.fall).toEqual([]);
    expect(loose.rise).toEqual([]);
  });

  it("holds a frozen ball while neighbors descend", () => {
    const board = new Board();
    const frozen = createBall({ kind: "element", elementId: "H", col: 3, row: 2 });
    frozen.frozenShifts = 2;
    const mover = createBall({ kind: "element", elementId: "O", col: 3, row: 1 });
    board.add(frozen);
    board.add(mover);
    shiftDown(board, Array.from({ length: COLS }, () => ({ kind: "empty" as const })));
    expect(board.getId(frozen.id)?.row).toBe(2);
    expect(board.getId(frozen.id)?.frozenShifts).toBe(1);
    const moved = board.getId(mover.id);
    expect(moved).toBeTruthy();
    expect(moved?.row === 2 && moved.col === 3).toBe(false);
    expect(board.all()).toHaveLength(2);
  });
});

describe("score and difficulty", () => {
  it("ramps pressure without a linear jump", () => {
    expect(chainBonus(2, 5)).toBe(0);
    expect(chainBonus(4, 5)).toBe(1000);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(400)).toBeGreaterThan(1);
    const early = fallSpeed(difficultyFactor(0, 0));
    const late = fallSpeed(difficultyFactor(180, 20000));
    expect(late).toBeGreaterThan(early * 2);
    expect(early).toBeLessThan(30);
    expect(fallSpeed(0, 0)).toBeLessThan(1);
    expect(fallSpeed(0, 40)).toBeGreaterThan(fallSpeed(0, 0) * 4);
    const veteran = normalizeProfile({ name: "Nova", totalRuns: 2 });
    expect(veteran.language).toBe("en");
    expect(veteran.tourCompleted).toBe(true);
    expect(normalizeProfile({ totalRuns: 0, tourCompleted: false }).tourCompleted).toBe(false);
  });
});

describe("engine", () => {
  it("resolves a landed hydrogen shot into a scored chain", async () => {
    const engine = new GameEngine(new MemoryPlayerRepository(), createSilentSfx(), 7);
    await engine.init();
    engine.animScale = 0.001;
    engine.attachAt(3, 5, "H");
    for (let frame = 0; frame < 200; frame += 1) engine.update(1 / 30);
    expect(engine.trace.join(" | ")).toContain("reaction:water");
    expect(engine.trace.join(" | ").includes("match:")).toBe(false);
    expect(engine.snapshot().balls.some((ball) => ball.glyph === "H₂O" || engine.trace.includes("reaction:water"))).toBe(true);
  });

  it("lands a aimed shot in the opening pocket and reacts", async () => {
    const engine = new GameEngine(new MemoryPlayerRepository(), createSilentSfx(), 11);
    await engine.init();
    engine.animScale = 0.001;
    const layout = makeLayout(390, 844);
    engine.setLayout(layout);
    const target = cellCenter(3, 4, layout, 0);
    engine.pointer(target.x, target.y);
    const ghost = engine.snapshot().ghost;
    engine.shoot();
    for (let frame = 0; frame < 280; frame += 1) engine.update(1 / 60);
    const trace = engine.trace.join(" | ");
    expect(trace, JSON.stringify({ ghost, target, trace: engine.trace })).toContain("reaction:water");
    expect(trace.includes("match:")).toBe(false);
  });

  it("ends the run when the stack reaches the danger line", async () => {
    const repo = new MemoryPlayerRepository();
    const engine = new GameEngine(repo, createSilentSfx(), 3);
    const finished: { summary: RunSummary | null } = { summary: null };
    engine.onSummary = (next) => {
      finished.summary = next;
    };
    await engine.init();
    engine.animScale = 0.001;
    engine.setLayout(makeLayout(390, 844));
    for (let frame = 0; frame < 8000 && !finished.summary; frame += 1) engine.update(0.05);
    const summary = finished.summary;
    expect(summary).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(repo.profile.totalRuns).toBe(1);
    expect(repo.runs).toHaveLength(1);
    expect(repo.profile.bestScore).toBe(summary?.score ?? -1);
  });

  it("rewards a straight-up opening shot", async () => {
    const engine = new GameEngine(new MemoryPlayerRepository(), createSilentSfx(), 11);
    await engine.init();
    engine.animScale = 0.001;
    engine.setLayout(makeLayout(390, 844));
    engine.shoot();
    for (let frame = 0; frame < 280; frame += 1) engine.update(1 / 60);
    expect(engine.trace.join(" | ")).toContain("reaction:water");
    expect(engine.trace.join(" | ").includes("match:")).toBe(false);
  });

  it("keeps the lesson shot on oxygen when the pointer misses", async () => {
    const engine = new GameEngine(new MemoryPlayerRepository(), createSilentSfx(), 11);
    await engine.init();
    engine.animScale = 0.001;
    engine.beginTutorial();
    engine.setLayout(makeLayout(390, 844));
    engine.pointer(12, 820);
    engine.shoot();
    for (let frame = 0; frame < 280; frame += 1) engine.update(1 / 60);
    expect(engine.trace.join(" | ")).toContain("reaction:water");
  });
});

function anchored(): Board {
  const board = new Board();
  for (let col = 0; col < COLS; col += 1) {
    board.add(createBall({ kind: "element", elementId: "C", col, row: 0 }));
  }
  return board;
}

function quenchPocket(): Board {
  const board = anchored();
  board.add(createBall({ kind: "element", elementId: "C", col: 3, row: 1 }));
  board.add(createBall({ kind: "element", elementId: "O", col: 3, row: 2 }));
  board.add(createBall({ kind: "element", elementId: "H", col: 4, row: 2 }));
  board.add(createBall({ kind: "material", materialId: "fire", col: 2, row: 3 }));
  return board;
}
