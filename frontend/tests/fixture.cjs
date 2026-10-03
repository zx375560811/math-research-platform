'use strict';
// A valid two-page PDF with selectable text and an outline, generated for tests.
function fixturePdf(count = 2) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Outlines 9 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '', '', '<< >>',
    '<< /Type /Outlines /First 10 0 R /Last 11 0 R /Count 2 >>',
    '<< /Title (Chapter One) /Parent 9 0 R /Dest [3 0 R /Fit] /Next 11 0 R >>',
    '<< /Title (Chapter Two) /Parent 9 0 R /Dest [4 0 R /Fit] /Prev 10 0 R >>',
  ];
  for (let i = 0; i < 2; i++) {
    const content = `BT /F1 24 Tf 50 700 Td (Mathematics ${i + 1}) Tj 0 -45 Td /F1 16 Tf (Read, understand, and prove.) Tj ET`;
    objects[5 + i] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  }
  const kids = [3,4];
  for (let number = 3; number <= count; number++) {
    const pageId = objects.length + 1;
    kids.push(pageId);
    const [width,height] = number % 5 === 0 ? [792,612] : [612,792];
    const content = `BT /F1 24 Tf 50 ${height-92} Td (Mathematics ${number}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R >> >> /Contents ${pageId+1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map(id=>`${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let result = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(result); result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { result += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(result);
}
module.exports = { fixturePdf };
