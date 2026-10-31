'use strict';

const fs = require('fs');
const path = require('path');

const PAGE_PATHS = [
    '/',
    '/index.html',
    '/landing.html',
    '/blog',
    '/blog/',
    '/blog/index.html',
    '/blog/post',
    '/blog/post.html',
    '/about',
    '/about/',
    '/about/index.html',
];

function isViteAsset(pathname) {
    return pathname.startsWith('/src/')
        || pathname.startsWith('/@')
        || pathname.startsWith('/node_modules/')
        || pathname === '/marketing.html';
}

async function installMarketing(app, { profile }) {
    const express = require('express');
    let vite = null;
    const forceHtml = process.env.MARKETING_HTML === '1';
    if (profile.localhost && !forceHtml) {
        try {
            const { createServer } = await import('vite');
            vite = await createServer({
                configFile: path.resolve(__dirname, '../../vite.marketing.config.ts'),
                server: { middlewareMode: true, hmr: { port: 24678 } },
                appType: 'custom',
            });
            app.use((req, res, next) => {
                if (isViteAsset(req.path || '')) return vite.middlewares(req, res, next);
                return next();
            });
            console.log('[site] React marketing site on http://localhost:3000/');
        } catch (err) {
            vite = null;
            console.error('[site] Vite middleware skipped:', err.message);
        }
    }

    const distHtml = path.resolve(__dirname, '../../dist-site/marketing.html');
    const distAssets = path.resolve(__dirname, '../../dist-site/site-assets');
    if (!vite && fs.existsSync(distAssets)) {
        app.use('/site-assets', express.static(distAssets, { index: false, maxAge: '1h' }));
    }

    async function sendMarketing(req, res, next) {
        if (vite) {
            try {
                const htmlPath = path.resolve(__dirname, '../../marketing.html');
                let html = fs.readFileSync(htmlPath, 'utf8');
                html = await vite.transformIndexHtml(req.originalUrl, html);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
                return;
            } catch (err) {
                console.error('[site] transform failed:', err.message);
            }
        }
        if (!vite && fs.existsSync(distHtml)) {
            res.sendFile(distHtml);
            return;
        }
        next();
    }

    app.get(PAGE_PATHS, sendMarketing);
    app.get('/blog/:slug', (req, res, next) => {
        const slug = String(req.params.slug || '');
        if (slug.includes('.')) return next();
        return sendMarketing(req, res, next);
    });
}

module.exports = { installMarketing };
