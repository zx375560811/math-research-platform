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
    "COMMIT;";

#endif
