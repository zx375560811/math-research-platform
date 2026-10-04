PRAGMA foreign_keys=ON;
BEGIN;
CREATE TABLE IF NOT EXISTS subjects (
id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
INSERT OR IGNORE INTO subjects(id,slug,name) VALUES
(1,'algebra','代数'),
(2,'number-theory','数论'),
(3,'analysis','分析'),
(4,'geometry-topology','几何与拓扑'),
(5,'other','其他数学方向');
CREATE TABLE IF NOT EXISTS documents (
id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, authors TEXT NOT NULL DEFAULT '',
file_path TEXT NOT NULL UNIQUE, file_size INTEGER NOT NULL CHECK(file_size > 0),
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS document_subjects (
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
subject_id INTEGER NOT NULL REFERENCES subjects(id),
PRIMARY KEY(document_id,subject_id));
CREATE INDEX IF NOT EXISTS idx_document_subjects_subject 
ON document_subjects(subject_id,document_id);
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
role TEXT NOT NULL DEFAULT 'USER' CHECK(role='USER'),
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS invitations (
code_hash TEXT PRIMARY KEY,
expires_at INTEGER,
used_at TEXT,
used_by TEXT REFERENCES users(username) ON DELETE SET NULL,
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS account_migrations (
name TEXT PRIMARY KEY,
applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS administrators (
username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS invitation_revocations (
code_hash TEXT PRIMARY KEY REFERENCES invitations(code_hash) ON DELETE CASCADE,
revoked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE TABLE IF NOT EXISTS learning_directions (
slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS learning_questions (
direction TEXT NOT NULL REFERENCES learning_directions(slug), position INTEGER NOT NULL, question TEXT NOT NULL, PRIMARY KEY(direction,position));
CREATE TABLE IF NOT EXISTS learning_direction_introductions (
direction TEXT PRIMARY KEY REFERENCES learning_directions(slug) ON DELETE CASCADE,
research_object TEXT NOT NULL, core_content TEXT NOT NULL, prerequisites TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS learning_books (
id INTEGER PRIMARY KEY, direction TEXT NOT NULL REFERENCES learning_directions(slug), title TEXT NOT NULL, authors TEXT NOT NULL,
stage TEXT NOT NULL, prerequisites TEXT NOT NULL, sort_order INTEGER NOT NULL, source_url TEXT NOT NULL,
document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS learning_progress (
username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE, book_id INTEGER NOT NULL REFERENCES learning_books(id),
page INTEGER NOT NULL CHECK(page>0), total_pages INTEGER NOT NULL CHECK(total_pages>=page),
position REAL NOT NULL DEFAULT 0, zoom REAL NOT NULL DEFAULT 1,
updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), PRIMARY KEY(username,book_id));
CREATE TABLE IF NOT EXISTS learning_marks (
id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
book_id INTEGER NOT NULL REFERENCES learning_books(id), page INTEGER NOT NULL CHECK(page>0),
quote TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', color TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE INDEX IF NOT EXISTS idx_learning_marks_owner ON learning_marks(username,book_id);
CREATE TABLE IF NOT EXISTS learning_mark_rects (
mark_id INTEGER NOT NULL REFERENCES learning_marks(id) ON DELETE CASCADE, position INTEGER NOT NULL,
x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL, height REAL NOT NULL, PRIMARY KEY(mark_id,position));
CREATE TABLE IF NOT EXISTS document_catalog (
document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
module TEXT NOT NULL DEFAULT 'mathematics', language TEXT NOT NULL DEFAULT 'und' CHECK(language IN ('zh','en','und')));
CREATE TABLE IF NOT EXISTS document_directions (
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
direction TEXT NOT NULL REFERENCES learning_directions(slug), PRIMARY KEY(document_id,direction));
CREATE TABLE IF NOT EXISTS learning_book_details (
book_id INTEGER PRIMARY KEY REFERENCES learning_books(id) ON DELETE CASCADE,
language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('zh','en')));
CREATE TABLE IF NOT EXISTS document_progress (
username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
page INTEGER NOT NULL CHECK(page>0), total_pages INTEGER NOT NULL CHECK(total_pages>=page),
position REAL NOT NULL DEFAULT 0, zoom REAL NOT NULL DEFAULT 1,
updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), PRIMARY KEY(username,document_id));
CREATE TABLE IF NOT EXISTS document_marks (
id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, page INTEGER NOT NULL CHECK(page>0),
quote TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', color TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
CREATE INDEX IF NOT EXISTS idx_document_marks_owner ON document_marks(username,document_id);
CREATE TABLE IF NOT EXISTS document_mark_rects (
mark_id INTEGER NOT NULL REFERENCES document_marks(id) ON DELETE CASCADE, position INTEGER NOT NULL,
x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL, height REAL NOT NULL, PRIMARY KEY(mark_id,position));
CREATE TABLE IF NOT EXISTS learning_selections (
username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
book_id INTEGER NOT NULL REFERENCES learning_books(id) ON DELETE CASCADE,
document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
PRIMARY KEY(username,book_id));
COMMIT;

CREATE TABLE IF NOT EXISTS ai_provider_settings (
    owner TEXT PRIMARY KEY,
    username TEXT REFERENCES users(username) ON DELETE CASCADE,
    base_url TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 50,
    CHECK ((owner='default' AND username IS NULL) OR owner='user:' || username)
);
CREATE TABLE IF NOT EXISTS ai_preferences (
    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('default','custom'))
);
CREATE TABLE IF NOT EXISTS ai_usage (
    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    day TEXT NOT NULL,
    daily_count INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    minute_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS document_formats (document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE, format TEXT NOT NULL CHECK(format IN ('pdf','djvu')));

CREATE TABLE IF NOT EXISTS library_collections (
 id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, path_key TEXT NOT NULL,
 parent_id INTEGER REFERENCES library_collections(id) ON DELETE CASCADE,
 name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(source,path_key)
);
CREATE TABLE IF NOT EXISTS document_collections (
 document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 collection_id INTEGER NOT NULL REFERENCES library_collections(id) ON DELETE CASCADE,
 PRIMARY KEY(document_id,collection_id)
);
CREATE INDEX IF NOT EXISTS document_collection_lookup ON document_collections(collection_id,document_id);
CREATE INDEX IF NOT EXISTS collection_parent_lookup ON library_collections(parent_id);

CREATE TABLE IF NOT EXISTS library_file_cleanup (path TEXT PRIMARY KEY);
