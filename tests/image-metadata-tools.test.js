const assert = require('node:assert/strict');
const tools = require('../assets/image-metadata-tools.js');

const concat = (...parts) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
};

const segment = (marker, payload) => new Uint8Array([0xff, marker, 0, payload.length + 2, ...payload]);
const jpegScan = new Uint8Array([0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 17, 34, 51, 0xff, 0xd9]);
const jpeg = concat(
  new Uint8Array([0xff, 0xd8]),
  segment(0xe0, new TextEncoder().encode('JFIF\0')),
  segment(0xe1, concat(new TextEncoder().encode('Exif\0\0'), new Uint8Array([1, 2, 3]))),
  segment(0xfe, new TextEncoder().encode('private comment')),
  jpegScan,
);
assert.equal(tools.sniffFormat(jpeg), 'jpeg');
assert.deepEqual(tools.listMetadata(jpeg), ['EXIF and GPS', 'JPEG comment']);
const cleanJpeg = tools.stripMetadata(jpeg);
assert.deepEqual(cleanJpeg.removed, ['EXIF and GPS', 'JPEG comment']);
assert.deepEqual(tools.listMetadata(cleanJpeg.bytes), []);
assert.ok(Buffer.from(cleanJpeg.bytes).includes(Buffer.from('JFIF')));
assert.ok(Buffer.from(cleanJpeg.bytes).includes(Buffer.from([17, 34, 51])));

const u32be = (value) => new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
const pngChunk = (type, data) => concat(u32be(data.length), new TextEncoder().encode(type), data, new Uint8Array(4));
const png = concat(
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', new Uint8Array(13)),
  pngChunk('eXIf', new Uint8Array([9, 8, 7])),
  pngChunk('tEXt', new TextEncoder().encode('Author\0Jane')),
  pngChunk('IDAT', new Uint8Array([1, 3, 3, 7])),
  pngChunk('IEND', new Uint8Array()),
);
assert.equal(tools.sniffFormat(png), 'png');
assert.deepEqual(tools.listMetadata(png), ['PNG eXIf chunk', 'PNG tEXt chunk']);
const cleanPng = tools.stripMetadata(png);
assert.deepEqual(tools.listMetadata(cleanPng.bytes), []);
assert.ok(Buffer.from(cleanPng.bytes).includes(Buffer.from([1, 3, 3, 7])));

const u32le = (value) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
const webpChunk = (type, data) => concat(new TextEncoder().encode(type), u32le(data.length), data, data.length % 2 ? new Uint8Array(1) : new Uint8Array());
const webpBody = concat(
  webpChunk('VP8X', new Uint8Array([0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
  webpChunk('EXIF', new Uint8Array([1, 2, 3, 4])),
  webpChunk('XMP ', new Uint8Array([5, 6, 7])),
  webpChunk('VP8 ', new Uint8Array([10, 20, 30, 40])),
);
const webp = concat(new TextEncoder().encode('RIFF'), u32le(webpBody.length + 4), new TextEncoder().encode('WEBP'), webpBody);
assert.equal(tools.sniffFormat(webp), 'webp');
assert.deepEqual(tools.listMetadata(webp), ['WebP EXIF chunk', 'WebP XMP chunk']);
const cleanWebp = tools.stripMetadata(webp);
assert.deepEqual(tools.listMetadata(cleanWebp.bytes), []);
assert.equal(cleanWebp.bytes[20], 0);
assert.ok(Buffer.from(cleanWebp.bytes).includes(Buffer.from([10, 20, 30, 40])));
assert.equal(new DataView(cleanWebp.bytes.buffer).getUint32(4, true) + 8, cleanWebp.bytes.length);

const heic = concat(new Uint8Array([0, 0, 0, 24]), new TextEncoder().encode('ftypheic'), new Uint8Array(12));
assert.equal(tools.sniffFormat(heic), 'heic');
assert.throws(() => tools.stripMetadata(heic), /HEIC cleaning is not supported/);

console.log('image-metadata-tools tests passed');
