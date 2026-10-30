import { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SoonModal } from './components/SoonModal';
import { startChrome } from './lib/chrome';
import { PAGE_TITLES, pageOf } from './lib/pages';
import { AboutPage } from './pages/AboutPage';
import { BlogListPage } from './pages/BlogListPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { HomePage } from './pages/HomePage';
import aboutCss from './styles/about.css?raw';
import blogCss from './styles/blog.css?raw';
import homeCss from './styles/home.css?raw';
import postCss from './styles/post.css?raw';

const PAGE_CSS = { home: homeCss, blog: blogCss, post: postCss, about: aboutCss };

function usePageStyle(css: string) {
  useLayoutEffect(() => {
    const el = document.createElement('style');
    el.dataset.marketingPage = '1';
    el.textContent = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, [css]);
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function MarketingLayout() {
  const { pathname } = useLocation();
  const page = pageOf(pathname);
  usePageStyle(PAGE_CSS[page]);
  useLayoutEffect(() => {
    if (page !== 'post') document.title = PAGE_TITLES[page];
  }, [page]);
  useEffect(() => startChrome(), []);
  return (
    <>
      <ScrollManager />
      <Outlet />
      <SoonModal />
    </>
  );
}

export function MarketingApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/index.html" element={<HomePage />} />
          <Route path="/landing.html" element={<HomePage />} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/" element={<BlogListPage />} />
          <Route path="/blog/index.html" element={<BlogListPage />} />
          <Route path="/blog/post" element={<BlogPostPage />} />
          <Route path="/blog/post.html" element={<BlogPostPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/about/" element={<AboutPage />} />
          <Route path="/about/index.html" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
