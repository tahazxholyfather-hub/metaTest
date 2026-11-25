'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    sniffImage,
    sniffAudio,
    sniffPdf,
    randomStoredName,
    assertInside,
    IMAGE_EXT,
} = require('./uploadSniff');
const path = require('path');
const os = require('os');

test('SEC-007 image type comes from magic bytes, not a .php name', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)]);
    const php = Buffer.from('<?php echo 1; ?>');
    assert.equal(sniffImage(png), 'image/png');
    assert.equal(sniffImage(jpeg), 'image/jpeg');
    assert.equal(sniffImage(php), null);
    assert.equal(IMAGE_EXT[sniffImage(png)], '.png');
});

test('SEC-007 audio type comes from magic bytes', () => {
    const wav = Buffer.alloc(12);
    wav.write('RIFF', 0);
    wav.write('WAVE', 8);
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(sniffAudio(wav), 'audio/wav');
    assert.equal(sniffAudio(webm), 'audio/webm');
    assert.equal(sniffAudio(Buffer.from('<?php')), null);
});

test('SEC-007 pdf magic', () => {
    assert.equal(sniffPdf(Buffer.from('%PDF-1.7')), 'application/pdf');
    assert.equal(sniffPdf(Buffer.from('<?php')), null);
});

test('SEC-007 stored name is random and cannot carry a client extension', () => {
    const name = randomStoredName('.png');
    assert.match(name, /^[a-f0-9]{32}\.png$/);
    assert.throws(() => randomStoredName('.php'));
    assert.throws(() => randomStoredName('php'));
});

test('SEC-007 path stays inside the upload directory', () => {
    const root = path.join(os.tmpdir(), 'metatest-uploads');
    const dest = assertInside(root, 'abc.png');
    assert.equal(dest, path.join(path.resolve(root), 'abc.png'));
    const escaped = assertInside(root, '../etc/passwd');
    assert.equal(path.basename(escaped), 'passwd');
    assert.ok(escaped.startsWith(path.resolve(root)));
});
