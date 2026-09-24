"""Compile course identities and prerequisites from the latest official curricula.

Uses the resumable collector's evidence and cached, code-validated course responses.
Department prerequisite tables take precedence over the information package.
Run with --refresh-sources to fetch those tables again before compiling.
"""
import argparse
import hashlib
import io
import json
import re
import zipfile
from urllib.parse import urljoin, urlsplit, unquote
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'api'
CACHE = ROOT / '.prerequisite-cache'
SOURCES = {
    'OFFERED': 'https://www.cankaya.edu.tr/dersler/',
    'CENG': 'https://ceng.cankaya.edu.tr/tr/undergraduate-curriculum/',
    'EE': 'https://eee.cankaya.edu.tr/lisans-program-2021/',
    'MIS': 'https://mis.cankaya.edu.tr/lisans-egitim-programi/',
    'INTT': 'https://intt.cankaya.edu.tr/mufredat/',
    'IE': 'https://ie.cankaya.edu.tr/current/prerequisite/Prerequisite_2024-2025.pdf',
    'MATH': 'https://math.cankaya.edu.tr/ogretim-programi/lisans/matematik/lisans-mufredati-2020/',
}
DISCOVERY = {
    'CE_DIAGRAM': ('https://ce.cankaya.edu.tr/', r'onkosul|önkosul|prerequisite', r'sec?meli|elective'),
    'CE_ELECTIVES': ('https://ce.cankaya.edu.tr/', r'(onkosul|önkosul|prerequisite).*(secmeli|seçmeli|elective)|(secmeli|seçmeli|elective).*(onkosul|önkosul|prerequisite)', None),
    'PSY': ('https://psy.cankaya.edu.tr/', r'onkosul|önkosul|prerequisite', None),
}
ALIASES = {'HİR': 'HIR', 'PRAD': 'HIR', 'BF': 'BAF', 'LAW': 'HUK', 'TRAN': 'TINS', 'PSIR': 'PSI', 'ING': 'ENG'}
CODE = r'[A-Z]{2,5}\d{3}'


def normalize(value):
    return re.sub(r'\s+', '', str(value or '')).upper().replace('İ', 'I')


def parse_requirement(raw, code=''):
    """Never turn missing data or an unparsed condition into 'no prerequisites'."""
    if raw is None or not str(raw).strip():
        return {'type': 'UNKNOWN', 'courses': [], 'reason': 'Resmî kayıtta ön koşul alanı boş.'}
    value = str(raw).strip()
    if value.casefold() in {'yok', 'none', '-', '–', '—', 'ön koşul yok', 'no prerequisites'}:
        return {'type': 'AND', 'courses': []}
    pieces = [normalize(p) for p in re.split(r'\s*(?:&&|;|,|\bve\b|\band\b)\s*', value, flags=re.I) if p.strip()]
    if not pieces or any(not re.fullmatch(CODE, p) for p in pieces) or code in pieces:
        return {'type': 'UNKNOWN', 'courses': [], 'reason': f'Ön koşulun elle kontrolü gerekiyor: {value}'}
    # These historical MATH codes identify alternatives, not two distinct courses.
    # Preserve the ambiguity until a department table specifies the requirement.
    if len(pieces) > 1 and set(pieces) in ({'MATH155', 'MATH157'}, {'MATH156', 'MATH158'}, {'MATH151', 'MATH153'}):
        return {'type': 'OR', 'courses': list(dict.fromkeys(pieces))}
    return {'type': 'AND', 'courses': list(dict.fromkeys(pieces))}


def latest_records(program):
    records = program.get('records', [])
    years = [int(r['year']) for r in records if str(r.get('year', '')).isdigit()]
    if not years:
        return []
    latest = max(years)
    return [r for r in records if str(r.get('year')) == str(latest)]


def rule_from_record(record, fetched_at):
    rule = parse_requirement(record.get('raw'), record['code'])
    rule.update({k: record.get(k) for k in ('source', 'curriculum', 'curriculum_id', 'program_id', 'year', 'raw')})
    rule['verified_at'] = fetched_at
    coreq = parse_requirement(record.get('corequisites'))
    if coreq['type'] != 'UNKNOWN' and coreq['courses']:
        rule['corequisites'] = coreq['courses']
    return rule


