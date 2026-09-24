"""Collect instructor evidence from current official course links.

An undated/older course page is retained as a labelled reference, never silently
assigned to every section. Only an explicit current-term, single-section course
assignment can fill a missing section instructor automatically.
"""
import hashlib
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import requests
from bs4 import BeautifulSoup
from api.scraper import CankayaScraper

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.instructor-cache'
OFFERED_URL = 'https://www.cankaya.edu.tr/dersler/'
PROGRAM_URL = 'https://www.cankaya.edu.tr/ogrenci_isleri/kodprogramlar.php'
LABEL = re.compile(r'^(?:instructors?|lecturers?|course instructor|dersi veren(?: öğretim (?:üyesi|elemanı))?|öğretim (?:üyesi|elemanı))\s*[:：]?\s*(.*)$', re.I)


def normalize(code):
    return re.sub(r'\s+', '', code).upper().replace('İ', 'I')


def extract_instructor(html, code):
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup(['script', 'style', 'nav', 'footer']):
        tag.decompose()
    lines = [re.sub(r'\s+', ' ', s).strip() for s in soup.stripped_strings]
    text = '\n'.join(lines)
    if normalize(code) not in normalize(text):
        return None
    for index, line in enumerate(lines):
        match = LABEL.fullmatch(line)
        if not match:
            continue
        value = match[1].strip()
        if not value and index + 1 < len(lines):
            value = lines[index + 1]
        # Labels, email addresses, classrooms and full paragraphs are not names.
        if not value or len(value) > 140 or '@' in value or ':' in value or any(c.isdigit() for c in value):
            continue
        if not 2 <= len(value.split()) <= 16 or re.search(r'office|hours|syllabus|e-mail|lecture|belirsiz|to be|tba', value, re.I):
            continue
        modified = re.search(r'Last Modified\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})', text, re.I)
        terms = re.findall(r'(?:20\d{2}\s*[-/]\s*(?:20)?\d{2}[^\n]{0,40}\b(?:Fall|Spring|Güz|Bahar)\b|\b(?:Fall|Spring|Güz|Bahar)\b[^\n]{0,40}20\d{2}(?:\s*[-/]\s*(?:20)?\d{2})?)', text, re.I)
        return {'name': value.strip(' ,|&'), 'published_term': terms[0] if len(set(terms)) == 1 else None,
                'last_modified': modified[1] if modified else None}
    return None


def fetch_course(code, url):
    errors = []
    visited = set()
    queue = [url]
    with requests.Session() as session:
        session.headers['User-Agent'] = 'Mozilla/5.0'
        while queue and len(visited) < 2:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            try:
                response = session.get(current, timeout=(5, 8))
                response.raise_for_status()
                if not urlsplit(response.url).hostname.endswith('.cankaya.edu.tr'):
                    raise ValueError('Redirected outside official university domain')
                if 'html' not in response.headers.get('Content-Type', '').lower():
                    continue
                try:
                    html = response.content.decode('utf-8')
                except UnicodeDecodeError:
                    html = str(BeautifulSoup(response.content, 'html.parser'))
                (CACHE / (hashlib.sha256(current.encode()).hexdigest() + '.html')).write_text(html, encoding='utf-8')
                result = extract_instructor(html, code)
                if result:
                    result.update({'source': response.url, 'fetched_at': datetime.now(timezone.utc).isoformat()})
                    return code, result, errors
                soup = BeautifulSoup(html, 'html.parser')
                for link in soup.find_all('a', href=True):
                    if re.search(r'syllabus|ders izlencesi|course information', link.get_text(' ', strip=True), re.I):
                        target = urljoin(response.url, link['href'])
                        if urlsplit(target).hostname == urlsplit(response.url).hostname:
                            queue.append(target)
                            break
            except (requests.RequestException, ValueError) as exc:
                errors.append({'source': current, 'error': str(exc)})
    return code, None, errors


def fetch_program(dept, year):
    response = requests.post(PROGRAM_URL, data={'derskod': dept, 'dersno': str(year), 'finalsubmit': 'FINAL SUBMIT', 'sonfinal': '$thestates'}, timeout=(5, 20))
    response.raise_for_status()
    html = response.content.decode('utf-8')
    (CACHE / f'program_{dept}_{year}.html').write_text(html, encoding='utf-8')
    return CankayaScraper().parse_schedule_table(html, dept, year)


