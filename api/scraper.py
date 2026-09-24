import requests
import re
import time
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlsplit

class CankayaScraper:
    BASE_URL = "https://www.cankaya.edu.tr/ogrenci_isleri/kodprogramlar.php"
    COURSES_URL = "https://www.cankaya.edu.tr/dersler/"
    
    DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.offered_courses = []
        self.term = ""
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        })

    def fetch_offered_courses(self):
        response = self.session.get(self.COURSES_URL, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        heading = soup.find(lambda tag: tag.name in ('h2', 'h3', 'h4') and 'Açılan Dersler' in tag.get_text())
        self.term = heading.get_text(' ', strip=True) if heading else ''
        table = soup.find('table', id='CoursesTable')
        if table is None:
            raise ValueError("Açılan dersler tablosu bulunamadı.")
        courses = []
        for row in table.find_all('tr'):
            cells = row.find_all('td', recursive=False)
            if not cells or not cells[0].get_text(strip=True):
                continue
            code = re.sub(r'\s+', '', cells[0].get_text()).upper()
            if len(cells) != 7 or not re.fullmatch(r'[^\W\d_]+\d+[A-Z]?', code):
                raise ValueError(f"Geçersiz açılan ders satırı: {code}")
            link = cells[5].find('a', href=True)
            if not link:
                raise ValueError(f"{code} program bağlantısı bulunamadı.")
            url = urljoin(self.COURSES_URL, link['href'].strip())
            if urlsplit(url).hostname != 'www.cankaya.edu.tr':
                raise ValueError(f"Beklenmeyen program adresi: {url}")
            url = url.replace('http://', 'https://', 1)
            courses.append({'code': code, 'dept_code': re.match(r'[^\d]+', code)[0],
                            'url': url})
        if not courses:
            raise ValueError("Açılan ders listesi boş.")
        self.offered_courses = courses
        return courses

    def fetch_department_codes(self):
        """Return departments with courses in the current offered-course list."""
        codes = sorted({c['dept_code'] for c in self.fetch_offered_courses()})
        return [{'code': code, 'name': code} for code in codes]

    def parse_schedule_table(self, html_text, dept_code, year_grade):
        """Parses the weekly schedule table returned for a given department code and year."""
        soup = BeautifulSoup(html_text, 'html.parser')
        table = soup.find('table', id='table-ders')
        if not table:
            if 'Sistemde Ders Programı Bulunmamaktadır!!!' in soup.get_text():
                return []
            raise ValueError("Resmî ders tablosu (table-ders) bulunamadı.")

        rows = table.find_all('tr')
        if not rows:
            raise ValueError("Ders tablosunun başlığı bulunamadı.")

        headers = [th.text.strip() for th in rows[0].find_all(['td', 'th'])]
        if headers != ['Saat', *self.DAYS]:
            raise ValueError(f"Ders tablosunun sütunları değişmiş: {headers}")
        schedule_entries = []

        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if not cells:
                continue
            if len(cells) != len(headers):
                raise ValueError("Ders tablosunda eksik veya birleşik sütun var.")

            time_slot = cells[0].text.strip()
            if not re.fullmatch(r'\d{2}:\d{2}\s*[/\-]\s*\d{2}:\d{2}', time_slot):
                raise ValueError(f"Geçersiz ders saati: {time_slot}")

            for day_idx, cell in enumerate(cells[1:], start=1):
                if day_idx >= len(headers):
                    continue

                day_name = headers[day_idx].strip()
                fonts = cell.find_all('font')

                # The current /dersler/ links contain plain text, not font tags.
                # Each course-section header is followed by its classroom, not an instructor.
                if not fonts:
                    lines = list(cell.stripped_strings)
                    current = None
                    for line in lines:
                        match = re.fullmatch(r'([^\W\d_]+\s*\d+[A-Z]?)\s*-\s*(\d+)', line)
                        if match:
                            current = {
                                'dept_code': dept_code, 'year_grade': str(year_grade),
                                'course_code': re.sub(r'\s+', '', match[1]), 'section': match[2],
                                'instructor': 'Belirsiz', 'classroom': '',
                                'day': day_name, 'time_slot': time_slot,
                            }
                            schedule_entries.append(current)
                        elif current is not None:
                            current['classroom'] = (current['classroom'] + ' ' + line).strip()
                        else:
                            raise ValueError(f"Tanınmayan ders hücresi: {line}")
                    continue

                for font in fonts:
                    for br in font.find_all('br'):
                        br.replace_with('\n')
                    for paragraph in font.find_all('p'):
                        paragraph.insert_before('\n')
                        paragraph.insert_after('\n')
                    
                    text_content = font.get_text()
                    lines = [line.strip() for line in text_content.split('\n') if line.strip()]
                    if not lines:
                        continue

                    header_line = lines[0]
                    instructor = lines[1] if len(lines) > 1 else "Belirsiz"
                    classroom = ""

                    # 1. Check if lines has 3 or more items (line 0: course-sec, line 1: instructor, line 2+: classroom)
                    if len(lines) >= 3:
                        classroom = " ".join(lines[2:]).strip()

                    # 2. Check header_line for parentheses e.g. "CENG111 - 1 (LA01)"
                    paren_match = re.search(r'\(([^)]+)\)', header_line)
                    if paren_match:
                        if not classroom:
                            classroom = paren_match.group(1).strip()
                        header_line = header_line.replace(paren_match.group(0), '').strip()

                    parts = [p.strip() for p in header_line.split('-', 2) if p.strip()]
                    if len(parts) >= 3:
                        course_code = parts[0]
                        section = parts[1]
                        if not classroom:
                            classroom = parts[2]
                    elif len(parts) == 2:
                        course_code = parts[0]
                        if '/' in parts[1]:
                            sec_parts = parts[1].split('/')
                            section = sec_parts[0].strip()
                            if not classroom:
                                classroom = sec_parts[1].strip()
                        else:
                            section = parts[1]
                    else:
                        course_code = header_line
                        section = "1"

                    course_code = re.sub(r'\s+', '', course_code)

                    # 3. Check instructor line for classroom e.g. "Doç. Dr. X (LA01)"
                    inst_paren = re.search(r'\(([^)]+)\)', instructor)
                    if inst_paren and not classroom:
                        classroom = inst_paren.group(1).strip()
                        instructor = instructor.replace(inst_paren.group(0), '').strip()

                    # 4. Check title attribute of font or cell
                    if not classroom:
                        title_val = font.get('title', '') or cell.get('title', '')
                        if title_val:
                            classroom = title_val.strip()

                    # Clean classroom prefix like "Derslik:" or "Sınıf:"
                    if classroom:
                        classroom = re.sub(r'^(Derslik|Sınıf|Oda|Room|Classroom)\s*[:\-]?\s*', '', classroom, flags=re.IGNORECASE).strip()

                    schedule_entries.append({
                        "dept_code": dept_code,
                        "year_grade": str(year_grade),
                        "course_code": course_code,
                        "section": section,
                        "instructor": instructor,
                        "classroom": classroom,
                        "day": day_name,
                        "time_slot": time_slot
                    })

        return schedule_entries

    def fetch_all_schedules(self, progress_callback=None, dept_list=None, cancel_check=None):
        """Read only currently offered courses and their linked timetables.

        Any failed page aborts the refresh, so callers cannot save a partial cache.
        Empty but structurally valid timetables are allowed (e.g. thesis courses).
        """
        courses = self.fetch_offered_courses()
        if dept_list is not None:
            courses = [c for c in courses if c['dept_code'] in dept_list]
        all_entries = []
        for index, course in enumerate(courses, 1):
            if cancel_check and cancel_check():
                raise RuntimeError("Ders verilerinin alınması iptal edildi.")
            if progress_callback:
                progress_callback(index, len(courses), f"Ders verileri çekiliyor: {course['code']}")
            for attempt in range(3):
                try:
                    response = self.session.get(course['url'], timeout=30)
                    response.raise_for_status()
                    entries = self.parse_schedule_table(response.text, course['dept_code'], '')
                    if any(e['course_code'] != course['code'] for e in entries):
                        raise ValueError(f"Program sayfası farklı bir ders içeriyor: {course['code']}")
                    all_entries.extend(entries)
                    break
                except (requests.RequestException, ValueError) as exc:
                    if attempt == 2:
                        raise RuntimeError(f"{course['code']} alınamadı; güncelleme durduruldu: {exc}") from exc
                    time.sleep(attempt + 1)
        return all_entries
