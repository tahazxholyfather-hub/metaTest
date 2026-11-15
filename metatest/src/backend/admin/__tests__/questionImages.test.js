const test = require('node:test');
const assert = require('node:assert/strict');
const { parseImageDataUrl, validateQuestionImages, MAX_IMAGE_BYTES } = require('../questionImages');

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('accepts an empty image slot', () => {
    assert.equal(parseImageDataUrl(null), null);
    assert.equal(parseImageDataUrl(''), null);
});

test('decodes a png data url', () => {
    const parsed = parseImageDataUrl(`data:image/png;base64,${TINY_PNG}`);
    assert.equal(parsed.ext, 'png');
    assert.ok(parsed.buffer.length > 0);
});

test('rejects a non-image payload', () => {
    assert.throws(
        () => parseImageDataUrl('data:text/html;base64,PGh0bWw+'),
        (err) => err.statusCode === 400
    );
});

test('rejects a data url whose bytes do not match the image type', () => {
    assert.throws(
        () => parseImageDataUrl('data:image/png;base64,aGVsbG8='),
        (err) => err.statusCode === 400
    );
});

test('rejects an image larger than 4 megabytes', () => {
    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1, 0);
    big[0] = 0x89; big[1] = 0x50; big[2] = 0x4e; big[3] = 0x47;
    const padded = `data:image/png;base64,${big.toString('base64')}`;
    assert.throws(() => parseImageDataUrl(padded), (err) => err.statusCode === 400);
});

test('validates stem, option and descriptive slots together', () => {
    assert.doesNotThrow(() => validateQuestionImages({
        image: null,
        option_images: [null, `data:image/png;base64,${TINY_PNG}`, '', null],
        descriptive_image: '',
    }));
    assert.throws(
        () => validateQuestionImages({ option_images: [1, 2, 3, 4, 5] }),
        (err) => err.statusCode === 400
    );
});
