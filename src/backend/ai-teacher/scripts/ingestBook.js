#!/usr/bin/env node
'use strict';

/**
 * One-time / re-run-safe ingestion of a subject's reference textbook PDF
 * into chunked + embedded rows (tam24_ai_book_chunks) for fast RAG retrieval.
 *
 * Usage:
 *   node ai-teacher/scripts/ingestBook.js --book=4 --file=/path/to/biology-10.pdf
 *   node ai-teacher/scripts/ingestBook.js --book=4 --text=/path/to/already-extracted.txt
 *
 * Requires `pdf-parse` (in package.json) and AI_API_KEY for embeddings.
 * Safe to re-run: unchanged chunks are not re-embedded.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../../db');
const ragService = require('../services/ragService');
const { extractPdfText } = require('../services/pdfText');

function parseArgs(argv) {
    const out = {};
    for (const arg of argv.slice(2)) {
        const m = arg.match(/^--([\w-]+)=(.*)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
}

async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
        const { text } = await extractPdfText(fs.readFileSync(filePath), { maxPages: 2000 });
        return text;
    }
    return fs.readFileSync(filePath, 'utf8');
}

async function main() {
    const args = parseArgs(process.argv);
    const bookId = Number(args.book);
    if (!bookId) {
        console.error('Usage: node ingestBook.js --book=<id> --file=<path.pdf|path.txt>');
        process.exit(1);
    }

    const filePath = args.file || args.text;
    if (!filePath || !fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const [[book]] = await db.query(
        `SELECT id, title, subject_key FROM tam24_ai_books WHERE id = ? LIMIT 1`,
        [bookId]
    );
    if (!book) {
        console.error(`No book with id ${bookId}. Add it to tam24_ai_books first.`);
        process.exit(1);
    }
    if (!book.subject_key) {
        console.error(`Book ${bookId} has no subject_key set. Run migration 006 and set it first.`);
        process.exit(1);
    }

    console.log(`Extracting text from ${filePath} ...`);
    const text = await extractText(filePath);
    console.log(`Extracted ${text.length.toLocaleString()} characters.`);

    await db.query(`UPDATE tam24_ai_books SET content_text = ? WHERE id = ?`, [text, bookId]);

    console.log(`Chunking + embedding for subject "${book.subject_key}" (${book.title}) ...`);
    const result = await ragService.ingestBookText(db, bookId, book.subject_key, text);
    console.log(`Done. chunks=${result.totalChunks} embedded=${result.embedded} skipped(unchanged)=${result.skipped}`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
});