def consensus(rules):
    """Do not silently choose one of several tracks or conflicting programs."""
    signatures = {json.dumps([r['type'], r['courses'], r.get('corequisites', [])], sort_keys=True) for r in rules}
    if len(signatures) == 1:
        return dict(rules[0])
    return {'type': 'UNKNOWN', 'courses': [], 'reason': 'Resmî program kayıtları arasında ön koşul farkı var; ilgili müfredatı kontrol edin.',
            'sources': sorted({r['source'] for r in rules if r.get('source')}),
            'source': next((r['source'] for r in rules if r.get('source')), None)}


def parse_department_table(html, dept):
    rules = {}
    for table in BeautifulSoup(html, 'html.parser').find_all('table'):
        rows = [[cell.get_text(' ', strip=True) for cell in row.find_all(['th', 'td'])] for row in table.find_all('tr')]
        header_index = next((i for i, row in enumerate(rows[:3]) if any('koşul' in c.lower() or 'koşullar' in c.lower() for c in row)), None)
        if header_index is None:
            continue
        header = rows[header_index]
        req_index = next(i for i, c in enumerate(header) if 'koşul' in c.lower())
        code_index = next((i for i, c in enumerate(header) if 'kod' in c.lower() and i != req_index), 0)
        for row in rows[header_index + 1:]:
            if len(row) <= max(code_index, req_index):
                continue
            match = re.match(r'([A-Zİ]{2,5})\s*(\d{3})\b', row[code_index], re.I)
            if not match:
                continue
            code = normalize(''.join(match.groups()))
            raw = row[req_index]
            if dept == 'INTT':
                match = re.match(r'(INTT\s*\d{3})\b', raw)
                if not match:
                    continue
                parsed = parse_requirement(match.group(1), code)
            else:
                parsed = parse_requirement(raw, code)
                combined = re.fullmatch(r'Ön Koşullar:\s*(.*?)\s*Eş Koşul:\s*(.*)', raw)
                if combined:
                    parsed = parse_requirement(combined[1], code)
                    coreq = parse_requirement(combined[2], code)
                    if coreq['type'] != 'UNKNOWN':
                        parsed['corequisites'] = coreq['courses']
            # Math's empty table cells are not explicit declarations of no prerequisite.
            if parsed['type'] == 'UNKNOWN' and not raw.strip():
                continue
            parsed.update({'raw': raw, 'source': SOURCES[dept], 'curriculum': f'{dept} bölümünün yayımladığı ön koşul tablosu'})
            if code in rules and rules[code]['courses'] != parsed['courses']:
                rules[code] = consensus([rules[code], parsed])
            else:
                rules[code] = parsed
    return rules


def parse_psychology(data):
    ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    rules = {}
    with zipfile.ZipFile(io.BytesIO(data)) as doc:
        tree = ElementTree.fromstring(doc.read('word/document.xml'))
    for row in tree.iter(ns + 'tr'):
        cells = [''.join(n.text or '' for n in cell.iter(ns + 't')).strip() for cell in row.iter(ns + 'tc')]
        if len(cells) < 5:
            continue
        code = normalize(cells[0] + cells[1])
        if not re.fullmatch(r'PSY\d{3}', code):
            continue
        raw = cells[4]
        # In this document the prerequisite column contains PSY course numbers.
        numbers = re.findall(r'\b\d{3}\b', raw)
        parsed = parse_requirement(';'.join('PSY' + n for n in numbers) if numbers else raw, code)
        parsed.update({'source': SOURCES['PSY'], 'curriculum': 'Psikoloji ön koşul tablosu (2026)', 'raw': raw})
        rules[code] = parsed
    return rules


