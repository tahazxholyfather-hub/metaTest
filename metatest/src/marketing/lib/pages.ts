export type MarketingPage = 'home' | 'blog' | 'post' | 'about';

export function pageOf(pathname: string): MarketingPage {
  if (pathname.startsWith('/about')) return 'about';
  if (pathname === '/blog' || pathname === '/blog/' || pathname === '/blog/index.html') return 'blog';
  if (pathname.startsWith('/blog')) return 'post';
  return 'home';
}

export const PAGE_TITLES: Record<MarketingPage, string> = {
  home: 'متاتست — پلتفرم جامع ارزیابی و آزمون هوشمند',
  blog: 'بلاگ آموزشی — متاتست',
  post: 'بلاگ آموزشی — متاتست',
  about: 'درباره متاتست — داستان ما',
};
