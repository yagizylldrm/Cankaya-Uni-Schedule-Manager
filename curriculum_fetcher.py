import urllib.request
import urllib.parse
import urllib.error
import ssl
import json
import os
import re

class CurriculumFetcher:
    """
    Fetches and parses curricula, compulsory courses, technical electives,
    social electives, and prerequisites from Çankaya University Bilgi Paketi API.
    Updates cankaya_official_curricula.json, cankaya_course_details.json,
    and cankaya_official_prerequisites.json.
    """
    BASE_URL = "https://ogbs.cankaya.edu.tr/Api/InformationPack"
    def __init__(self, base_dir=None):
        self.ctx = ssl._create_unverified_context()
        self.base_dir = base_dir or os.path.join(os.path.dirname(os.path.abspath(__file__)), "api")
        self.token = os.environ.get("CANKAYA_EBS_TOKEN", "").strip()
        self.curricula_path = os.path.join(self.base_dir, "cankaya_official_curricula.json")
        self.details_path = os.path.join(self.base_dir, "cankaya_course_details.json")
        self.prereqs_path = os.path.join(self.base_dir, "cankaya_official_prerequisites.json")

    def _api_get(self, endpoint, params=None):
        if not self.token:
            raise RuntimeError("CANKAYA_EBS_TOKEN ortam değişkeni gerekli; mevcut veri değiştirilmedi.")
        if params:
            query = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
            url = f"{self.BASE_URL}{endpoint}?{query}"
        else:
            url = f"{self.BASE_URL}{endpoint}"

        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        })
        try:
            with urllib.request.urlopen(req, context=self.ctx, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise RuntimeError("EBS yetkilendirmesi başarısız; CANKAYA_EBS_TOKEN değerini yenileyin.") from e
            return None
        except Exception:
            return None

    @staticmethod
    def normalize_code(code):
        if not code:
            return ""
        c = re.sub(r'[\s_]+', '', str(code).upper().strip())
        c = c.replace('İ', 'I').replace('İ', 'I')
        return c

    def get_faculties(self, program_type="L"):
        """Returns undergraduate faculties (L = Lisans)."""
        data = self._api_get(f"/Fakulteler?Program={program_type}")
        return data or []

    def get_departments(self, fak_no, program_type="L"):
        """Returns departments for a given faculty."""
        data = self._api_get(f"/Bolumler?Program={program_type}&FakNo={fak_no}")
        return data or []

    def get_curriculums_for_program(self, program_id):
        """Returns list of curriculums for department (e.g. 2026, 2022)."""
        data = self._api_get("/WsPersonel", {"method": 700, "methodNo": 11, "Params": program_id})
        return data or []

    def get_courses_for_curriculum(self, program_id, curriculum_id):
        """Returns raw courses list for a specific curriculum."""
        param_str = f"3;{program_id};{curriculum_id}"
        data = self._api_get("/WsPersonel", {"method": 700, "methodNo": 14, "Params": param_str})
        return data or []

    def get_elective_group_courses(self, bim_kodu, curriculum_id, program_id):
        """Returns specific courses that can be chosen for an elective slot."""
        data = self._api_get("/GrupDersleri", {
            "BimKodu": bim_kodu,
            "MufredatNo": curriculum_id,
            "BolumKodu": program_id
        })
        return data or []

    def _infer_dept_code(self, dept_info):
        """Infers department short code like CENG, SENG, ECE, IE, ME."""
        # Mathematics is deliberately excluded from the generic service-course
        # prefix count below, but it is the owning department of this program.
        name = dept_info["program_name"].upper()
        if "MATEMAT" in name: return "MATH"
        counts = {}
        for c in dept_info["compulsory_courses"]:
            parts = c["code"].split()
            if len(parts) >= 2:
                prefix = parts[0].upper()
                if prefix not in ["MATH", "PHYS", "CHEM", "TURK", "ENG", "ESR", "HIST", "AIIT", "COL"]:
                    counts[prefix] = counts.get(prefix, 0) + 1
        if counts:
            return max(counts, key=counts.get)
        # Fallback from program name
        if "BİLGİSAYAR MÜHENDİSLİĞİ" in name: return "CENG"
        if "YAZILIM MÜHENDİSLİĞİ" in name: return "SENG"
        if "ELEKTRİK-ELEKTRONİK" in name: return "EE"
        if "ENDÜSTRİ" in name: return "IE"
        if "MAKİNE" in name: return "ME"
        if "İNŞAAT" in name: return "CE"
        if "MEKATRONİK" in name: return "MECE"
        if "MİMARLIK" in name: return "ARCH"
        if "İÇ MİMARLIK" in name: return "INAR"
        if "ŞEHİR VE BÖLGE" in name: return "CRP"
        if "İŞLETME" in name: return "MAN"
        if "İKTİSAT" in name: return "ECON"
        if "HUKUK" in name: return "LAW"
        if "PSİKOLOJİ" in name: return "PSY"
        if "MATEMATİK" in name: return "MATH"
        return f"PROG_{dept_info['program_id']}"

    def fetch_all_curricula(self, progress_callback=None, dept_list=None, cancel_check=None,
                            refresh_prerequisites=True):
        """
        Fetches curricula for undergraduate departments from Bilgi Paketi API.
        Merges with existing local files so previous data is not lost.
        Returns: (success: bool, dept_count: int, course_count: int)
        """
        if not self.token:
            raise RuntimeError("CANKAYA_EBS_TOKEN ortam değişkeni gerekli; mevcut veri değiştirilmedi.")
        # 1. Load existing data if available
        all_curricula = {}
        if os.path.exists(self.curricula_path):
            try:
                with open(self.curricula_path, "r", encoding="utf-8") as f:
                    all_curricula = json.load(f)
            except Exception:
                pass

        course_details = {}
        if os.path.exists(self.details_path):
            try:
                with open(self.details_path, "r", encoding="utf-8") as f:
                    course_details = json.load(f)
            except Exception:
                pass

        # Normalize dept_list filter if provided
        norm_dept_filter = None
        if dept_list:
            norm_dept_filter = {self.normalize_code(d) for d in dept_list}
        selected_program_ids = {str(all_curricula[code]["program_id"])
                                for code in (norm_dept_filter or [])
                                if code in all_curricula and all_curricula[code].get("program_id")}

        # 2. Fetch faculties
        if progress_callback:
            progress_callback(0, 100, "Fakülte ve bölüm listesi alınıyor...")

        faculties = self.get_faculties("L")
        if not faculties:
            # If API is unreachable, keep existing cache and report failure.
            return False, len(all_curricula), len(course_details)

        # Collect all departments to fetch
        all_dept_entries = []
        for fak in faculties:
            if cancel_check and cancel_check():
                return False, 0, 0
            fak_no = fak.get("FakNo")
            fak_name = fak.get("FakTurkce", "")
            depts = self.get_departments(fak_no, "L")
            for d in depts:
                all_dept_entries.append((fak_no, fak_name, d))

        total_depts = len(all_dept_entries)
        processed = 0

        for fak_no, fak_name, dept in all_dept_entries:
            if cancel_check and cancel_check():
                return False, 0, 0

            processed += 1
            prog_id = dept.get("ProgramId")
            prog_name = dept.get("ProgramAdi", "")
            if norm_dept_filter and selected_program_ids and str(prog_id) not in selected_program_ids:
                continue

            if progress_callback:
                progress_callback(processed, total_depts, f"Müfredat indiriliyor: {prog_name}")

            currs = self.get_curriculums_for_program(prog_id)
            if not currs or not isinstance(currs, list) or len(currs) == 0:
                continue

            # Latest curriculum
            def curriculum_sort_key(record):
                name = str(record[2]) if len(record) > 2 else ""
                year = re.search(r"20\d{2}", name)
                return (int(year.group()) if year else 0, int(record[0]))

            latest_curr = max(currs, key=curriculum_sort_key)
            curr_id = latest_curr[0]
            curr_name = latest_curr[2] if len(latest_curr) > 2 else str(curr_id)

            raw_courses = self.get_courses_for_curriculum(prog_id, curr_id)
            if not raw_courses or not isinstance(raw_courses, list):
                continue

            dept_info = {
                "program_id": prog_id,
                "program_name": prog_name,
                "faculty_name": fak_name,
                "curriculum_id": str(curr_id),
                "curriculum_name": curr_name,
                "compulsory_courses": [],
                "compulsory_codes": [],
                "elective_slots": [],
                "technical_elective_codes": [],
                "technical_elective_pool": {},
                "social_elective_codes": [],
                "social_elective_pool": {},
                "all_department_courses": {}
            }

            for row in raw_courses:
                if not isinstance(row, list) or len(row) < 9:
                    continue

                bim_kodu = str(row[2])
                term_no = str(row[1])
                year = str(row[3]) if len(row) > 3 else ""
                semester = str(row[4]) if len(row) > 4 else ""
                dept_prefix = str(row[5]).strip()
                course_num = str(row[6]).strip()
                name_tr = str(row[7]).strip()
                name_en = str(row[8]).strip() if len(row) > 8 else ""

                credit = 3
                ects = 5.0
                try:
                    if len(row) > 12 and row[12]:
                        credit = int(float(str(row[12]).replace(',', '.')))
                    if len(row) > 13 and row[13]:
                        ects = float(str(row[13]).replace(',', '.'))
                except Exception:
                    pass

                raw_code = f"{dept_prefix} {course_num}".strip()
                norm_code = self.normalize_code(raw_code)

                is_elective = dept_prefix.upper() == "ELEC" or "seçmeli" in name_tr.lower() or "elective" in name_en.lower()

                course_entry = {
                    "bim_kodu": bim_kodu,
                    "code": raw_code,
                    "norm_code": norm_code,
                    "name_tr": name_tr,
                    "name_en": name_en,
                    "term": term_no,
                    "year": year,
                    "semester": semester,
                    "credit": credit,
                    "ects": ects,
                    "is_elective": is_elective
                }

                dept_info["all_department_courses"][norm_code] = course_entry

                # Add to details
                if norm_code not in course_details:
                    course_details[norm_code] = {
                        "name": f"{name_tr} / {name_en}" if name_en and name_en != name_tr else name_tr,
                        "desc": f"Çankaya Üniversitesi {prog_name} bünyesinde açılan {raw_code} kodlu ders.",
                        "credit": credit,
                        "ects": ects
                    }

                if not is_elective:
                    dept_info["compulsory_courses"].append(course_entry)
                    dept_info["compulsory_codes"].append(norm_code)
                else:
                    is_technical = "teknik" in name_tr.lower() or "technical" in name_en.lower() or "bölüm" in name_tr.lower()
                    slot_category = "TEKNIK_SECMELI" if is_technical else "SOSYAL_SECMELI"
                    course_entry["slot_category"] = slot_category
                    dept_info["elective_slots"].append(course_entry)

                    # Fetch elective group options
                    group_data = self.get_elective_group_courses(bim_kodu, curr_id, prog_id)
                    if group_data and isinstance(group_data, list):
                        for g in group_data:
                            g_code = g.get("DersKod", "").strip()
                            g_norm = self.normalize_code(g_code)
                            g_name_tr = g.get("DersAdıTurkce", "")
                            g_name_en = g.get("DersAdıEng", "")
                            g_cr = g.get("Kredi", 3)
                            g_ec = g.get("ECTSKredi", 5.0)

                            g_entry = {
                                "bim_kodu": g.get("BimKodu"),
                                "code": g_code,
                                "norm_code": g_norm,
                                "name_tr": g_name_tr,
                                "name_en": g_name_en,
                                "credit": g_cr,
                                "ects": g_ec,
                                "slot_name": name_tr,
                                "category": slot_category
                            }

                            if is_technical:
                                dept_info["technical_elective_pool"][g_norm] = g_entry
                                if g_norm not in dept_info["technical_elective_codes"]:
                                    dept_info["technical_elective_codes"].append(g_norm)
                            else:
                                dept_info["social_elective_pool"][g_norm] = g_entry
                                if g_norm not in dept_info["social_elective_codes"]:
                                    dept_info["social_elective_codes"].append(g_norm)

                            if g_norm not in course_details:
                                course_details[g_norm] = {
                                    "name": f"{g_name_tr} / {g_name_en}" if g_name_en else g_name_tr,
                                    "desc": f"Çankaya Üniversitesi {g_code} kodlu seçmeli ders.",
                                    "credit": g_cr,
                                    "ects": g_ec
                                }

            dept_info["elective_count"] = len(dept_info["elective_slots"])
            dept_short = self._infer_dept_code(dept_info)

            # Check if filter applied
            if norm_dept_filter and dept_short not in norm_dept_filter:
                continue

            all_curricula[dept_short] = dept_info

        # 3. Save to disk
        try:
            for path, data in ((self.curricula_path, all_curricula), (self.details_path, course_details)):
                temp = path + '.tmp'
                with open(temp, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                os.replace(temp, path)
        except Exception as e:
            print(f"[CurriculumFetcher] Error saving files: {e}")
            return False, len(all_curricula), len(course_details)

        # 4. Refresh official prerequisites
        if refresh_prerequisites:
            try:
                import refresh_prerequisites
                refresh_prerequisites.main()
            except Exception as e:
                print(f"[CurriculumFetcher] Warning: could not refresh prerequisites: {e}")

        return True, len(all_curricula), len(course_details)
