import { getElement } from "../data/elements";
import { materialName, materialShort, materialTex } from "./labels";
import type { ReactionDef } from "./types";

/**
 * mhchem equation such as `H + O -> H2O`. MathJax cannot shape Persian, so a reaction that
 * involves a formula-less material (fire, energy) falls back to Persian words joined by `|`.
 */
export function reactionTex(reaction: ReactionDef): string {
  const left: string[] = [];
  let plain = false;
  for (const reactant of reaction.reactants) {
    const label = reactant.type === "element" ? getElement(reactant.id).symbol : materialTex(reactant.id);
    if (!label) plain = true;
    for (let i = 0; i < reactant.count; i += 1) left.push(label);
  }
  const product = reaction.products[0];
  const right = product ? materialTex(product.id) : "";
  if (plain || !right) return `|${reactionWords(reaction)}`;
  return `${left.join(" + ")} -> ${right}`;
}

export function reactionWords(reaction: ReactionDef): string {
  const left = reaction.reactants.flatMap((reactant) => {
    const label = reactant.type === "element" ? getElement(reactant.id).symbol : materialShort(reactant.id);
    return Array.from({ length: reactant.count }, () => label);
  });
  const product = reaction.products[0];
  return `${left.join(" + ")} ← ${product ? materialShort(product.id) : ""}`;
}

export function reactionProductName(reaction: ReactionDef): string {
  const product = reaction.products[0];
  return product ? materialName(product.id) : "ماده";
}