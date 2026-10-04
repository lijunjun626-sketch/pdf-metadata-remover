(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ImageMetadataTools = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'caBX']);
  const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'XMP ', 'C2PA']);

  const ascii = (bytes, start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
  const readU32BE = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
  const readU32LE = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
  const writeU32LE = (bytes, offset, value) => new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true);

  function sniffFormat(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
    if (bytes.length >= 8 && PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return 'png';
    if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
    if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(ascii(bytes, 8, 4))) return 'heic';
    return 'unknown';
  }

  function jpegSegments(bytes) {
    const segments = [];
    if (sniffFormat(bytes) !== 'jpeg') throw new Error('This file is not a valid JPEG image.');
    let offset = 2;
    while (offset + 1 < bytes.length) {
      if (bytes[offset] !== 0xff) throw new Error('The JPEG marker table is malformed.');
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd9) break;
      if (marker === 0xda) {
        if (offset + 2 > bytes.length) throw new Error('The JPEG scan header is truncated.');
        const length = (bytes[offset] << 8) | bytes[offset + 1];
        segments.push({ marker, start: offset - 2, end: bytes.length, label: 'Image data', removable: false });
        if (length < 2 || offset - 2 + 2 + length > bytes.length) throw new Error('The JPEG scan header is invalid.');
        break;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) throw new Error('The JPEG segment is truncated.');
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      const start = offset - 2;
      const end = start + 2 + length;
      if (length < 2 || end > bytes.length) throw new Error('The JPEG segment length is invalid.');
      let label = '';
      let removable = false;
      if (marker === 0xe1) {
        const signature = ascii(bytes, offset + 2, Math.min(32, length - 2));
        label = signature.startsWith('Exif\0\0') ? 'EXIF and GPS' : signature.includes('xmp') ? 'XMP' : 'APP1 metadata';
        removable = true;
      } else if (marker === 0xeb) {
        label = 'JUMBF / Content Credentials';
        removable = true;
      } else if (marker === 0xed) {
        label = 'IPTC / Photoshop metadata';
        removable = true;
      } else if (marker === 0xfe) {
        label = 'JPEG comment';
        removable = true;
      }
      segments.push({ marker, start, end, label, removable });
      offset = end;
    }
    return segments;
  }

  function listJpegMetadata(bytes) {
    return jpegSegments(bytes).filter((segment) => segment.removable).map((segment) => segment.label);
  }

  function stripJpeg(bytes) {
    const segments = jpegSegments(bytes);
    const removable = segments.filter((segment) => segment.removable);
    if (!removable.length) return { bytes: bytes.slice(), removed: [] };
    const parts = [bytes.subarray(0, 2)];
    let cursor = 2;
    for (const segment of segments) {
      if (segment.start < cursor) continue;
      if (segment.removable) {
        if (cursor < segment.start) parts.push(bytes.subarray(cursor, segment.start));
        cursor = segment.end;
      }
    }
    if (cursor < bytes.length) parts.push(bytes.subarray(cursor));
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return { bytes: output, removed: removable.map((segment) => segment.label) };
  }

  function pngChunks(bytes) {
    if (sniffFormat(bytes) !== 'png') throw new Error('This file is not a valid PNG image.');
    const chunks = [];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = readU32BE(bytes, offset);
      const type = ascii(bytes, offset + 4, 4);
      const end = offset + 12 + length;
      if (end > bytes.length) throw new Error('The PNG chunk table is truncated.');
      chunks.push({ type, start: offset, end, removable: PNG_METADATA_CHUNKS.has(type) });
      offset = end;
      if (type === 'IEND') break;
    }
    return chunks;
  }

  function listPngMetadata(bytes) {
    return pngChunks(bytes).filter((chunk) => chunk.removable).map((chunk) => `PNG ${chunk.type} chunk`);
  }

  function stripPng(bytes) {
    const chunks = pngChunks(bytes);
    const kept = chunks.filter((chunk) => !chunk.removable);
    const removed = chunks.filter((chunk) => chunk.removable).map((chunk) => `PNG ${chunk.type} chunk`);
    const size = 8 + kept.reduce((sum, chunk) => sum + chunk.end - chunk.start, 0);
    const output = new Uint8Array(size);
    output.set(bytes.subarray(0, 8), 0);
    let offset = 8;
    for (const chunk of kept) {
      const part = bytes.subarray(chunk.start, chunk.end);
      output.set(part, offset);
      offset += part.length;
    }
    return { bytes: output, removed };
  }

  function webpChunks(bytes) {
    if (sniffFormat(bytes) !== 'webp') throw new Error('This file is not a valid WebP image.');
    const declaredSize = readU32LE(bytes, 4) + 8;
    if (declaredSize > bytes.length) throw new Error('The WebP RIFF container is truncated.');
    const chunks = [];
    let offset = 12;
    while (offset + 8 <= declaredSize) {
      const type = ascii(bytes, offset, 4);
      const length = readU32LE(bytes, offset + 4);
      const end = offset + 8 + length + (length % 2);
      if (end > declaredSize) throw new Error('The WebP chunk table is truncated.');
      chunks.push({ type, start: offset, end, dataStart: offset + 8, length, removable: WEBP_METADATA_CHUNKS.has(type) });
      offset = end;
    }
    return chunks;
  }

  function listWebpMetadata(bytes) {
    return webpChunks(bytes).filter((chunk) => chunk.removable).map((chunk) => `WebP ${chunk.type.trim()} chunk`);
  }

  function stripWebp(bytes) {
    const chunks = webpChunks(bytes);
    const kept = chunks.filter((chunk) => !chunk.removable);
    const removed = chunks.filter((chunk) => chunk.removable).map((chunk) => `WebP ${chunk.type.trim()} chunk`);
    const size = 12 + kept.reduce((sum, chunk) => sum + chunk.end - chunk.start, 0);
    const output = new Uint8Array(size);
    output.set(bytes.subarray(0, 12), 0);
    writeU32LE(output, 4, size - 8);
    let offset = 12;
    for (const chunk of kept) {
      const part = bytes.subarray(chunk.start, chunk.end);
      output.set(part, offset);
      if (chunk.type === 'VP8X' && chunk.length >= 1) output[offset + 8] &= 0xf3;
      offset += part.length;
    }
    return { bytes: output, removed };
  }

  function listMetadata(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const format = sniffFormat(bytes);
    if (format === 'jpeg') return listJpegMetadata(bytes);
    if (format === 'png') return listPngMetadata(bytes);
    if (format === 'webp') return listWebpMetadata(bytes);
    if (format === 'heic') throw new Error('HEIC inspection is available, but lossless HEIC cleaning is not supported yet.');
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }

  function stripMetadata(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const format = sniffFormat(bytes);
    if (format === 'jpeg') return { format, ...stripJpeg(bytes) };
    if (format === 'png') return { format, ...stripPng(bytes) };
    if (format === 'webp') return { format, ...stripWebp(bytes) };
    if (format === 'heic') throw new Error('HEIC cleaning is not supported yet because browser-safe, lossless rewriting is not consistent across devices.');
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }

  return { sniffFormat, listMetadata, stripMetadata };
}));
