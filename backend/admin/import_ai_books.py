"""Append PDF/DJVU textbooks and associate them with the math-to-AI courses.

Run from backend. Default: preview only. --apply imports, --apply --move avoids
a second copy on the same filesystem and removes uploaded sources after commit.
Existing documents, recommendations, progress and notes are preserved.
"""
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import re
import sqlite3

from document_format import detect
from import_document import metadata
from import_series import apply as import_files, identity
from replace_library import clean_title, digest, inside

COURSES = {
    'calculus': '数学分析重点', 'linear-algebra': '高等代数重点', 'probability': '概率与统计',
    'python': 'Python与NumPy', 'machine-learning': '机器学习',
    'deep-learning': '深度学习', 'pytorch': 'PyTorch实践', 'nlp': '自然语言处理',
    'transformer': 'Transformer', 'llm': 'LLM',
}
ALIASES = {re.sub(r'\s+', '', name).lower(): slug for slug, name in COURSES.items()}
ALIASES.update({slug: slug for slug in COURSES})
ALIASES.update({'数学分析':'calculus', '高等代数':'linear-algebra', '线性代数':'linear-algebra', '概率统计':'probability', 'python':'python'})
RULES = [
    (r'动手学深度学习|Dive\s+into\s+Deep\s+Learning', ['deep-learning', 'pytorch']),
    (r'Hands[\s-]*On\s+Large\s+Language\s+Models', ['transformer', 'llm']),
    (r'Natural\s+Language\s+Processing\s+with\s+Transformers', ['transformer']),
    (r'Natural\s+Language\s+Processing\s+in\s+Action|Speech\s+and\s+Language\s+Processing|自然语言处理', ['nlp']),
    (r'Build\s+a\s+Large\s+Language\s+Model|从零.*大语言模型', ['llm']),
    (r'深度学习入门|神经网络与深度学习|Understanding\s+Deep\s+Learning', ['deep-learning']),
    (r'Deep\s+Learning\s+with\s+PyTorch|PyTorch', ['pytorch']),
    (r'概率论与数理统计|概率统计|Introduction\s+to\s+Probability', ['probability']),
    (r'线性代数|高等代数|Linear\s+Algebra', ['linear-algebra']),
    (r'数学分析|微积分|Calculus', ['calculus']),
    (r'Python编程|Python\s+Crash\s+Course|利用Python进行数据分析|Python\s+for\s+Data\s+Analysis', ['python']),
    (r'机器学习|Machine\s+Learning|Statistical\s+Learning', ['machine-learning']),
]


def classify(relative):
    # Explicit course folders take priority; flat folders use recognizable titles.
    for name in relative.parts[:-1]:
        slug = ALIASES.get(re.sub(r'\s+', '', name).lower())
        if slug:
            return [slug]
    for pattern, courses in RULES:
        if re.search(pattern, relative.stem, re.I):
            return list(courses)
    raise ValueError('Cannot assign book; place it in a named course folder: ' + str(relative))


def preview(source):
    root = Path(source).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('Source must be a directory')
    rows, folders, skipped = [], set(), 0
    for path in sorted(root.rglob('*')):
        if path.is_symlink() or not inside(path, root):
            raise ValueError('Symlink or path outside source: ' + str(path))
        if not path.is_file():
            continue
        if path.suffix.lower() not in ('.pdf', '.djvu', '.djv'):
            skipped += 1
            continue
        relative = path.relative_to(root)
        courses = classify(relative)
        before = identity(path)
        with path.open('rb') as stream:
            kind = detect(stream.read(16))
        title = clean_title(path.stem)
        metadata(title, True)
        checksum = digest(path)
        if identity(path) != before or before[2] <= 0:
            raise ValueError('Empty or changed source: ' + str(relative))
        locations = [('人工智能', COURSES[slug]) for slug in courses]
        folders.add(('人工智能',))
        folders.update(locations)
        rows.append({'path':relative.as_posix(), 'folders':locations[0], 'collection_paths':locations,
                     'courses':courses, 'title':title, 'format':kind, 'size':before[2],
                     'sha256':checksum, 'identity':before})
    if not rows:
        raise ValueError('No valid PDF or DJVU files found')
    return {'source':str(root), 'documents':rows, 'folders':sorted(folders, key=lambda p:(len(p),p)),
            'summary':{'files':len(rows), 'unique_files':len({r['sha256'] for r in rows}),
                       'courses':dict(Counter(COURSES[c] for r in rows for c in r['courses'])),
                       'skipped':skipped,
                       'assignments':[{'title':r['title'], 'courses':[COURSES[c] for c in r['courses']]} for r in rows]}}


def apply(plan, database='data/math.db', move=False):
    return import_files(plan, database, move, course_import=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('--database', default=os.getenv('MATH_DB_PATH') or 'data/math.db')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--move', action='store_true')
    args = parser.parse_args()
    if args.move and not args.apply:
        parser.error('--move requires --apply')
    try:
        print('Scanning books and verifying file hashes...', flush=True)
        plan = preview(args.directory)
        print(json.dumps(plan['summary'], ensure_ascii=False, indent=2), flush=True)
        if args.apply:
            print(json.dumps(apply(plan, args.database, args.move), ensure_ascii=False, indent=2))
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, 'AI textbook import failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
