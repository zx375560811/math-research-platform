'use strict';

// Original test artwork: a black square on a white 32x32 image, encoded with
// Pillow as JPEG and JPEG 2000. No textbook pages or third-party images included.
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAgACABAREA/8QAFgABAQEAAAAAAAAAAAAAAAAABwAG/8QAKRAAAAIEDwEAAAAAAAAAAAAAABIHERMVAggUFxglMURGYWJmhKXD4//aAAgBAQAAPwDfpNSbNy66oeEva3lkQhNEJaz5WA/pNbR7L5CpNbR7L5BARkk2cZ6VQ75AyvLU5z6IKlEztB/Gawty/EAAg/xZcU8T2FGawty/EAAg/wAWXFPE9ggJNRlOM663d8ga3Zqc5NcFSiZ2g/oy7u636ioy7u636hARkjKbl6Vu8JeyuzIhD64S1nysH//Z', 'base64');
const jpx = Buffer.from('AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAAIAAAACAAAQcHAAAAAAAPY29scgEAAAAAABEAAAGranAyY/9P/1EAKQAAAAAAIAAAACAAAAAAAAAAAAAAACAAAAAgAAAAAAAAAAAAAQcBAf9SAAwAAAABAAUEBAAB/1wAE0BASEhQSEhQSEhQSEhQSEhQ/2QAJQABQ3JlYXRlZCBieSBPcGVuSlBFRyB2ZXJzaW9uIDIuNS40/5AACgAAAAABKgAB/5PB8gECz8AKfgBR+AEABr8GuwiHz8AafgDQ+0FADDTmLJgfDmAkv93lB6SJdg/fmI35iUfgICDpyDKnDd3trp53bmEXuA8JGdqcZMTUc/Bi8C/2kv8gSqebJLDB/ZFQVhKUu8yAvKdy98/Afn4DsPtEwAkHqiXC7btHg2GgSM8ktEwmShn6vpAWf+JSb+7b5G8dQOQ5ZhLOCopljTjACqO5Isr54NyU0vpPWecZRRKS22YkWOxwVyD5zEha2nSS4S/PwJZ+BJD7QoAZ6hDtEJQsbvlWYvzc9LMRhIKL4ZIXZsK5Xbnr5XvBC24/eIW2IN4NYztMRC7XSMxtkfR6C8apCr76M08hFV3Yg9B1SidnbpRPFfuhZtWd/r07/P/Z', 'base64');

function fixtureScannedPdf() {
  const objects = [], add = value => { objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value)); return objects.length; };
  const stream = (data, properties = '') => Buffer.concat([Buffer.from(`<< /Length ${data.length} ${properties} >>\nstream\n`), data, Buffer.from('\nendstream')]);
  add('<< /Type /Catalog /Pages 2 0 R >>'); add('');
  const jpegId = add(stream(jpeg, '/Type /XObject /Subtype /Image /Width 32 /Height 32 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode'));
  const jpxId = add(stream(jpx, '/Type /XObject /Subtype /Image /Width 32 /Height 32 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /JPXDecode'));
  const contentId = add(stream(Buffer.from('q 320 0 0 480 0 0 cm /Im0 Do Q'))), kids = [];
  for (let number = 1; number <= 6; number++) kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 480] /Resources << /XObject << /Im0 ${number === 1 ? jpegId : jpxId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map(id => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  // Make this large enough to exercise PDF.js' partial HTTP reads.
  add(stream(Buffer.alloc(1024 * 1024, 32)));
  const parts = [Buffer.from('%PDF-1.7\n')], offsets = [0]; let length = parts[0].length;
  objects.forEach((object, index) => { offsets.push(length); const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')]); parts.push(part); length += part.length; });
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(parts);
}
module.exports = { fixtureScannedPdf };
