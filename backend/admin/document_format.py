"""Recognize original PDF and DjVu files without converting or loading them."""
def detect(header):
    if header.startswith(b'%PDF-'):
        return 'pdf'
    if len(header) >= 16 and header[:8] == b'AT&TFORM' and header[12:16] in (b'DJVU', b'DJVM'):
        return 'djvu'
    raise ValueError('文件必须是有效的 PDF 或 DJVU')


def remember(db, document, kind):
    db.execute('CREATE TABLE IF NOT EXISTS document_formats (document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE, format TEXT NOT NULL CHECK(format IN (\'pdf\',\'djvu\')))')
    db.execute('INSERT OR REPLACE INTO document_formats VALUES(?,?)', (document, kind))