def fetch_sources():
    CACHE.mkdir(exist_ok=True)
    manifest_path = CACHE / 'department_sources.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    sources = dict(SOURCES)
    for dept, (page, required, excluded) in DISCOVERY.items():
        try:
            response = requests.get(page, timeout=30)
            response.raise_for_status()
            links = []
            for link in BeautifulSoup(response.content, 'html.parser').find_all('a', href=True):
                url = urljoin(page, link['href'])
                host = urlsplit(url).hostname or ''
                label = unquote(url + ' ' + link.get_text(' ', strip=True)).lower()
                if host.endswith('.cankaya.edu.tr') and re.search(required, label) and not (excluded and re.search(excluded, label)):
                    if re.search(r'\.(png|jpe?g|pdf|docx?)(?:\?|$)', url, re.I):
                        links.append(url)
            if not links:
                raise ValueError(f'No current prerequisite document linked from {page}')
            # WordPress upload paths carry year/month; use the latest dated link.
            sources[dept] = max(links, key=lambda url: (re.search(r'/20\d{2}/\d{2}/', url) or [''])[0] + url)
        except (requests.RequestException, ValueError) as exc:
            if dept not in manifest:
                raise RuntimeError(f'{dept} source discovery failed: {exc}') from exc
            print(f'{dept}: keeping last verified source ({exc})', flush=True)
            continue
    for dept, url in sources.items():
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            path = CACHE / f'department_{dept}.source'
            temp = path.with_suffix('.source.tmp')
            temp.write_bytes(response.content)
            temp.replace(path)
            manifest[dept] = {'source': url, 'verified_at': datetime.now(timezone.utc).isoformat()}
            print(f'Fetched {dept}', flush=True)
        except requests.RequestException as exc:
            if dept not in manifest or not (CACHE / f'department_{dept}.source').exists():
                raise RuntimeError(f'{dept} source fetch failed: {exc}') from exc
            print(f'{dept}: keeping last verified source ({exc})', flush=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')


def compile_catalog():
    evidence = json.loads((ROOT / 'prerequisite_evidence.json').read_text(encoding='utf-8'))
    curricula = json.loads((DATA / 'cankaya_official_curricula.json').read_text(encoding='utf-8'))
    offered = {normalize(c) for c in json.loads((DATA / 'cankaya_courses.json').read_text(encoding='utf-8'))['courses']}
    program_depts = defaultdict(list)
    for dept, program in curricula.items():
        program_depts[str(program['program_id'])].append(dept)
    rules_by_code = defaultdict(list)
    details_by_code = defaultdict(list)
    scoped_rules = defaultdict(dict)
    scoped_details = defaultdict(dict)
    report = {'programs': [], 'missing_details': [], 'unknown_prerequisites': []}
    for program in evidence['programs']:
        records = latest_records(program)
        if not records:
            continue
        pid = str(program['program']['ProgramId'])
        by_code = defaultdict(list)
        for record in records:
            by_code[record['code']].append(record)
        report['programs'].append({'program_id': pid, 'name': program['program']['ProgramAdi'],
                                   'year': records[0]['year'], 'courses': len(by_code)})
        for code, course_records in by_code.items():
            rule = consensus([rule_from_record(r, evidence['fetched_at']) for r in course_records])
            rules_by_code[code].append(rule)
            for dept in program_depts[pid]:
                scoped_rules[code][dept] = rule
            for record in course_records:
                path = CACHE / (hashlib.sha256(record['source'].encode()).hexdigest() + '.json')
                if not path.exists():
                    report['missing_details'].append(record['source'])
                    continue
                data = json.loads(path.read_text(encoding='utf-8'))
                if normalize(str(data.get('DersKod', '')) + str(data.get('DersNo', ''))) != code:
                    raise ValueError(f'Course identity mismatch: {record["source"]}')
                detail = {'code': code, 'name': data.get('DersAdi', '').strip(), 'desc': data.get('DersTanimi') or '',
                          'credit': data.get('Kredi'), 'ects': data.get('ECTSKredi'),
                          'source': record['source'], 'curriculum': record['curriculum'],
                          'verified_at': evidence['fetched_at']}
                if detail['name']:
                    details_by_code[code].append(detail)
                    for dept in program_depts[pid]:
                        scoped_details[code][dept] = detail

    manifest = json.loads((CACHE / 'department_sources.json').read_text(encoding='utf-8'))
    SOURCES.update({key: value['source'] for key, value in manifest.items()})
    for dept in set(SOURCES) | set(DISCOVERY):
        if dept in {'IE', 'OFFERED', 'CE_DIAGRAM', 'CE_ELECTIVES'}:
            continue  # Diagram relationships are reviewed separately, not inferred from PDF text order.
        data = (CACHE / f'department_{dept}.source').read_bytes()
        if dept == 'CENG':
            from refresh_prerequisites import parse_rules
            parsed = parse_rules(data, course_prefix=None)
        else:
            parsed = parse_psychology(data) if dept == 'PSY' else parse_department_table(data, dept)
        if not parsed:
            raise ValueError(f'No department prerequisite rows parsed: {dept}')
        for code, rule in parsed.items():
            rule['verified_at'] = manifest[dept]['verified_at']
            scoped_rules[code][dept] = rule

    overrides_path = ROOT / 'department_prerequisite_overrides.json'
    if overrides_path.exists():
        for dept, overrides in json.loads(overrides_path.read_text(encoding='utf-8')).items():
            for code, rule in overrides.items():
                if rule.get('source_sha256'):
                    source_path = CACHE / f"department_{rule['source_key']}.source"
                    if hashlib.sha256(source_path.read_bytes()).hexdigest() != rule['source_sha256']:
                        raise ValueError(f'Department diagram changed; review {dept} before publishing its rules')
                scoped_rules[code][dept] = rule

    rules, details = {}, {}
    for code in sorted(set(offered) | set(rules_by_code) | set(scoped_rules)):
        owner = re.match(r'[A-Z]+', normalize(code)).group()
        owner_keys = [d for d in scoped_rules[code] if ALIASES.get(d, d) == owner]
        base = scoped_rules[code][owner_keys[0]] if owner_keys else consensus(rules_by_code[code]) if rules_by_code[code] else {'type': 'UNKNOWN', 'courses': []}
        # A course owner's explicit department table also applies when another
        # program lists that same course as an elective. Preserve explicit local exceptions.
        if owner_keys and base.get('source') and 'ogbs.cankaya.edu.tr' not in base['source']:
            for dept, rule in list(scoped_rules[code].items()):
                if 'ogbs.cankaya.edu.tr' in (rule.get('source') or ''):
                    scoped_rules[code][dept] = base
        rules[code] = {**base, 'program_rules': scoped_rules[code]}
        if base['type'] == 'UNKNOWN' and code in offered:
            report['unknown_prerequisites'].append(code)
        candidates = details_by_code[code]
        if candidates:
            owner_details = [v for d, v in scoped_details[code].items() if ALIASES.get(d, d) == owner]
            detail = owner_details[0] if owner_details else candidates[0]
            details[code] = {**detail, 'program_details': scoped_details[code]}

    # Current offered-course names are the authoritative identity for the timetable.
    # Match the complete normalized code, never row position or a numeric suffix.
    table = BeautifulSoup((CACHE / 'department_OFFERED.source').read_bytes(), 'html.parser').find('table', id='CoursesTable')
    if table is None:
        raise ValueError('Official offered-course table missing')
    seen_offered = set()
    for row in table.find_all('tr'):
        cells = row.find_all('td', recursive=False)
        if len(cells) != 7:
            continue
        code = normalize(cells[0].get_text())
        if code not in offered:
            continue
        if code in seen_offered:
            raise ValueError(f'Duplicate offered-course code: {code}')
        seen_offered.add(code)
        name = cells[1].get_text(' ', strip=True)
        if not name:
            raise ValueError(f'Missing offered-course name: {code}')
        detail = details.setdefault(code, {'code': code, 'desc': '', 'program_details': {}})
        detail.update({'name': name, 'name_source': SOURCES['OFFERED'], 'name_verified_at': manifest['OFFERED']['verified_at']})
        for record in detail.get('program_details', {}).values():
            record['name'] = name
    if seen_offered != offered:
        raise ValueError(f'Official offered-course names missing for {sorted(offered - seen_offered)}')

    report['offered_courses'] = len(offered)
    report['named_courses'] = sum(c in details for c in offered)
    report['known_prerequisites'] = sum(rules[c]['type'] != 'UNKNOWN' for c in offered)
    # Prepare all output before replacing any existing application data.
    for filename, data in [('cankaya_official_prerequisites.json', rules), ('cankaya_course_details.json', details)]:
        payload = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
        path = DATA / filename
        temp = path.with_suffix('.json.tmp')
        temp.write_text(payload, encoding='utf-8')
        temp.replace(path)
    (ROOT / 'course_catalog_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Compiled {len(report['programs'])} programs; {report['named_courses']}/{len(offered)} names; {report['known_prerequisites']}/{len(offered)} known prerequisite rules.")
    print('Unknown:', ', '.join(report['unknown_prerequisites']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-sources', action='store_true')
    args = parser.parse_args()
    if args.refresh_sources:
        fetch_sources()
    compile_catalog()
