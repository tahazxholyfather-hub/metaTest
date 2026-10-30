import { Link } from 'react-router-dom';
import { appUrl } from '../lib/appUrl';
import { DownloadIcon, UserIcon } from './icons';

export type NavKey = 'home' | 'blog' | 'about';

const LINKS: { key: NavKey; href: string; label: string }[] = [
  { key: 'home', href: '/', label: 'صفحه اصلی' },
  { key: 'blog', href: '/blog/', label: 'وبلاگ' },
  { key: 'about', href: '/about/', label: 'درباره ما' },
];

type Props = {
  active: NavKey;
  logoLinkClass?: string;
  logoAlt?: string;
  logoLabel?: string;
};

export function SiteHeader({ active, logoLinkClass, logoAlt = 'Metatest', logoLabel = 'متاتست' }: Props) {
  const href = appUrl();
  return (
    <header>
      <div className="header-brand">
        <Link to="/" className={logoLinkClass} aria-label={logoLabel}>
          <img src="https://metatest.app/logo.png" className="logo-img" alt={logoAlt} />
        </Link>
        <nav className="header-nav" aria-label="ناوبری">
          {LINKS.map((link) => (
            <Link key={link.key} to={link.href} className={link.key === active ? 'nav-link active' : 'nav-link'}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="header-actions">
        <button type="button" className="header-btn js-soon" aria-label="دانلود اپلیکیشن">
          <DownloadIcon />
          <span>دانلود اپلیکیشن</span>
        </button>
        <a href={href} className="header-btn js-app" aria-label="ورود / ثبت‌نام">
          <UserIcon />
          <span>ورود / ثبت‌نام</span>
        </a>
      </div>
    </header>
  );
}
