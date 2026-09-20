import re
import os

class TranscriptParser:
    """
    Parses Çankaya University transcripts from text, PDF, HTML, or JSON.
    Extracts:
    - Primary department (Bölüm)
    - Secondary department & type (Yandal / Çift Anadal)
    - Passed courses with letter grades
    - Failed / repeat courses
    """

    PASSING_GRADES = {"AA", "BA", "BB", "CB", "CC", "DC", "DD", "S", "P"}
    FAILING_GRADES = {"FD", "FF", "NA", "U", "W"}
    ALL_GRADES = PASSING_GRADES | FAILING_GRADES

    DEPARTMENT_NAMES_MAP = {
        "BİLGİSAYAR MÜHENDİSLİĞİ": "CENG",
        "COMPUTER ENGINEERING": "CENG",
        "YAZILIM MÜHENDİSLİĞİ": "SENG",
        "SOFTWARE ENGINEERING": "SENG",
        "ELEKTRİK ELEKTRONİK MÜHENDİSLİĞİ": "ECE",
        "ELEKTRİK VE ELEKTRONİK MÜHENDİSLİĞİ": "ECE",
        "ELECTRICAL AND ELECTRONICS ENGINEERING": "ECE",
        "ELECTRICAL & ELECTRONICS ENGINEERING": "ECE",
        "ENDÜSTRİ MÜHENDİSLİĞİ": "IE",
        "INDUSTRIAL ENGINEERING": "IE",
        "MAKİNE MÜHENDİSLİĞİ": "ME",
        "MECHANICAL ENGINEERING": "ME",
        "MEKATRONİK MÜHENDİSLİĞİ": "MECE",
        "MECHATRONICS ENGINEERING": "MECE",
        "İNŞAAT MÜHENDİSLİĞİ": "CE",
        "CIVIL ENGINEERING": "CE",
        "MİMARLIK": "ARCH",
        "ARCHITECTURE": "ARCH",
        "İÇ MİMARLIK": "INAR",
        "INTERIOR ARCHITECTURE": "INAR",
        "ŞEHİR VE BÖLGE PLANLAMA": "CRP",
        "CITY AND REGIONAL PLANNING": "CRP",
        "İŞLETME": "MAN",
        "MANAGEMENT": "MAN",
        "İKTİSAT": "ECON",
        "ECONOMICS": "ECON",
        "ULUSLARARASI TİCARET": "INTT",
        "INTERNATIONAL TRADE": "INTT",
        "SİYASET BİLİMİ VE ULUSLARARASI İLİŞKİLER": "PSIR",
        "POLITICAL SCIENCE AND INTERNATIONAL RELATIONS": "PSIR",
        "HALKLA İLİŞKİLER VE REKLAMCILIK": "PRAD",
        "PUBLIC RELATIONS AND ADVERTISING": "PRAD",
        "HUKUK": "LAW",
        "LAW": "LAW",
        "PSİKOLOJİ": "PSY",
        "PSYCHOLOGY": "PSY",
        "İNGİLİZ DİLİ VE EDEBİYATI": "ELL",
        "ENGLISH LANGUAGE AND LITERATURE": "ELL",
        "ÇEVİRİBİLİM": "TRAN",
        "TRANSLATION": "TRAN",
        "MATEMATİK": "MATH",
        "MATHEMATICS": "MATH",
        "FİZİK": "PHYS",
        "PHYSICS": "PHYS"
    }

    @classmethod
    def parse_file(cls, file_path):
        """Extracts text from file (.pdf, .txt, .html, .json) and parses it."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dosya bulunamadı: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            raw_text = cls.extract_text_from_pdf(file_path)
        else:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    raw_text = f.read()
            except UnicodeDecodeError:
                with open(file_path, 'r', encoding='latin-1') as f:
                    raw_text = f.read()

        return cls.parse_text(raw_text)

    @classmethod
    def extract_text_from_pdf(cls, pdf_path):
        """Extracts text from a PDF file using pypdf if available, or regex text stream fallback."""
        text = ""
        # 1. Try pypdf if installed
        try:
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
            if text.strip():
                return text
        except Exception:
            pass

        # 2. Try PyPDF2
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(pdf_path)
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
            if text.strip():
                return text
        except Exception:
            pass

        # 3. Pure-Python PDF stream fallback (reads uncompressed or deflate text streams)
        try:
            with open(pdf_path, 'rb') as f:
                content = f.read()

            import zlib
            # Find FlateDecode streams
            stream_regex = re.compile(rb'stream\r?\n(.*?)\r?\nendstream', re.DOTALL)
            decompressed_chunks = []
            for match in stream_regex.finditer(content):
                stream_data = match.group(1)
                try:
                    decomp = zlib.decompress(stream_data)
                    decompressed_chunks.append(decomp)
                except Exception:
                    decompressed_chunks.append(stream_data)

            combined_raw = b"\n".join(decompressed_chunks) + b"\n" + content

            # Extract strings inside parentheses ( ... ) Tj or [( ... )] TJ
            tj_regex = re.compile(rb'\((.*?)\)\s*Tj', re.DOTALL)
            extracted_words = []
            for m in tj_regex.finditer(combined_raw):
                try:
                    s = m.group(1).decode('utf-8', errors='ignore')
                    extracted_words.append(s)
                except Exception:
                    pass

            text = " ".join(extracted_words)
        except Exception as e:
            print(f"PDF extraction error: {e}")

        return text

    @staticmethod
    def normalize_turkish_str(s):
        """Normalizes Turkish string for robust casing-independent comparison."""
        if not s:
            return ""
        return (s
                .replace('İ', 'I')
                .replace('ı', 'I')
                .replace('i', 'I')
                .replace('ş', 'S')
                .replace('Ş', 'S')
                .replace('ğ', 'G')
                .replace('Ğ', 'G')
                .replace('ü', 'U')
                .replace('Ü', 'U')
                .replace('ö', 'O')
                .replace('Ö', 'O')
                .replace('ç', 'C')
                .replace('Ç', 'C')
                .upper())

    @classmethod
    def parse_text(cls, text):
        """
        Parses raw transcript text to extract department, secondary program, and courses with grades.
        """
        clean_text = text.replace('\r', ' ')
        norm_tr = cls.normalize_turkish_str(clean_text)

        result = {
            "primary_dept": "",
            "secondary_dept": "YOK",
            "secondary_type": "YOK",
            "student_name": "",
            "student_id": "",
            "passed_courses": {},   # code -> {"grade": ..., "name": ...}
            "failed_courses": {},   # code -> {"grade": ..., "name": ...}
            "all_detected_courses": []
        }

        # 1. Detect Student ID
        id_match = re.search(r'\b(20\d{6,8})\b', text)
        if id_match:
            result["student_id"] = id_match.group(1)

        # 2. Detect Primary Department
        for dept_name, code in cls.DEPARTMENT_NAMES_MAP.items():
            norm_name = cls.normalize_turkish_str(dept_name)
            if norm_name in norm_tr:
                result["primary_dept"] = code
                break

        # Fallback for department detection: look for "BOLUM" / "DEPARTMENT" followed by words
        if not result["primary_dept"]:
            dept_match = re.search(r'(?:BÖLÜM|BOLUM|PROGRAM|DEPARTMENT)\s*[:\-]\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s]+)', text, re.IGNORECASE)
            if dept_match:
                dept_str = cls.normalize_turkish_str(dept_match.group(1).strip())
                for d_name, code in cls.DEPARTMENT_NAMES_MAP.items():
                    norm_d = cls.normalize_turkish_str(d_name)
                    if code == dept_str or norm_d in dept_str:
                        result["primary_dept"] = code
                        break

        # 3. Detect Yandal / ÇAP (Check line-by-line first)
        lines = clean_text.split('\n')
        for line in lines:
            norm_line = cls.normalize_turkish_str(line)
            if "YANDAL" in norm_line or "MINOR" in norm_line:
                result["secondary_type"] = "YANDAL"
                for dept_name, code in cls.DEPARTMENT_NAMES_MAP.items():
                    if code != result["primary_dept"] and cls.normalize_turkish_str(dept_name) in norm_line:
                        result["secondary_dept"] = code
                        break
                if result["secondary_dept"] == "YOK":
                    for dept_name, code in cls.DEPARTMENT_NAMES_MAP.items():
                        if code != result["primary_dept"] and re.search(r'\b' + re.escape(code) + r'\b', norm_line):
                            result["secondary_dept"] = code
                            break

            elif "CIFT ANADAL" in norm_line or "DOUBLE MAJOR" in norm_line or "CAP" in norm_line:
                result["secondary_type"] = "CAP"
                for dept_name, code in cls.DEPARTMENT_NAMES_MAP.items():
                    if code != result["primary_dept"] and cls.normalize_turkish_str(dept_name) in norm_line:
                        result["secondary_dept"] = code
                        break
                if result["secondary_dept"] == "YOK":
                    for dept_name, code in cls.DEPARTMENT_NAMES_MAP.items():
                        if code != result["primary_dept"] and re.search(r'\b' + re.escape(code) + r'\b', norm_line):
                            result["secondary_dept"] = code
                            break

        # 4. Extract Courses and Letter Grades
        # Çankaya course code pattern: 2-5 letters followed by optional space and 3 digits
        # e.g., "CENG111", "CENG 111", "MATH 157", "PHYS131", "AİİT 101", "TURK101"
        course_pattern = re.compile(
            r'\b([A-ZÇĞİÖŞÜ]{2,5})\s*(\d{3})\b.*?\b(AA|BA|BB|CB|CC|DC|DD|FD|FF|NA|S|U|W|P)\b',
            re.IGNORECASE | re.DOTALL
        )

        # Split text into lines or rows for line-by-line parsing first
        lines = clean_text.split('\n')
        detected_courses = {}

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            # Look for course code + grade in the same line
            m = re.search(r'\b([A-Za-zçğıöşüÇĞİÖŞÜ]{2,5})\s*(\d{3})\b', line_str)
            if m:
                dept_part = m.group(1).upper()
                num_part = m.group(2)
                course_code = f"{dept_part}{num_part}"

                # Look for valid grade in this line
                # Search after the course code match
                remainder = line_str[m.end():]
                grade_match = re.search(r'\b(AA|BA|BB|CB|CC|DC|DD|FD|FF|NA|S|U|W|P)\b', remainder, re.IGNORECASE)
                if grade_match:
                    grade = grade_match.group(1).upper()
                    # Also try to extract course title between code and grade
                    name_part = remainder[:grade_match.start()].strip()
                    # Clean unwanted numbers or symbols from name
                    name_clean = re.sub(r'[\d\.\,\;\:\-\|\/\(\)]+', ' ', name_part).strip()

                    detected_courses[course_code] = {
                        "code": course_code,
                        "grade": grade,
                        "name": name_clean or course_code
                    }

        # If line-by-line caught very few courses, try full regex over the entire text
        if len(detected_courses) < 3:
            for m in course_pattern.finditer(clean_text):
                dept_part = m.group(1).upper()
                num_part = m.group(2)
                code = f"{dept_part}{num_part}"
                grade = m.group(3).upper()

                if code not in detected_courses:
                    detected_courses[code] = {
                        "code": code,
                        "grade": grade,
                        "name": code
                    }

        # Categorize into passed vs failed
        for code, info in detected_courses.items():
            grade = info["grade"]
            if grade in cls.PASSING_GRADES:
                result["passed_courses"][code] = info
            else:
                result["failed_courses"][code] = info
            result["all_detected_courses"].append(info)

        return result
