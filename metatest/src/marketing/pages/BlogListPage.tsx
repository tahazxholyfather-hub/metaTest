import { ArticleBrowser } from '../components/ArticleBrowser';
import { PageField } from '../components/PageField';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

export function BlogListPage() {
  return (
    <PageField>
      <SiteHeader active="blog" logoLinkClass="logo" />
      <main className="page-wide">
        <ArticleBrowser />
      </main>
      <SiteFooter variant="sub" enamadClass />
    </PageField>
  );
}
