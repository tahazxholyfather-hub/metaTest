const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { documentXmlToSequence, parseQuestionsFromText, parseDocxQuestions } = require('../docxQuestions');

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function storedZip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, data] of files) {
        const nameBuf = Buffer.from(name);
        const crc = zlib.crc32(data);
        const local = Buffer.alloc(30 + nameBuf.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 8);
        local.writeUInt32LE(crc >>> 0, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        nameBuf.copy(local, 30);
        locals.push(local, data);

        const central = Buffer.alloc(46 + nameBuf.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 10);
        central.writeUInt32LE(crc >>> 0, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt32LE(offset, 42);
        nameBuf.copy(central, 46);
        centrals.push(central);
        offset += local.length + data.length;
    }
    const centralBuf = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, centralBuf, eocd]);
}

test('places inline images inside the question, option and descriptive tags', () => {
    const xml = `
        <w:p><w:r><w:t>&lt;q&gt;شکل</w:t></w:r>
        <w:r><w:drawing><wp:inline><a:blip r:embed="rId1"/></wp:inline></w:drawing></w:r>
        <w:r><w:t>&lt;/q&gt;</w:t></w:r></w:p>
        <w:p><w:r><w:t>&lt;o1&gt;الف&lt;/o1&gt;</w:t></w:r></w:p>
        <w:p><w:r><w:t>&lt;o2&gt;ب</w:t></w:r>
        <w:r><w:drawing><wp:inline><a:blip r:embed="rId2"/></wp:inline></w:drawing></w:r>
        <w:r><w:t>&lt;/o2&gt;</w:t></w:r></w:p>
        <w:p><w:r><w:t>&lt;o3&gt;پ&lt;/o3&gt;&lt;o4&gt;ت&lt;/o4&gt;&lt;ans&gt;2&lt;/ans&gt;</w:t></w:r></w:p>
        <w:p><w:r><w:t>&lt;desc&gt;چون</w:t></w:r>
        <w:r><w:drawing><wp:inline><a:blip r:embed="rId3"/></wp:inline></w:drawing></w:r>
        <w:r><w:t>&lt;/desc&gt;</w:t></w:r></w:p>
    `;
    const sequence = documentXmlToSequence(xml);
    const images = sequence.images.map((image, index) => ({
        floating: image.floating,
        dataUrl: `data:${index}`,
        warning: null,
    }));
    const parsed = parseQuestionsFromText(sequence.text, images, []);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.questions.length, 1);
    const question = parsed.questions[0];
    assert.equal(question.text, 'شکل');
    assert.equal(question.image, 'data:0');
    assert.deepEqual(question.option_images, [null, 'data:1', null, null]);
    assert.equal(question.descriptive, 'چون');
    assert.equal(question.descriptive_image, 'data:2');
    assert.equal(question.correct_index, 2);
    assert.equal(parsed.warnings.length, 0);
});

test('ignores a floating image and keeps only the first inline image in a slot', () => {
    const xml = `
        <w:p><w:r><w:t>&lt;q&gt;متن</w:t></w:r>
        <w:r><w:drawing><wp:inline><a:blip r:embed="rId1"/></wp:inline></w:drawing></w:r>
        <w:r><w:drawing><wp:inline><a:blip r:embed="rId2"/></wp:inline></w:drawing></w:r>
        <w:r><w:t>&lt;/q&gt;</w:t></w:r></w:p>
        <w:p><w:r><w:t>&lt;o1&gt;الف&lt;/o1&gt;&lt;o2&gt;ب&lt;/o2&gt;&lt;o3&gt;پ&lt;/o3&gt;&lt;o4&gt;ت&lt;/o4&gt;&lt;ans&gt;1&lt;/ans&gt;</w:t></w:r></w:p>
        <w:p><w:r><w:t>&lt;desc&gt;توضیح</w:t></w:r>
        <w:r><w:drawing><wp:anchor><a:blip r:embed="rId3"/></wp:anchor></w:drawing></w:r>
        <w:r><w:t>&lt;/desc&gt;</w:t></w:r></w:p>
    `;
    const sequence = documentXmlToSequence(xml);
    const images = sequence.images.map((image, index) => ({
        floating: image.floating,
        dataUrl: `data:${index}`,
        warning: null,
    }));
    const parsed = parseQuestionsFromText(sequence.text, images, []);
    assert.equal(parsed.questions[0].image, 'data:0');
    assert.equal(parsed.questions[0].descriptive_image, null);
    assert.ok(parsed.warnings.some((warning) => warning.includes('فقط عکس اول')));
    assert.ok(parsed.warnings.some((warning) => warning.includes('شناور')));
});

