"""Collect curriculum-specific official prerequisite evidence for offered courses.

Network responses are cached locally so interrupted scans can be resumed.
This collector never updates the application's rules on its own.
"""
import hashlib
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import requests
from curriculum_fetcher import CurriculumFetcher

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.prerequisite-cache'
LOCAL = threading.local()


def normalize(code):
    return re.sub(r'\s+', '', str(code)).upper().replace('İ', 'I')


def get(endpoint, params):
    url = CurriculumFetcher.BASE_URL + endpoint + '?' + urlencode(params)
    cache = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if cache.exists():
        return json.loads(cache.read_text(encoding='utf-8'))
    if not hasattr(LOCAL, 'session'):
        token = os.environ.get('CANKAYA_EBS_TOKEN', '').strip()
        if not token:
            raise RuntimeError('CANKAYA_EBS_TOKEN is required to fetch uncached curriculum evidence')
        LOCAL.session = requests.Session()
        LOCAL.session.headers['Authorization'] = 'Bearer ' + token
    for attempt in range(3):
        try:
            response = LOCAL.session.get(url, timeout=25)
            response.raise_for_status()
            data = response.json()
            if data is None:
                raise ValueError('Empty API response')
            cache.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
            return data
        except (requests.RequestException, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def collect_program(program):
    pid = program['ProgramId']
    records, errors = [], []
    curricula = get('/WsPersonel', {'method': 700, 'methodNo': 11, 'Params': pid})
    for curr in curricula:
        cid = curr[0]
        rows = get('/WsPersonel', {'method': 700, 'methodNo': 14, 'Params': f'{curr[4]};{pid};{cid}'})
        items = {}
        for row in rows:
            if len(row) < 9:
                raise ValueError(f'Invalid curriculum row in {pid}/{cid}')
            code = normalize(str(row[5]) + str(row[6]))
            if str(row[5]).strip() == 'ELEC':
                groups = get('/GrupDersleri', {'BimKodu': row[2], 'MufredatNo': cid, 'BolumKodu': pid})
                for item in groups:
                    items[(normalize(item['DersKod']), str(item['BimKodu']))] = True
            else:
                items[(code, str(row[2]))] = True
        for (code, bim) in items:
            if code not in OFFERED:
                continue
            params = {'BimKodu': bim, 'MufredatNo': cid, 'BolumKodu': pid, 'lang': 'tr'}
            try:
                detail = get('/DersBilgi', params)
                actual = normalize(str(detail.get('DersKod', '')) + str(detail.get('DersNo', '')))
                if actual != code or 'Prequisites' not in detail:
                    raise ValueError(f'Detail mismatch: {actual} / {code}')
                records.append({'code': code, 'program_id': str(pid), 'program': program['ProgramAdi'],
                                'level': program['level'], 'curriculum_id': str(cid),
                                'curriculum': curr[2], 'year': str(curr[5]),
                                'raw': detail['Prequisites'], 'corequisites': detail.get('Corequisites'),
                                'source': CurriculumFetcher.BASE_URL + '/DersBilgi?' + urlencode(params)})
            except Exception as exc:
                errors.append({'code': code, 'program_id': str(pid), 'curriculum_id': str(cid), 'error': str(exc)})
    return {'program': program, 'curricula_count': len(curricula), 'records': records, 'errors': errors}


def main():
    global OFFERED
    CACHE.mkdir(exist_ok=True)
    OFFERED = {normalize(c) for c in json.loads((ROOT / 'api/cankaya_courses.json').read_text(encoding='utf-8'))['courses']}
    programs = {}
    for level in ['O', 'L', 'Y', 'D']:
        for faculty in get('/Fakulteler', {'Program': level}):
            for program in get('/Bolumler', {'Program': level, 'FakNo': faculty['FakNo']}):
                programs[program['ProgramId']] = {**program, 'level': level}
    print(f'Scanning {len(programs)} programs for {len(OFFERED)} offered courses.', flush=True)
    report = {'fetched_at': datetime.now(timezone.utc).isoformat(), 'programs': [], 'errors': []}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [(program, pool.submit(collect_program, program)) for program in programs.values()]
        for index, (program, future) in enumerate(futures, 1):
            try:
                result = future.result()
                report['programs'].append(result)
                print(f"{index}/{len(programs)} {program['ProgramAdi']}: {result['curricula_count']} curricula, {len(result['records'])} records, {len(result['errors'])} errors", flush=True)
            except Exception as exc:
                report['errors'].append({'program': program, 'error': str(exc)})
                print(f"ERROR {program['ProgramAdi']}: {exc}", flush=True)
            (ROOT / 'prerequisite_evidence.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Evidence saved; app rules unchanged.', flush=True)


if __name__ == '__main__':
    main()
