#!/usr/bin/env node
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

const png = (width, height, pixel) => {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y, width, height);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

const writePng = (rel, width, height, pixel) => {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png(width, height, pixel));
};

const inside = (x, y, w, h, m) => x >= m && y >= m && x < w - m && y < h - m;

writePng('assets/images/player.png', 16, 16, (x, y) => {
  if (y < 6 && x > 4 && x < 11) return [242, 204, 143, 255];
  if (y >= 6 && y < 12 && x > 3 && x < 12) return [224, 122, 95, 255];
  if (y >= 12 && (x < 7 || x > 8) && x > 3 && x < 12) return [61, 64, 91, 255];
  return [0, 0, 0, 0];
});

writePng('assets/images/enemy.png', 16, 16, (x, y, w, h) => {
  const dx = x - 7.5;
  const dy = y - 8;
  if (dx * dx + dy * dy > 36) return [0, 0, 0, 0];
  if ((x === 5 || x === 10) && y > 4 && y < 8) return [20, 20, 30, 255];
  return [224, 80, 80, 255];
});

writePng('assets/images/coin.png', 16, 16, (x, y) => {
  const dx = x - 7.5;
  const dy = y - 7.5;
  if (dx * dx + dy * dy > 28) return [0, 0, 0, 0];
  return [242, 204, 143, 255];
});

writePng('assets/images/platform.png', 16, 16, (x, y) => {
  if (!inside(x, y, 16, 16, 0)) return [0, 0, 0, 0];
  if (y < 3) return [129, 178, 154, 255];
  return [90, 74, 66, 255];
});

writePng('assets/images/goal.png', 16, 32, (x, y) => {
  if (x >= 2 && x <= 4) return [244, 241, 222, 255];
  if (y < 14 && x > 4 && x < 14) return [224, 122, 95, 255];
  return [0, 0, 0, 0];
});

writePng('assets/images/heart.png', 16, 16, (x, y) => {
  const left = (x - 4) ** 2 + (y - 5) ** 2 < 10;
  const right = (x - 10) ** 2 + (y - 5) ** 2 < 10;
  const body = y > 4 && y < 13 && x > 2 && x < 13 && Math.abs(x - 7.5) < 12 - y;
  if (left || right || body) return [224, 80, 100, 255];
  return [0, 0, 0, 0];
});

writePng('assets/images/particle.png', 8, 8, (x, y) => {
  if (x > 1 && x < 6 && y > 1 && y < 6) return [242, 204, 143, 255];
  return [0, 0, 0, 0];
});

const wav = (samples) => {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    data.writeInt16LE(clamped * 32767, i * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(22050, 24);
  header.writeUInt32LE(22050 * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

const tone = (freq, seconds, volume = 0.3) => {
  const count = Math.floor(22050 * seconds);
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / 22050;
    const env = Math.min(1, (count - i) / 800);
    samples.push(Math.sin(2 * Math.PI * freq * t) * volume * env);
  }
  return samples;
};

const loop = (notes, seconds) => {
  const count = Math.floor(22050 * seconds);
  const samples = new Array(count).fill(0);
  notes.forEach((note, index) => {
    const start = Math.floor((index / notes.length) * count);
    const end = Math.floor(((index + 1) / notes.length) * count);
    for (let i = start; i < end; i += 1) {
      const t = i / 22050;
      samples[i] = Math.sin(2 * Math.PI * note * t) * 0.2;
    }
  });
  return samples;
};

const writeWav = (rel, samples) => {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, wav(samples));
};

writeWav('assets/audio/music/theme.wav', loop([262, 294, 330, 392, 330, 294], 1.6));
writeWav('assets/audio/music/victory.wav', loop([392, 494, 523, 659], 1.2));
writeWav('assets/audio/sfx/jump.wav', tone(620, 0.12, 0.25));
writeWav('assets/audio/sfx/coin.wav', tone(880, 0.1, 0.3));
writeWav('assets/audio/sfx/hit.wav', tone(140, 0.18, 0.35));
writeWav('assets/audio/sfx/stomp.wav', tone(220, 0.1, 0.3));
writeWav('assets/audio/sfx/win.wav', tone(740, 0.25, 0.3));

const icon = png(16, 16, (x, y) => (x > 3 && x < 12 && y > 3 && y < 12 ? [224, 122, 95, 255] : [20, 24, 43, 255]));
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 16;
ico[7] = 16;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(icon.length, 14);
ico.writeUInt32LE(22, 18);
writeFileSync(join(root, 'favicon.ico'), Buffer.concat([ico, icon]));

mkdirSync(join(root, 'assets/fonts'), { recursive: true });
writeFileSync(
  join(root, 'assets/fonts/display.json'),
  JSON.stringify({ family: 'monospace', source: 'system' }, null, 2),
);