test('does not count the fallback copy of the same picture', () => {
    const xml = `
        <w:p><w:r><w:t>&lt;q&gt;متن&lt;/q&gt;&lt;o1&gt;الف&lt;/o1&gt;&lt;o2&gt;ب&lt;/o2&gt;&lt;o3&gt;پ&lt;/o3&gt;&lt;o4&gt;ت&lt;/o4&gt;&lt;ans&gt;1&lt;/ans&gt;&lt;desc&gt;حل</w:t></w:r>
        <mc:AlternateContent>
          <mc:Choice><w:drawing><wp:inline><a:blip r:embed="rId1"/></wp:inline></w:drawing></mc:Choice>
          <mc:Fallback><w:pict><v:imagedata r:id="rId1"/></w:pict></mc:Fallback>
        </mc:AlternateContent>
        <w:r><w:t>&lt;/desc&gt;</w:t></w:r></w:p>
    `;
    const sequence = documentXmlToSequence(xml);
    assert.equal(sequence.images.length, 1);
});

test('fallback text is not registered as a second question', () => {
    const xml = `
        <w:p><w:r><w:t>&lt;q&gt;متن&lt;/q&gt;&lt;o1&gt;الف&lt;/o1&gt;&lt;o2&gt;ب&lt;/o2&gt;&lt;o3&gt;پ&lt;/o3&gt;&lt;o4&gt;ت&lt;/o4&gt;&lt;ans&gt;1&lt;/ans&gt;</w:t></w:r>
        <mc:AlternateContent>
          <mc:Fallback><w:r><w:t>&lt;q&gt;متن&lt;/q&gt;&lt;o1&gt;الف&lt;/o1&gt;&lt;o2&gt;ب&lt;/o2&gt;&lt;o3&gt;پ&lt;/o3&gt;&lt;o4&gt;ت&lt;/o4&gt;&lt;ans&gt;1&lt;/ans&gt;</w:t></w:r></mc:Fallback>
        </mc:AlternateContent>
        </w:p>
    `;
    const parsed = parseQuestionsFromText(documentXmlToSequence(xml).text, [], []);
    assert.equal(parsed.questions.length, 1);
    assert.equal(parsed.questions[0].text, 'متن');
});

test('reads an inline picture out of a docx package', () => {
    const xml = Buffer.from(`
        <w:document><w:body>
        <w:p><w:r><w:t>&lt;q&gt;صورت</w:t></w:r>
        <w:r><w:drawing><wp:inline><a:blip r:embed="rId5"/></wp:inline></w:drawing></w:r>
        <w:r><w:t>&lt;/q&gt;&lt;o1&gt;۱&lt;/o1&gt;&lt;o2&gt;۲&lt;/o2&gt;&lt;o3&gt;۳&lt;/o3&gt;&lt;o4&gt;۴&lt;/o4&gt;&lt;ans&gt;1&lt;/ans&gt;</w:t></w:r>
        </w:p></w:body></w:document>
    `);
    const rels = Buffer.from(`
        <Relationships>
          <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
        </Relationships>
    `);
    const docx = storedZip([
        ['word/document.xml', xml],
        ['word/_rels/document.xml.rels', rels],
        ['word/media/image1.png', TINY_PNG],
    ]);
    const parsed = parseDocxQuestions(docx);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.questions[0].text, 'صورت');
    assert.match(parsed.questions[0].image, /^data:image\/png;base64,/);
    assert.deepEqual(parsed.questions[0].option_images, [null, null, null, null]);
});
