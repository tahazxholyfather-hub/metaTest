const zlib = require('zlib');
const path = require('path');
const { bufferToDataUrl } = require('./questionImages');

const MARKER = /\u0001(IMG|FLT)(\d+)\u0001/g;
const WARNING_LIMIT = 40;

function decodeXmlText(text) {
    return String(text || '')
        .replace(/&laquo;|&#171;/gi, '«')
        .replace(/&raquo;|&#187;/gi, '»')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&amp;/g, '&')
        .replace(/\u0001/g, '');
}

function tagName(raw) {
    const match = raw.match(/^<\/?\s*([^\s/>]+)/);
    if (!match) return '';
    const name = match[1];
    const parts = name.split(':');
    return parts[parts.length - 1];
}

function attr(raw, names) {
    for (const name of names) {
        const match = raw.match(new RegExp(`\\s(?:[\\w]+:)?${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
        if (match) return match[2] || match[3] || '';
    }
    return null;
}

function popStack(stack, local) {
    const index = stack.lastIndexOf(local);
    if (index >= 0) stack.splice(index, 1);
}

function documentXmlToSequence(xml) {
    const images = [];
    const stack = [];
    let out = '';
    let cursor = 0;
    const source = String(xml || '');

    while (cursor < source.length) {
        const open = source.indexOf('<', cursor);
        if (open === -1) break;
        const close = source.indexOf('>', open);
        if (close === -1) break;
        const raw = source.slice(open, close + 1);
        const local = tagName(raw);
        const closing = raw.startsWith('</');
        const selfClosing = /\/\s*>$/.test(raw);

        if (!closing && (local === 'inline' || local === 'anchor' || local === 'pict' || local === 'Fallback')) {
            stack.push(local);
        }
        if (closing && (local === 'inline' || local === 'anchor' || local === 'pict' || local === 'Fallback')) {
            popStack(stack, local);
        }

        if (!closing && local === 't' && !selfClosing) {
            const endTag = `</${raw.match(/^<\s*([^\s/>]+)/)[1]}>`;
            const end = source.indexOf(endTag, close + 1);
            if (end === -1) {
                cursor = close + 1;
                continue;
            }
            out += decodeXmlText(source.slice(close + 1, end));
            cursor = end + endTag.length;
            continue;
        }

        if (!closing && (local === 'tab' || local === 'br' || local === 'cr')) {
            out += local === 'tab' ? '\t' : '\n';
        }
        if (closing && local === 'p') out += '\n';

        if (!closing && (local === 'blip' || local === 'imagedata') && !stack.includes('Fallback')) {
            const relId = attr(raw, ['embed', 'id']);
            if (relId) {
                const floating = stack.includes('anchor') && !stack.includes('inline') && !stack.includes('pict');
                const index = images.length;
                images.push({ relId, floating });
                out += `\u0001${floating ? 'FLT' : 'IMG'}${index}\u0001`;
            }
        }

        cursor = close + 1;
    }

    return { text: out, images };
}

function readDocxEntries(buffer) {
    let eocd = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd === -1) throw new Error('The uploaded file is not a valid .docx document.');

    const entryCount = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);
    const files = new Map();

    for (let i = 0; i < entryCount; i++) {
        if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break;
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

        if (!name.endsWith('/') && localHeaderOffset + 30 <= buffer.length) {
            const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
            const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
            const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
            const data = buffer.slice(dataStart, dataStart + compressedSize);
            if (method === 0) files.set(name, data);
            else if (method === 8) files.set(name, zlib.inflateRawSync(data));
            else throw new Error('Unsupported compression method inside the .docx file.');
        }

        offset += 46 + nameLength + extraLength + commentLength;
    }

    return files;
}

function parseRelationships(xml) {
    const map = new Map();
    const pattern = /<Relationship\b([^>]*)\/?>/gi;
    let match = pattern.exec(xml);
    while (match) {
        const id = attr(match[1], ['Id']);
        const target = attr(match[1], ['Target']);
        const type = attr(match[1], ['Type']);
        if (id && target && (!type || /\/image$/i.test(type))) map.set(id, target);
        match = pattern.exec(xml);
    }
    return map;
}

function resolveDocxTarget(target) {
    let value = decodeURIComponent(String(target || '').replace(/\\/g, '/')).trim();
    if (!value) return null;
    if (value.startsWith('/')) value = value.replace(/^\/+/, '');
    else value = path.posix.join('word', value);
    value = path.posix.normalize(value);
    if (value.startsWith('../') || value.includes('/../') || value === '..') return null;
    return value;
}

function attachMedia(imageRefs, relsXml, files) {
    const rels = parseRelationships(relsXml || '');
    return imageRefs.map((ref) => {
        const target = rels.get(ref.relId);
        const located = target ? resolveDocxTarget(target) : null;
        const bytes = located ? files.get(located) : null;
        if (!bytes) {
            return { floating: ref.floating, dataUrl: null, warning: 'فایل عکس داخل ورد پیدا نشد.' };
        }
        try {
            return { floating: ref.floating, dataUrl: bufferToDataUrl(bytes), warning: null };
        } catch (error) {
            return { floating: ref.floating, dataUrl: null, warning: error.message };
        }
    });
}

function pushWarning(warnings, message) {
    if (warnings.length >= WARNING_LIMIT) return;
    warnings.push(message);
}

function withoutNestedSlots(inner) {
    return String(inner || '')
        .replace(/<o[1-4]>[\s\S]*?<\/o[1-4]>/gi, '')
        .replace(/<ans>[\s\S]*?<\/ans>/gi, '')
        .replace(/<desc>[\s\S]*?<\/desc>/gi, '');
}

function stripMarkers(raw) {
    return String(raw || '').replace(MARKER, '').trim();
}

function claimSlot(raw, images, label, questionNumber, warnings) {
    const found = [];
    const text = String(raw || '').replace(MARKER, (_, kind, num) => {
        const image = images[Number(num)];
        if (!image || image.claimed) return '';
        image.claimed = true;
        found.push({ kind, image });
        return '';
    }).trim();

    let dataUrl = null;
    for (const item of found) {
        item.image.claimed = true;
        if (item.kind === 'FLT' || item.image.floating) {
            pushWarning(warnings, `سوال ${questionNumber}: عکس شناور داخل ${label} نادیده گرفته شد. عکس را داخل خط بگذار.`);
            continue;
        }
        if (!item.image.dataUrl) {
            pushWarning(warnings, `سوال ${questionNumber}: عکس داخل ${label} خوانده نشد. ${item.image.warning || ''}`.trim());
            continue;
        }
        if (dataUrl) {
            pushWarning(warnings, `سوال ${questionNumber}: بیش از یک عکس داخل ${label} بود. فقط عکس اول برداشته شد.`);
            continue;
        }
        dataUrl = item.image.dataUrl;
    }
    return { text, dataUrl };
}

function parseQuestionsFromText(text, images = [], warnings = []) {
    const questions = [];
    const errors = [];
    const blocks = String(text || '').split(/<q>/i).slice(1);

    blocks.forEach((block, index) => {
        const blockNumber = index + 1;
        const grabTag = (tag) => {
            const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
            return match ? match[1] : null;
        };

        const questionMatch = block.match(/^([\s\S]*?)<\/q>/i);
        const questionInner = questionMatch ? questionMatch[1] : null;
        const stem = claimSlot(withoutNestedSlots(questionInner || ''), images, 'صورت سوال', blockNumber, warnings);
        const questionText = questionInner == null ? null : stripMarkers(questionInner);
        const optionSlots = [1, 2, 3, 4].map((number) => {
            const raw = grabTag(`o${number}`);
            if (raw == null) return null;
            return claimSlot(raw, images, `گزینه ${number}`, blockNumber, warnings);
        });
        const ansRaw = grabTag('ans');
        if (ansRaw != null) {
            if (/\u0001IMG\d+\u0001/.test(ansRaw)) {
                pushWarning(warnings, `سوال ${blockNumber}: عکس داخل تگ پاسخ نادیده گرفته شد.`);
            }
            claimSlot(ansRaw, images, 'تگ پاسخ', blockNumber, warnings);
        }
        const descRaw = grabTag('desc');
        const descriptive = descRaw == null ? null : claimSlot(descRaw, images, 'پاسخ تشریحی', blockNumber, warnings);
        String(block).replace(MARKER, (_, kind, num) => {
            const image = images[Number(num)];
            if (!image || image.claimed) return '';
            image.claimed = true;
            if (kind === 'FLT' || image.floating) {
                pushWarning(warnings, `سوال ${blockNumber}: عکس شناور بیرون از تگ‌ها نادیده گرفته شد. عکس را داخل خط بگذار.`);
            } else {
                pushWarning(warnings, `سوال ${blockNumber}: یک عکس بیرون از تگ‌های صورت سوال، گزینه و پاسخ بود و وصل نشد.`);
            }
            return '';
        });
        const answerNumber = parseInt(stripMarkers(ansRaw || ''), 10);

        if (!questionText) {
            errors.push(`Question ${blockNumber}: missing or empty question text (</q> not found).`);
        } else if (optionSlots.some((slot) => !slot || slot.text === '')) {
            const missing = optionSlots.map((slot, i) => (!slot || slot.text === '') ? `o${i + 1}` : null).filter(Boolean).join(', ');
            errors.push(`Question ${blockNumber}: missing or empty option tag(s): ${missing}.`);
        } else if (!answerNumber || answerNumber < 1 || answerNumber > 4) {
            errors.push(`Question ${blockNumber}: <ans> must be a number from 1 to 4 (found: "${stripMarkers(ansRaw || '') || 'nothing'}").`);
        } else {
            questions.push({
                text: questionText,
                options: optionSlots.map((slot) => slot.text),
                correct_index: answerNumber,
                descriptive: descriptive ? descriptive.text : '',
                image: stem.dataUrl,
                option_images: optionSlots.map((slot) => slot.dataUrl),
                descriptive_image: descriptive ? descriptive.dataUrl : null,
            });
        }
    });

    images.forEach((image) => {
        if (!image.claimed) {
            image.claimed = true;
            pushWarning(warnings, 'یک عکس بیرون از تگ‌های سوال بود و وصل نشد.');
        }
    });

    return { questions, errors, warnings };
}

function parseDocxQuestions(buffer) {
    const files = readDocxEntries(buffer);
    const xml = files.get('word/document.xml');
    if (!xml) throw new Error('word/document.xml not found — please upload a valid .docx file.');
    const sequence = documentXmlToSequence(xml.toString('utf8'));
    const rels = files.get('word/_rels/document.xml.rels');
    const images = attachMedia(sequence.images, rels ? rels.toString('utf8') : '', files);
    return parseQuestionsFromText(sequence.text, images, []);
}

module.exports = {
    documentXmlToSequence,
    parseQuestionsFromText,
    parseRelationships,
    resolveDocxTarget,
    readDocxEntries,
    parseDocxQuestions,
};
