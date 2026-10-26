import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth: 8
  ihdrData.writeUInt8(2, 9); // color type: 2 (truecolor RGB)
  ihdrData.writeUInt8(0, 10); // compression method
  ihdrData.writeUInt8(0, 11); // filter method
  ihdrData.writeUInt8(0, 12); // interlace method

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data with scanline filters (filter byte 0 per line)
  const lineLength = 1 + width * 3;
  const rawData = Buffer.alloc(height * lineLength);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineLength;
    rawData[lineOffset] = 0; // Filter None

    // Slight gradient effect
    const factor = 1 - (y / height) * 0.25;
    const curR = Math.min(255, Math.floor(r * factor));
    const curG = Math.min(255, Math.floor(g * factor));
    const curB = Math.min(255, Math.floor(b * factor));

    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 3;
      rawData[pxOffset] = curR;
      rawData[pxOffset + 1] = curG;
      rawData[pxOffset + 2] = curB;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crcBuf]);
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Brand color: Indigo #4f46e5 -> (79, 70, 229)
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, 79, 70, 229));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, 79, 70, 229));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, 79, 70, 229));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, 79, 70, 229));

console.log('PNG Icons successfully generated in public directory.');
