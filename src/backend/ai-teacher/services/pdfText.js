'use strict';

/**
 * PDF → text extraction (pdf-parse v2). Returns per-page text so chunks can
 * carry a page hint back into the prompt ("see page 42").
 */
async function extractPdfText(buffer, { maxPages = 600 } = {}) {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
        const result = await parser.getText();
        const total = Number(result?.total) || (Array.isArray(result?.pages) ? result.pages.length : 0);
        const pages = (Array.isArray(result?.pages) ? result.pages : [])
            .slice(0, maxPages)
            .map((p, i) => ({ page: Number(p?.num) || i + 1, text: normalize(p?.text) }))
            .filter((p) => p.text);
        const text = pages.length ? pages.map((p) => p.text).join('\n\n') : normalize(result?.text);
        return { text, pages, total, truncated: total > maxPages };
    } finally {
        try { await parser.destroy?.(); } catch { /* ignore */ }
    }
}

function normalize(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

module.exports = { extractPdfText, normalize };
