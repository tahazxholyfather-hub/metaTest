import { Board } from "./board";
import { hexDistance } from "./hex";
import type { Ball } from "./types";

export const GADGET_IDS = ["nitrogen", "burner", "catalyst"] as const;
export type GadgetId = (typeof GADGET_IDS)[number];

/** Seconds of play before a gadget can be used again. */
export const GADGET_COOLDOWN: Record<GadgetId, number> = {
  nitrogen: 45,
  burner: 30,
  catalyst: 40,
};

export const NITROGEN_SECONDS = 8;
export const CATALYST_FACTOR = 2;

export function isGadget(id: string): id is GadgetId {
  return (GADGET_IDS as readonly string[]).includes(id);
}

export function readyCooldowns(): Record<GadgetId, number> {
  return { nitrogen: 0, burner: 0, catalyst: 0 };
}

/** Balls the burner flame removes around the landing cell. */
export function burnerTargets(board: Board, col: number, row: number): Ball[] {
  return board.all().filter((ball) => hexDistance(ball.col, ball.row, col, row) <= 1);
}
