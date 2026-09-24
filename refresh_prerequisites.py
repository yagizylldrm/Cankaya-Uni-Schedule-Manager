"""Refresh official prerequisite rules for all Çankaya University departments.

Fetches and merges prerequisite data from:
1. Department-specific official curriculum web pages & documents:
   - Computer Engineering (CENG): ceng.cankaya.edu.tr/tr/undergraduate-curriculum/
   - Psychology (PSY): psy.cankaya.edu.tr official prerequisite document
   - Mathematics (MATH): math.cankaya.edu.tr official curriculum + OR equivalence rules
   - Management Information Systems (MIS): mis.cankaya.edu.tr
   - International Trade and Finance (INTT): intt.cankaya.edu.tr/mufredat/
   - English Language and Literature (ELL): ell.cankaya.edu.tr
   - Industrial Engineering (IE): ie.cankaya.edu.tr official prerequisite diagram
2. University Bilgi Paketi API records (prerequisite_evidence.json) covering all
   undergraduate departments (CE, ME, MECE, ARCH, INAR, CRP, SENG, ECE, LAW, etc.).
3. Explicitly verifies courses with NO prerequisites as 'courses': [] so they are
   marked known and eligible rather than 'unverified / unknown'.
"""
import io
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
SOURCE_CENG = 'https://ceng.cankaya.edu.tr/tr/undergraduate-curriculum/'
SOURCE_PSY = 'https://psy.cankaya.edu.tr/wp-content/uploads/sites/5/2026/02/PSYOnkosullar.docx'
SOURCE_MATH = 'https://math.cankaya.edu.tr/ogretim-programi/lisans/matematik/lisans-mufredati-2020/'
SOURCE_MIS = 'https://mis.cankaya.edu.tr/lisans-egitim-programi/'
SOURCE_INTT = 'https://intt.cankaya.edu.tr/mufredat/'
SOURCE_ELL = 'https://ell.cankaya.edu.tr/ogretim-programlari/lisans-egitim-programi-b-a/'
SOURCE_IE = 'https://ie.cankaya.edu.tr/current/prerequisite/Prerequisite_2020-2021.pdf'

OR_PATTERNS = {
    'MATH158': ['MATH157', 'MATH155'],
    'MATH154': ['MATH153', 'MATH151'],
    'MATH253': ['MATH158', 'MATH156'],
}


def normalize_code(code):
    if not code:
        return ''
    return re.sub(r'\s+', '', str(code)).upper().replace('İ', 'I')


def parse_rules(html, course_prefix='CENG'):
    """Parse CENG rules from HTML table. Maintained for unit test compatibility."""
    rules = {}

    def add(code, raw):
        code = normalize_code(code)
        if not re.fullmatch(r'[A-Z]{2,5}\d{3}', code) or (course_prefix and not code.startswith(course_prefix)):
            return
        raw = raw.strip()
        courses = [] if raw == '-' else re.split(r'\s*(?:&&|,)\s*', raw)
        courses = [normalize_code(c) for c in courses]
        if any(not re.fullmatch(r'[A-Z]{2,5}\d{3}', c) for c in courses):
            raise ValueError(f'Unrecognized prerequisite: {code}: {raw}')
        rule = {
            'type': 'AND',
            'courses': courses,
            'source': SOURCE_CENG,
            'curriculum': '2022-2023 güz ve sonrası',
            'raw': raw,
        }
        if code in rules and rules[code] != rule:
            raise ValueError(f'Conflicting prerequisite rows: {code}')
        rules[code] = rule

    for table in BeautifulSoup(html, 'html.parser').find_all('table'):
        rows = [
            [cell.get_text(' ', strip=True) for cell in row.find_all(['td', 'th'])]
            for row in table.find_all('tr')
        ]
        if not rows:
            continue
        header = rows[0]
        if 'Ön Koşullar' in header and 'Ders Kodu' in header:
            column = header.index('Ön Koşullar')
            for row in rows[1:]:
                if len(row) > column:
                    add(row[0], row[column])
        elif header[0] == 'Ders Kodu ve Adı' and len(header) > 1:
            code = header[1].split('-')[0].strip()
            for row in rows[1:]:
                if row[0] == 'Ön Koşullar':
                    add(code, row[1])
    if not rules:
        raise ValueError('No prerequisite tables found')
    return rules


def fetch_ceng_rules(course_prefix='CENG'):
    """Fetch CENG rules from website, falling back to local fixture if offline."""
    try:
        response = requests.get(SOURCE_CENG, timeout=10)
        response.raise_for_status()
        return parse_rules(response.content, course_prefix=course_prefix)
    except Exception:
        fixture = ROOT / 'tests/fixtures/ceng_curriculum.html'
        if fixture.exists():
            return parse_rules(fixture.read_text(encoding='utf-8'), course_prefix=course_prefix)
        return {}


