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
CREATE TABLE IF NOT EXISTS learning_directions (
slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS learning_questions (
direction TEXT NOT NULL REFERENCES learning_directions(slug), position INTEGER NOT NULL, question TEXT NOT NULL, PRIMARY KEY(direction,position));
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
COMMIT;
