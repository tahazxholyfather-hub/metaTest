export type PublicPlan = {
  id?: string;
  name?: string;
  price?: number;
  planDiscountPercent?: number;
  days?: number | null;
  unlimited?: boolean;
  comparePrice?: number | null;
  popular?: boolean;
  purchasable?: boolean;
  iconKey?: string;
  iconColors?: { primary?: string | null; secondary?: string | null };
  attributes?: string[];
};

export function faNum(value: number) {
  return Number(value || 0).toLocaleString('fa-IR');
}

export function planPricing(plan: PublicPlan) {
  const price = Number(plan.price || 0);
  const discount = Number(plan.planDiscountPercent || 0);
  const finalPrice = discount > 0 ? price - Math.round((price * discount) / 100) : price;
  const days = plan.unlimited || plan.days == null ? 'نامحدود' : `${faNum(plan.days)} روزه`;
  const listed = Number(plan.comparePrice || 0);
  const compare = listed > finalPrice ? listed : discount > 0 ? price : null;
  return { price, discount, finalPrice, days, compare, locked: plan.purchasable === false };
}
