import re
import os
import json

class PrerequisiteManager:
    """
    Manages course prerequisite rules for Çankaya University.
    Evaluates whether a student with a set of passed courses is eligible to take a course.
    """

    # Official prerequisites loaded directly from Çankaya Bilgi Paketi
    OFFICIAL_PREREQUISITES = {}

    @classmethod
    def reload_official_prerequisites(cls):
        """Reloads official prerequisites from cankaya_official_prerequisites.json."""
        try:
            _prereq_path = os.path.join(os.path.dirname(__file__), "cankaya_official_prerequisites.json")
            if os.path.exists(_prereq_path):
                with open(_prereq_path, "r", encoding="utf-8") as _f:
                    _raw_rules = json.load(_f)
                    cls.OFFICIAL_PREREQUISITES.clear()
                    for _code, _item in _raw_rules.items():
                        _r_type = _item.get("type", "AND")
                        _r_courses = _item.get("courses", [])
                        if _r_type == "OR":
                            cls.OFFICIAL_PREREQUISITES[_code] = [tuple(_r_courses)]
                        else:
                            cls.OFFICIAL_PREREQUISITES[_code] = _r_courses
        except Exception as _e:
            print(f"Error loading official prerequisites: {_e}")


    # Rule format:
    # "COURSE": [req1, req2, ...]  (ALL required - AND)
    # A req can be:
    # - str: e.g. "CENG161" (must be passed)
    # - tuple: e.g. ("MATH157", "MATH119") (ANY one must be passed - OR)
    PREREQUISITE_DATABASE = {
        # --- COMPUTER ENGINEERING (CENG) ---
        "CENG162": ["CENG161"],
        "CENG213": ["CENG162"],
        "CENG218": [("CENG161", "CENG162")],
        "CENG236": ["CENG235"],
        "CENG313": ["CENG213"],
        "CENG315": ["CENG213", ("MATH157", "MATH119", "MATH158")],
        "CENG331": ["CENG236"],
        "CENG351": ["CENG213"],
        "CENG382": ["CENG162"],
        "CENG391": ["CENG213"],
        "CENG407": [("CENG315", "CENG391")],
        "CENG408": ["CENG407"],
        "CENG421": ["CENG213"],
        "CENG424": ["CENG213"],
        "CENG435": ["CENG213"],
        "CENG462": ["CENG213"],
        "CENG477": ["CENG213", ("MATH221", "MATH157")],

        # --- SOFTWARE ENGINEERING (SENG) ---
        "SENG102": [("SENG101", "CENG161")],
        "SENG201": [("SENG102", "CENG162")],
        "SENG211": [("SENG102", "CENG162")],
        "SENG301": ["SENG201"],
        "SENG305": ["SENG201"],
        "SENG315": [("SENG211", "CENG213")],
        "SENG384": ["SENG201"],
        "SENG407": [("SENG301", "SENG315")],
        "SENG408": ["SENG407"],

        # --- ELECTRICAL & ELECTRONICS (ECE / EE) ---
        "EE202": ["EE201"],
        "EE206": [("EE205", "EE201")],
        "EE212": ["EE201"],
        "EE214": [("EE205", "EE201")],
        "EE301": [("MATH205", "MATH219", "EE201", "EE205")],
        "EE302": ["EE301"],
        "EE303": ["PHYS132", ("MATH205", "MATH219")],
        "EE304": ["EE303"],
        "EE311": [("EE212", "EE214")],
        "EE312": ["EE311"],
        "EE331": [("EE201", "EE205")],
        "EE342": ["EE301"],
        "EE407": ["EE301"],
        "EE408": ["EE407"],

        # --- INDUSTRIAL ENGINEERING (IE) ---
        "IE202": ["IE201"],
        "IE220": [("MATH158", "MATH120", "MATH119")],
        "IE222": ["IE220"],
        "IE301": ["IE202"],
        "IE302": ["IE301"],
        "IE303": ["IE202"],
        "IE321": ["IE222"],
        "IE323": ["IE222"],
        "IE407": ["IE301"],
        "IE408": ["IE407"],

        # --- MECHANICAL & MECHATRONICS (ME / MECE) ---
        "ME204": ["ME203"],
        "ME206": ["ME203"],
        "ME210": ["ME203"],
        "ME211": ["ME203"],
        "ME215": ["ME203"],
        "ME301": [("ME206", "ME215", "MATH205", "MATH219")],
        "ME302": [("ME301", "ME205")],
        "ME303": ["ME204"],
        "ME307": [("ME204", "ME210")],
        "ME308": ["ME307"],
        "ME313": ["ME301"],
        "ME331": ["ME301"],
        "ME407": [("ME307", "ME308")],
        "ME408": ["ME407"],
        "MECE210": ["MECE203"],
        "MECE301": ["MECE203"],
        "MECE302": ["MECE301"],
        "MECE307": ["MECE210"],
        "MECE308": ["MECE307"],
        "MECE407": ["MECE307"],
        "MECE408": ["MECE407"],

        # --- CIVIL ENGINEERING (CE) ---
        "CE224": ["CE221"],
        "CE241": ["CE221"],
        "CE335": ["CE241"],
        "CE361": ["CE224"],
        "CE371": ["CE224"],
        "CE381": ["CE361"],
        "CE415": ["CE381"],
        "CE417": ["CE381"],

        # --- MATHEMATICS & BASIC SCIENCES ---
        "MATH158": [("MATH157", "MATH119")],
        "MATH120": ["MATH119"],
        "MATH112": ["MATH111"],
        "MATH114": ["MATH113"],
        "MATH104": ["MATH103"],
        "MATH106": ["MATH105"],
        "MATH205": [("MATH158", "MATH157", "MATH119", "MATH120")],
        "MATH219": [("MATH158", "MATH120")],
        "MATH221": [("MATH157", "MATH119", "MATH158")],
        "PHYS132": ["PHYS131"],
        "PHYS122": ["PHYS121"],
        "CHEM104": ["CHEM103"],

        # --- LANGUAGES & UNIVERSITY COMMON ---
        "ENG122": ["ENG121"],
        "ENG112": ["ENG111"],
        "ENG222": ["ENG221"],
        "TURK102": ["TURK101"],
        "AİİT102": ["AİİT101"],
        "HIST102": ["HIST101"],

        # --- ECONOMICS & BUSINESS (ECON, MAN, INTT, MIS) ---
        "ECON102": ["ECON101"],
        "ECON202": ["ECON201"],
        "ECON204": ["ECON203"],
        "ECON302": ["ECON301"],
        "MAN102": ["MAN101"],
        "MAN202": ["MAN201"],
        "MAN206": ["MAN205"],
        "STAT202": ["STAT201"],
        "STAT206": ["STAT205"],
        "INTT202": ["INTT201"],
        "INTT302": ["INTT301"],
        "MIS102": ["MIS101"],
        "MIS202": ["MIS201"],

        # --- LAW (LAW / HUK) ---
        "HUK102": ["HUK101"],
        "HUK202": ["HUK201"],
        "HUK302": ["HUK301"],
        "HUK402": ["HUK401"],
        "LAW102": ["LAW101"],
        "LAW202": ["LAW201"],
        "LAW302": ["LAW301"],
        "LAW402": ["LAW401"]
    }

    @classmethod
    def normalize_code(cls, code):
        """Normalizes course code by removing spaces and converting to upper case."""
        if not code:
            return ""
        return code.replace(" ", "").strip().upper()

    @classmethod
    def get_prerequisite_rule(cls, course_code):
        """
        Retrieves the prerequisite requirements for a given course code.
        Checks official Bilgi Paketi rules first, then fallback database,
        and finally attempts intelligent sequential heuristics.
        """
        norm = cls.normalize_code(course_code)
        if norm in cls.OFFICIAL_PREREQUISITES:
            return cls.OFFICIAL_PREREQUISITES[norm]
        if norm in cls.PREREQUISITE_DATABASE:
            return cls.PREREQUISITE_DATABASE[norm]

        # Heuristic rules for common course series
        match = re.match(r'^([A-ZÇĞİÖŞÜ]+)(\d+)$', norm)
        if match:
            dept = match.group(1)
            num = int(match.group(2))

            # Sequence ending in 2 requires 1 e.g. ABC102 -> ABC101, ABC122 -> ABC121
            if num % 10 == 2 and num > 10:
                prev_code = f"{dept}{num - 1}"
                return [prev_code]

            # Senior capstone project 408 -> 407
            if num == 408:
                return [f"{dept}407"]

            # Differential equations 205 -> 158 or 157
            if num == 205:
                return [(f"{dept}158", f"{dept}157", "MATH158", "MATH157")]

        return []

    @classmethod
    def format_rule_description(cls, rule_list):
        """Formats a list of requirements into a clear, human-readable string in Turkish."""
        if not rule_list:
            return "Ön koşulsuz"

        parts = []
        for req in rule_list:
            if isinstance(req, (tuple, list, set)):
                parts.append("(" + " veya ".join(req) + ")")
            else:
                parts.append(str(req))

        return " ve ".join(parts)

    @classmethod
    def check_prerequisites(cls, course_code, passed_courses):
        """
        Checks if the student with passed_courses (set or dict of passed course codes)
        satisfies the prerequisites for course_code.

        Returns:
        {
            "can_take": bool,
            "has_prereqs": bool,
            "rule_description": str,
            "satisfied_prereqs": list,
            "missing_prereqs": list,
            "message": str
        }
        """
        norm_target = cls.normalize_code(course_code)

        # Normalize passed courses set
        if isinstance(passed_courses, dict):
            passed_set = {cls.normalize_code(c) for c in passed_courses.keys()}
        elif isinstance(passed_courses, (list, set, tuple)):
            passed_set = {cls.normalize_code(c) for c in passed_courses}
        else:
            passed_set = set()

        # If the student already passed this course, they don't need to take it again (or can take it for grade renewal)
        already_passed = norm_target in passed_set

        rule = cls.get_prerequisite_rule(norm_target)
        if not rule:
            return {
                "can_take": True,
                "already_passed": already_passed,
                "has_prereqs": False,
                "rule_description": "Ön koşulsuz",
                "satisfied_prereqs": [],
                "missing_prereqs": [],
                "message": "Bu dersin herhangi bir ön koşulu bulunmamaktadır."
            }

        rule_desc = cls.format_rule_description(rule)
        satisfied = []
        missing = []

        for req in rule:
            if isinstance(req, (tuple, list, set)):
                # OR condition: At least one must be passed
                found = False
                matched_course = ""
                for alt in req:
                    if cls.normalize_code(alt) in passed_set:
                        found = True
                        matched_course = alt
                        break
                if found:
                    satisfied.append(matched_course)
                else:
                    missing.append(req)
            else:
                # AND condition: Must be passed
                req_norm = cls.normalize_code(req)
                if req_norm in passed_set:
                    satisfied.append(req)
                else:
                    missing.append(req)

        can_take = len(missing) == 0

        if can_take:
            msg = f"Ön koşul sağlandı: {', '.join(satisfied) if satisfied else 'Gerekli dersler tamam'}"
        else:
            missing_strs = []
            for m in missing:
                if isinstance(m, (tuple, list, set)):
                    missing_strs.append("(" + " veya ".join(m) + ")")
                else:
                    missing_strs.append(str(m))
            msg = f"Eksik Ön Koşul: {', '.join(missing_strs)} dersi transkriptinizde verilmemiş!"

        return {
            "can_take": can_take,
            "already_passed": already_passed,
            "has_prereqs": True,
            "rule_description": rule_desc,
            "satisfied_prereqs": satisfied,
            "missing_prereqs": missing,
            "message": msg
        }


# Initial load of official prerequisites
PrerequisiteManager.reload_official_prerequisites()
