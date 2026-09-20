import requests
import re
import time
from bs4 import BeautifulSoup

class CankayaScraper:
    BASE_URL = "https://www.cankaya.edu.tr/ogrenci_isleri/kodprogramlar.php"
    
    DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        })

    def fetch_department_codes(self):
        """Fetches available department/course codes from the dropdown menu."""
        try:
            resp = self.session.get(self.BASE_URL, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')
            select = soup.find('select', {'name': 'derskod'})
            if not select:
                return []
            
            codes = []
            for opt in select.find_all('option'):
                val = opt.get('value', '').strip()
                text = opt.text.strip()
                if val and val != '0':
                    codes.append({'code': val, 'name': text})
            return codes
        except Exception as e:
            print(f"Error fetching department codes: {e}")
            return []

    def parse_schedule_table(self, html_text, dept_code, year_grade):
        """Parses the weekly schedule table returned for a given department code and year."""
        soup = BeautifulSoup(html_text, 'html.parser')
        table = soup.find('table')
        if not table:
            return []

        rows = table.find_all('tr')
        if not rows:
            return []

        headers = [th.text.strip() for th in rows[0].find_all(['td', 'th'])]
        schedule_entries = []

        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if not cells:
                continue

            time_slot = cells[0].text.strip()

            for day_idx, cell in enumerate(cells[1:], start=1):
                if day_idx >= len(headers):
                    continue

                day_name = headers[day_idx].strip()
                fonts = cell.find_all('font')

                for font in fonts:
                    for br in font.find_all(['br', 'p']):
                        br.replace_with('\n')
                    
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

                    parts = [p.strip() for p in header_line.split('-') if p.strip()]
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
        """
        Scrapes all course schedules across specified departments and grade years.
        progress_callback: function(current, total, message)
        cancel_check: function() -> bool (returns True if cancelled)
        """
        if dept_list is None:
            dept_info_list = self.fetch_department_codes()
            dept_codes = [d['code'] for d in dept_info_list]
        else:
            dept_codes = dept_list

        total_steps = len(dept_codes) * 6
        current_step = 0
        all_entries = []

        for dept_idx, code in enumerate(dept_codes):
            if cancel_check and cancel_check():
                break

            for year in range(1, 7):
                if cancel_check and cancel_check():
                    break

                current_step += 1
                if progress_callback:
                    msg = f"Ders verileri çekiliyor: {code} ({year}. Sınıf)"
                    progress_callback(current_step, total_steps, msg)

                payload = {
                    'derskod': code,
                    'dersno': str(year),
                    'finalsubmit': 'FINAL SUBMIT',
                    'sonfinal': '$thestates'
                }

                try:
                    resp = self.session.post(self.BASE_URL, data=payload, timeout=12)
                    if resp.status_code == 200:
                        entries = self.parse_schedule_table(resp.text, code, year)
                        all_entries.extend(entries)
                except Exception as e:
                    print(f"Error scraping {code} year {year}: {e}")

                time.sleep(0.02)

        return all_entries
