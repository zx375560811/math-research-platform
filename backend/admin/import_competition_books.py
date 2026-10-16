"""Import local competition textbooks into the three shared foundation courses.

Run from backend with math-platform stopped. Default: preview only.
--apply imports and links; --apply --move removes uploaded sources after commit
and avoids allocating another copy on the same filesystem. Local originals stay.
"""
import argparse
import json
import os
from pathlib import Path
import re
import sqlite3

from import_ai_books import preview as preview_courses
from import_series import apply as import_files

COURSES = {'analysis':'数学分析', 'algebra':'高等代数', 'geometry':'解析几何'}
ALIASES = {'数学分析':'analysis','数分':'analysis','analysis':'analysis',
           '高等代数':'algebra','高代':'algebra','线性代数':'algebra','algebra':'algebra',
           '解析几何':'geometry','解几':'geometry','geometry':'geometry'}


def classify(relative):
    name = re.sub(r'\s+', '', relative.stem).lower()
    # A combined textbook is one document referenced by both courses.
    if '高等代数' in name and '解析几何' in name:
        return ['algebra','geometry']
    for text, slug in [('数学分析','analysis'),('高等代数','algebra'),('线性代数','algebra'),('解析几何','geometry')]:
        if text in name:
            return [slug]
    for part in reversed(relative.parts[:-1]):
        slug = ALIASES.get(re.sub(r'\s+', '', part).lower())
        if slug:
            return [slug]
    raise ValueError('Cannot assign textbook; use a course name in its filename or folder: ' + str(relative))


def preview(source):
    return preview_courses(source, course_names=COURSES, classifier=classify, library_root='数学竞赛教材')


def apply(plan, database='data/math.db', move=False):
    return import_files(plan, database, move, course_import=True, course_namespace='competition')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('--database', default=os.getenv('MATH_DB_PATH') or 'data/math.db')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--move', action='store_true')
    args = parser.parse_args()
    if args.move and not args.apply:
        parser.error('--move requires --apply')
    try:
        print('Scanning competition textbooks and checking file hashes...', flush=True)
        plan = preview(args.directory)
        print(json.dumps(plan['summary'], ensure_ascii=False, indent=2), flush=True)
        if args.apply:
            print(json.dumps(apply(plan, args.database, args.move), ensure_ascii=False, indent=2), flush=True)
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, 'Competition textbook import failed: {}\n'.format(error))