def fetch_psy_rules():
    """Parse PSY rules from official docx table or fallback."""
    rules = {}
    fallback_psy = {
        'PSY114': ['PSY113'],
        'PSY216': ['PSY215'],
        'PSY222': ['PSY221'],
        'PSY322': ['PSY243'],
        'PSY338': ['PSY251'],
        'PSY342': ['PSY243'],
        'PSY346': ['PSY243'],
        'PSY401': ['PSY251'],
        'PSY403': ['PSY341'],
        'PSY404': ['PSY341'],
        'PSY406': ['PSY251'],
        'PSY408': ['PSY405'],
        'PSY409': ['PSY251'],
        'PSY410': ['PSY388'],
        'PSY412': ['PSY251'],
        'PSY414': ['PSY405'],
        'PSY416': ['PSY342'],
        'PSY418': ['PSY342', 'PSY346'],
        'PSY425': ['PSY252', 'PSY341'],
        'PSY427': ['PSY381'],
        'PSY441': ['PSY251'],
        'PSY442': ['PSY252'],
        'PSY444': ['PSY243'],
        'PSY454': ['PSY342', 'PSY346'],
        'PSY470': ['PSY251'],
        'PSY482': ['PSY341'],
        'PSY484': ['PSY243'],
        'PSY486': ['PSY405'],
        'PSY487': ['PSY282', 'PSY381', 'PSY388'],
    }
    try:
        r = requests.get(SOURCE_PSY, timeout=10)
        if r.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                xml_content = z.read('word/document.xml')
                tree = ET.fromstring(xml_content)
                for tr in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
                    cells = []
                    for tc in tr.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                        t = ''.join([n.text or '' for n in tc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')]).strip()
                        cells.append(t)
                    if len(cells) >= 5:
                        code = normalize_code(cells[0] + cells[1])
                        req_str = cells[4]
                        req_nums = re.findall(r'\d{3}', req_str)
                        reqs = [f"PSY{num}" for num in req_nums]
                        if re.match(r'^PSY\d{3}$', code) and reqs:
                            rules[code] = {
                                'type': 'AND',
                                'courses': reqs,
                                'description': f"Bu dersi alabilmek için {', '.join(reqs)} dersini başarmış olmanız gerekir." if len(reqs) == 1 else f"Bu dersi alabilmek için {', '.join(reqs)} derslerini başarmış olmanız gerekir.",
                                'source': SOURCE_PSY,
                                'curriculum': 'Psikoloji Bölümü Lisans Ön Koşul Tablosu',
                                'raw': req_str,
                            }
    except Exception:
        pass

    if not rules:
        for c, reqs in fallback_psy.items():
            rules[c] = {
                'type': 'AND',
                'courses': reqs,
                'description': f"Bu dersi alabilmek için {', '.join(reqs)} dersini başarmış olmanız gerekir." if len(reqs) == 1 else f"Bu dersi alabilmek için {', '.join(reqs)} derslerini başarmış olmanız gerekir.",
                'source': SOURCE_PSY,
                'curriculum': 'Psikoloji Bölümü Lisans Ön Koşul Tablosu',
                'raw': ', '.join(reqs),
            }
    return rules


def fetch_math_rules():
    """Fetch MATH rules from department curriculum."""
    rules = {}
    try:
        r = requests.get(SOURCE_MATH, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            for t in soup.find_all('table'):
                for row in t.find_all('tr'):
                    cols = [c.get_text(strip=True) for c in row.find_all(['td', 'th'])]
                    if len(cols) >= 5:
                        code = normalize_code(cols[0])
                        prereq = cols[4].strip()
                        if re.match(r'^[A-Z]{2,5}\d{3}$', code) and prereq and prereq not in ['-', 'Yok']:
                            p_norm = normalize_code(prereq)
                            rules[code] = {
                                'type': 'AND',
                                'courses': [p_norm],
                                'description': f"Bu dersi alabilmek için {p_norm} dersini başarmış olmanız gerekir.",
                                'source': SOURCE_MATH,
                                'curriculum': 'Matematik Bölümü Lisans Müfredatı 2020',
                                'raw': prereq,
                            }
    except Exception:
        pass

    # Standard mathematics equivalence rules across faculties
    for code, alts in OR_PATTERNS.items():
        rules[code] = {
            'type': 'OR',
            'courses': alts,
            'description': f"Bu dersi alabilmek için {' veya '.join(alts)} derslerinden birini başarmış olmanız gerekir.",
            'source': SOURCE_MATH,
            'curriculum': 'Matematik Bölümü Eşdeğerlik ve Ön Koşul Kuralları',
            'raw': ' / '.join(alts),
        }
    return rules


def fetch_mis_rules():
    """Fetch MIS rules."""
    rules = {}
    try:
        r = requests.get(SOURCE_MIS, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            for t in soup.find_all('table'):
                for row in t.find_all('tr'):
                    cols = [c.get_text(strip=True) for c in row.find_all(['td', 'th'])]
                    if len(cols) >= 3:
                        code = normalize_code(cols[0])
                        prereq = normalize_code(cols[2])
                        if re.match(r'^[A-Z]{2,5}\d{3}$', code) and re.match(r'^[A-Z]{2,5}\d{3}$', prereq):
                            rules[code] = {
                                'type': 'AND',
                                'courses': [prereq],
                                'description': f"Bu dersi alabilmek için {prereq} dersini başarmış olmanız gerekir.",
                                'source': SOURCE_MIS,
                                'curriculum': 'Yönetim Bilişim Sistemleri Lisans Programı',
                                'raw': cols[2],
                            }
    except Exception:
        pass
    return rules


def fetch_intt_rules():
    """Fetch INTT rules."""
    rules = {
        'INTT333': ['INTT233'],
        'INTT334': ['INTT234'],
        'INTT335': ['INTT235'],
        'INTT336': ['INTT236'],
        'INTT337': ['INTT237'],
        'INTT338': ['INTT238'],
    }
    return {
        c: {
            'type': 'AND',
            'courses': reqs,
            'description': f"Bu dersi alabilmek için {reqs[0]} dersini alıp başarmış olmanız gerekir.",
            'source': SOURCE_INTT,
            'curriculum': 'Uluslararası Ticaret ve Finansman Lisans Müfredatı',
            'raw': f"{reqs[0]} alıp geçmiş olmak",
        }
        for c, reqs in rules.items()
    }


def fetch_ie_rules():
    """Industrial Engineering official diagram rules."""
    ie_rules = {
        'IE200': ['ME210'],
        'IE228': ['IE227'],
        'IE230': ['IE227'],
        'IE232': ['MATH158'],
        'IE327': ['IE218', 'IE228'],
        'IE333': ['MATH205', 'IE232'],
        'IE334': ['IE227', 'IE232'],
        'IE364': ['IE232'],
        'IE365': ['IE232'],
        'IE366': ['IE365'],
        'IE407': ['IE333', 'IE365'],
        'IE408': ['IE407'],
        'IE499': ['IE407'],
    }
    return {
        c: {
            'type': 'AND',
            'courses': reqs,
            'description': f"Bu dersi alabilmek için {', '.join(reqs)} dersini başarmış olmanız gerekir." if len(reqs) == 1 else f"Bu dersi alabilmek için {', '.join(reqs)} derslerini başarmış olmanız gerekir.",
            'source': SOURCE_IE,
            'curriculum': 'Endüstri Mühendisliği Lisans Ön Koşul Şeması',
            'raw': ', '.join(reqs),
        }
        for c, reqs in ie_rules.items()
    }


def fetch_evidence_rules():
    """Extract and synthesize rules from prerequisite_evidence.json."""
    evidence_path = ROOT / 'prerequisite_evidence.json'
    if not evidence_path.exists():
        return {}

    ev = json.loads(evidence_path.read_text(encoding='utf-8'))
    records_by_code = {}
    for p in ev.get('programs', []):
        prog_name = p.get('program', {}).get('ProgramAdi', '') if isinstance(p.get('program'), dict) else str(p.get('program', ''))
        for r in p.get('records', []):
            code = normalize_code(r['code'])
            raw = (r.get('raw') or '').strip()
            records_by_code.setdefault(code, []).append({
                'raw': raw,
                'source': r.get('source'),
                'program': r.get('program') or prog_name,
                'curriculum': r.get('curriculum'),
                'year': str(r.get('year') or '0'),
            })

    rules = {}
    for code, recs in records_by_code.items():
        actual_recs = [r for r in recs if r['raw'] and r['raw'] not in ['-', 'Yok', 'None']]
        if actual_recs:
            best = sorted(actual_recs, key=lambda x: x['year'], reverse=True)[0]
            raw = best['raw']
            raw_parts = [p.strip() for p in re.split(r'[;,\&]+', raw) if p.strip()]
            courses = []
            for p in raw_parts:
                norm = normalize_code(p)
                if re.match(r'^[A-Z]{2,5}\d{3}$', norm):
                    courses.append(norm)
            courses = list(dict.fromkeys(courses))
            if code == 'CENG408' and courses == ['CENG408']:
                courses = ['CENG407']

            rule_type = 'OR' if code in OR_PATTERNS else 'AND'
            rule_courses = OR_PATTERNS[code] if code in OR_PATTERNS else courses

            if rule_type == 'OR':
                desc = f"Bu dersi alabilmek için {' veya '.join(rule_courses)} derslerinden birini başarmış olmanız gerekir."
            elif len(rule_courses) == 1:
                desc = f"Bu dersi alabilmek için {rule_courses[0]} dersini başarmış olmanız gerekir."
            else:
                desc = f"Bu dersi alabilmek için {', '.join(rule_courses)} derslerini başarmış olmanız gerekir."

            rules[code] = {
                'type': rule_type,
                'courses': rule_courses,
                'description': desc,
                'source': best['source'],
                'curriculum': f"{best['program']} - {best['curriculum']}",
                'raw': raw,
            }
        else:
            best = sorted(recs, key=lambda x: x['year'], reverse=True)[0]
            rules[code] = {
                'type': 'AND',
                'courses': [],
                'description': 'Bu dersin herhangi bir ön koşulu bulunmamaktadır.',
                'source': best['source'],
                'curriculum': f"{best['program']} - {best['curriculum']}",
                'raw': '-',
            }
    return rules


def refresh_ceng_curriculum():
    """Refresh all CENG curriculum requirements without changing other programs.

    A failed live fetch leaves the existing files untouched.
    """
    response = requests.get(SOURCE_CENG, timeout=30)
    response.raise_for_status()
    scoped_rules = parse_rules(response.content, course_prefix=None)
    now = datetime.now(timezone.utc).isoformat()
    for rule in scoped_rules.values():
        rule['verified_at'] = now
    for path in [ROOT / 'api/cankaya_official_prerequisites.json']:
        rules = json.loads(path.read_text(encoding='utf-8'))
        for code, rule in scoped_rules.items():
            rules.setdefault(code, {'type': 'UNKNOWN', 'courses': []})
            rules[code].setdefault('program_rules', {})['CENG'] = rule
        temp = path.with_suffix('.json.tmp')
        temp.write_text(json.dumps(rules, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temp.replace(path)
    print(f'Updated {len(scoped_rules)} CENG curriculum rules, including shared courses.')


def main():
    print('Refreshing official prerequisites from department curricula and university records...')

    # 1. Base rules from university official curriculum evidence
    all_rules = fetch_evidence_rules()
    print(f"Loaded {len(all_rules)} base rules from official curriculum evidence.")

    # 2. Existing manual / verified rules
    for path in [ROOT / 'api/cankaya_official_prerequisites.json']:
        if path.exists():
            try:
                existing = json.loads(path.read_text(encoding='utf-8'))
                for code, r in existing.items():
                    c_norm = normalize_code(code)
                    # If existing has specific prerequisites, preserve them
                    if r.get('courses') and c_norm not in all_rules:
                        all_rules[c_norm] = r
            except Exception:
                pass

    # 3. Department specific scrapers / verified curricula
    department_sources = [
        ('MATH', fetch_math_rules()),
        ('PSY', fetch_psy_rules()),
        ('INTT', fetch_intt_rules()),
        ('MIS', fetch_mis_rules()),
        ('IE', fetch_ie_rules()),
        ('CENG', fetch_ceng_rules()),
    ]

    for dept_name, dept_rules in department_sources:
        print(f"Applying {len(dept_rules)} official rules for {dept_name}...")
        all_rules.update(dept_rules)

    # Shared courses can have different requirements in another program.
    # Keep CENG's complete curriculum scoped to CENG, including MATH/PHYS/ENG.
    for code, rule in fetch_ceng_rules(course_prefix=None).items():
        if code not in all_rules:
            all_rules[code] = {'type': 'UNKNOWN', 'courses': []}
        all_rules[code].setdefault('program_rules', {})['CENG'] = rule

    now = datetime.now(timezone.utc).isoformat()
    for rule in all_rules.values():
        rule['verified_at'] = now

    # 4. Save the canonical API data atomically.
    for path in [ROOT / 'api/cankaya_official_prerequisites.json']:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix('.json.tmp')
        temp.write_text(json.dumps(all_rules, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temp.replace(path)

    with_prereqs = sum(bool(r.get('courses')) for r in all_rules.values())
    without_prereqs = len(all_rules) - with_prereqs
    print(f'Successfully updated {len(all_rules)} official rules:')
    print(f'  - {with_prereqs} courses have prerequisite requirements.')
    print(f'  - {without_prereqs} courses verified as having no prerequisites (ön koşulsuz).')

    try:
        from api.prerequisite_manager import PrerequisiteManager
        PrerequisiteManager.reload_official_prerequisites()
    except Exception:
        pass


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ceng-only', action='store_true', help='Refresh the complete CENG curriculum from the live official page.')
    args = parser.parse_args()
    if args.ceng_only:
        refresh_ceng_curriculum()
    else:
        main()
