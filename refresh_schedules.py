"""Refresh the shipped schedule cache from the official offered-course list."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from api.data_manager import Course
from api.scraper import CankayaScraper


def build_cache(scraper, entries):
    courses = {c['code']: Course(c['code'], c['dept_code']) for c in scraper.offered_courses}
    for entry in entries:
        course = courses[entry['course_code']]
        section = course.get_or_create_section(entry['section'], entry['instructor'], entry['classroom'])
        section.add_slot(entry['day'], entry['time_slot'], entry['classroom'])
    if not courses or not entries:
        raise ValueError('Boş ders verileri mevcut önbelleğin yerine yazılamaz.')
    return {
        'source': scraper.COURSES_URL,
        'term': scraper.term,
        'fetched_at': datetime.now(timezone.utc).isoformat(),
        'departments': sorted({c.dept_code for c in courses.values()}),
        'courses': {code: c.to_dict() for code, c in courses.items()},
    }


def main():
    scraper = CankayaScraper()

    def progress(current, total, message):
        if current == 1 or current % 25 == 0 or current == total:
            print(f'{current}/{total}: {message}', flush=True)

    entries = scraper.fetch_all_schedules(progress_callback=progress)
    data = build_cache(scraper, entries)
    root = Path(__file__).resolve().parent
    payload = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    # Fetch and validate the complete dataset before touching the cache.
    path = root / 'api' / 'cankaya_courses.json'
    temp = path.with_suffix('.json.tmp')
    temp.write_text(payload, encoding='utf-8')
    os.replace(temp, path)
    empty = sum(not c['sections'] for c in data['courses'].values())
    print(f"Saved {len(data['courses'])} courses, {len(entries)} slots; {empty} courses without scheduled sections.")


if __name__ == '__main__':
    main()