def match_program_instructors(courses):
    """Match full day/time sets and section numbers against the offered timetable."""
    from collections import defaultdict
    requests_needed = set()
    for code, course in courses.items():
        match = re.fullmatch(r'([^\d]+)(\d)\d+', code)
        if match and 1 <= int(match[2]) <= 6 and course['sections']:
            requests_needed.add((match[1], int(match[2])))
    entries, errors = [], []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_program, dept, year): (dept, year) for dept, year in requests_needed}
        for future in as_completed(futures):
            try:
                entries.extend(future.result())
            except (requests.RequestException, ValueError) as exc:
                errors.append({'program': futures[future], 'error': str(exc)})
    grouped = defaultdict(list)
    for entry in entries:
        grouped[(normalize(entry['course_code']), str(entry['section']))].append(entry)
    matched = {}
    for code, course in courses.items():
        for section_no, section in course['sections'].items():
            rows = grouped.get((normalize(code), str(section_no)), [])
            current_slots = {(s['day'], s['time_slot']) for s in section['slots']}
            candidate_slots = {(s['day'], s['time_slot']) for s in rows}
            names = {r['instructor'].strip() for r in rows if r['instructor'].strip() not in {'', 'Belirsiz'}}
            if current_slots and current_slots == candidate_slots and len(names) == 1:
                matched.setdefault(normalize(code), {})[str(section_no)] = {
                    'name': next(iter(names)), 'source': PROGRAM_URL,
                    'source_params': {'derskod': course['dept_code'], 'dersno': str(re.search(r'\d', code)[0])},
                    'verification': 'course_section_and_all_slots_match',
                    'fetched_at': datetime.now(timezone.utc).isoformat()}
    return matched, errors


def apply_department_overrides(report, schedule):
    """Use a faculty timetable only while its term, section and slots still match."""
    path = ROOT / 'department_instructor_overrides.json'
    if not path.exists():
        return
    overrides = json.loads(path.read_text(encoding='utf-8'))
    for code, sections in overrides.items():
        course = schedule['courses'].get(code)
        if not course:
            continue
        for number, record in sections.items():
            section = course['sections'].get(number)
            if not section or record['term'] not in schedule.get('term', ''):
                continue
            current_slots = {f"{slot['day']} {slot['time_slot']}" for slot in section['slots']}
            if current_slots != set(record['slots']):
                continue
            if not all(record['room'] in slot.get('classroom', '') for slot in section['slots']):
                continue
            report['sections'].setdefault(normalize(code), {})[number] = {
                'name': record['name'], 'source': record['source'], 'page': record['page'],
                'verification': 'current_term_department_timetable_course_section_room_and_slots_match',
                'fetched_at': datetime.now(timezone.utc).isoformat(),
            }


def main():
    CACHE.mkdir(exist_ok=True)
    if '--programs-only' in sys.argv:
        report = json.loads((ROOT / 'api/cankaya_instructors.json').read_text(encoding='utf-8'))
        schedule = json.loads((ROOT / 'api/cankaya_courses.json').read_text(encoding='utf-8'))
        report['sections'], report['program_errors'] = match_program_instructors(schedule['courses'])
        report['schedule_fetched_at'] = schedule.get('fetched_at')
        report['fetched_at'] = datetime.now(timezone.utc).isoformat()
        apply_department_overrides(report, schedule)
        save_report(report)
        return
    response = requests.get(OFFERED_URL, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.content, 'html.parser')
    table = soup.find('table', id='CoursesTable')
    if table is None:
        raise ValueError('Official offered-course table missing')
    links = {}
    for row in table.find_all('tr'):
        cells = row.find_all('td', recursive=False)
        if len(cells) != 7:
            continue
        code = normalize(cells[0].get_text())
        link = cells[6].find('a', href=True)
        if link:
            url = urljoin(OFFERED_URL, link['href'].strip()).replace('http://', 'https://', 1)
            host = urlsplit(url).hostname or ''
            if host.endswith('.cankaya.edu.tr'):
                links[code] = url
    report = {'source': OFFERED_URL, 'fetched_at': datetime.now(timezone.utc).isoformat(),
              'courses_checked': len(links), 'records': {}, 'errors': {}, 'missing': []}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(fetch_course, code, url) for code, url in links.items()]
        for index, future in enumerate(as_completed(futures), 1):
            code, record, errors = future.result()
            if record:
                report['records'][code] = record
            else:
                report['missing'].append(code)
            if errors:
                report['errors'][code] = errors
            if index % 50 == 0 or index == len(links):
                print(f"{index}/{len(links)} checked; {len(report['records'])} instructor references", flush=True)
                (CACHE / 'progress.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    report['records'] = dict(sorted(report['records'].items()))
    report['missing'].sort()
    schedule = json.loads((ROOT / 'api/cankaya_courses.json').read_text(encoding='utf-8'))
    report['sections'], report['program_errors'] = match_program_instructors(schedule['courses'])
    report['schedule_fetched_at'] = schedule.get('fetched_at')
    apply_department_overrides(report, schedule)
    save_report(report)


def save_report(report):
    print(f"Matched {sum(len(s) for s in report['sections'].values())} section instructors to the offered timetable.", flush=True)
    path = ROOT / 'api/cankaya_instructors.json'
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)
    print(f"Saved {len(report['records'])} dated/undated references; section assignments unchanged.", flush=True)


if __name__ == '__main__':
    main()
