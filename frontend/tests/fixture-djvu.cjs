'use strict';
// Generated blank pages with an original OCR layer: no third-party book content.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function chunk(id, data) { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); return Buffer.concat([Buffer.from(id), length, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]); }
function fixtureDjvu(rotation = 0) {
  const info = Buffer.alloc(10); info.writeUInt16BE(600); info.writeUInt16BE(800, 2); info[4] = 24; info.writeUInt16LE(300, 6); info[8] = 22; info[9] = { 0: 1, 90: 5, 180: 2, 270: 6 }[rotation];
  const text = Buffer.from('Native DjVu mathematics');
  const header = Buffer.alloc(3); header.writeUIntBE(text.length, 0, 3);
  // One text zone at x=60, y=700, width=350, height=24 (bottom-left origin).
  const zone = Buffer.alloc(19); zone[0] = 6;
  [60, 700, 350, 24, 0].forEach((n, i) => zone.writeUInt16BE(n + 0x8000, 1 + i * 2)); zone.writeUIntBE(text.length, 11, 3);
  const body = Buffer.concat([Buffer.from('DJVU'), chunk('INFO', info), chunk('TXTa', Buffer.concat([header, text, Buffer.from([1]), zone]))]);
  return Buffer.concat([Buffer.from('AT&T'), chunk('FORM', body)]);
}
function fixtureDjvuBundle(count = 3) {
  const context = vm.createContext({ self: { document: {} }, TextDecoder, TextEncoder, console, performance });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../vendor/djvu/djvu.js'), 'utf8'), context);
  const DjVu = context.DjVu;
  const document = buffer => new DjVu.Document(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length));
  let doc = document(fixtureDjvu());
  for (let i = 1; i < count; i++) doc = DjVu.Document.concat(doc, document(fixtureDjvu()));
  return Buffer.from(doc.buffer);
}
module.exports = { fixtureDjvu, fixtureDjvuBundle };
