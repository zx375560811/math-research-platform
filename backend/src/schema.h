#ifndef MATH_SCHEMA_H
#define MATH_SCHEMA_H

static const char *const schema_sql =
    "PRAGMA foreign_keys=ON;"
    "BEGIN;"
    "CREATE TABLE IF NOT EXISTS subjects ("
    "id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);"
    "INSERT OR IGNORE INTO subjects(id,slug,name) VALUES"
    "(1,'algebra','代数'),"
    "(2,'number-theory','数论'),"
    "(3,'analysis','分析'),"
    "(4,'geometry-topology','几何与拓扑'),"
    "(5,'other','其他数学方向');"
    "CREATE TABLE IF NOT EXISTS documents ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, authors TEXT NOT NULL DEFAULT '',"
    "file_path TEXT NOT NULL UNIQUE, file_size INTEGER NOT NULL CHECK(file_size > 0),"
    "created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));"
    "CREATE TABLE IF NOT EXISTS document_subjects ("
    "document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,"
    "subject_id INTEGER NOT NULL REFERENCES subjects(id),"
    "PRIMARY KEY(document_id,subject_id));"
    "CREATE INDEX IF NOT EXISTS idx_document_subjects_subject "
    "ON document_subjects(subject_id,document_id);"
    "COMMIT;";

#endif
