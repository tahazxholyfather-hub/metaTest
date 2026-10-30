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

export function planIconSrc(plan: PublicPlan) {
  const key = String(plan.iconKey || '').toLowerCase();
  const id = String(plan.id || '').toLowerCase();
  const name = String(plan.name || '');
  const known: Record<string, 1> = { ribbon: 1, coin: 1, gem: 1, stars: 1, lab: 1, sphere: 1 };
  if (known[key]) return `/plan-icons/${key}.json`;
  if (id.indexOf('diamond') >= 0 || id === 'epic' || name.indexOf('الماس') >= 0) return '/plan-icons/gem.json';
  if (id.indexOf('gold') >= 0 || name.indexOf('طلا') >= 0) return '/plan-icons/coin.json';
  if (id.indexOf('silver') >= 0 || name.indexOf('نقر') >= 0) return '/plan-icons/stars.json';
  if (id.indexOf('bronze') >= 0 || name.indexOf('برنز') >= 0) return '/plan-icons/ribbon.json';
  return '/plan-icons/lab.json';
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
