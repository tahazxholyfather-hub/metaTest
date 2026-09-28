import { getElement } from "../data/elements";
import { getMaterial } from "../data/materials";
import type { ReactionDef } from "./types";

export function reactionFormula(reaction: ReactionDef): string {
  const parts: string[] = [];
  for (const reactant of reaction.reactants) {
    const label = reactant.type === "element" ? getElement(reactant.id).symbol : getMaterial(reactant.id).formula;
    for (let i = 0; i < reactant.count; i += 1) parts.push(label);
  }
  return parts.join(" + ");
}

export function reactionProductName(reaction: ReactionDef): string {
  const product = reaction.products[0];
  return product ? getMaterial(product.id).name : "Material";
}
