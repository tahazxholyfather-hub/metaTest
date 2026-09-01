#!/usr/bin/env node
'use strict';

/**
 * Quick GapGPT connectivity test (no DB required).
 *
 * Usage:
 *   GAPGPT_API_KEY=... node ai-teacher/scripts/test-gapgpt.js
 */

require('dotenv').config();

const aiProvider = require('../services/aiProvider');
const { PROVIDER, MODELS } = require('../config');

async function main() {
    console.log('Provider:', PROVIDER.name);
    console.log('Base URL:', PROVIDER.baseUrl);
    console.log('Model:', MODELS.default);
    console.log('API key:', PROVIDER.apiKey ? `${PROVIDER.apiKey.slice(0, 6)}…` : '(missing)');

    if (!PROVIDER.apiKey) {
        console.error('\nSet GAPGPT_API_KEY in your environment or backend/.env');
        process.exit(1);
    }

    console.log('\n1) Non-stream generate…');
    const result = await aiProvider.generate({
        messages: [
            { role: 'system', content: 'Reply briefly in Persian.' },
            { role: 'user', content: 'سلام، یک جمله کوتاه بگو.' },
        ],
        model: MODELS.default,
        maxTokens: 80,
        temperature: 0.4,
    });
    console.log('OK:', result.content.slice(0, 200));
    console.log('Usage:', result.usage);

    console.log('\n2) Stream generate…');
    let streamed = '';
    for await (const chunk of aiProvider.stream({
        messages: [
            { role: 'system', content: 'Reply briefly in Persian.' },
            { role: 'user', content: 'عدد ۲+۲ چند می‌شود؟' },
        ],
        model: MODELS.default,
        maxTokens: 60,
        temperature: 0.2,
    })) {
        if (chunk.type === 'delta') {
            process.stdout.write(chunk.text);
            streamed += chunk.text;
        } else if (chunk.type === 'done') {
            console.log('\nStream done. chars=', streamed.length, 'usage=', chunk.usage);
        }
    }

    console.log('\nGapGPT connection looks good.');
}

main().catch((err) => {
    console.error('\nGapGPT test failed:', err.code || '', err.message);
    process.exit(1);
});
