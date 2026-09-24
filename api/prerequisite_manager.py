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
    RULE_METADATA = {}

    @classmethod
    def reload_official_prerequisites(cls):
        """Reloads official prerequisites from cankaya_official_prerequisites.json."""
        try:
            _prereq_path = os.path.join(os.path.dirname(__file__), "cankaya_official_prerequisites.json")
            if os.path.exists(_prereq_path):
                with open(_prereq_path, "r", encoding="utf-8") as _f:
                    _raw_rules = json.load(_f)
                    cls.OFFICIAL_PREREQUISITES.clear()
                    cls.RULE_METADATA.clear()
                    for _code, _item in _raw_rules.items():
                        _code = cls.normalize_code(_code)
                        cls.RULE_METADATA[_code] = _item
                        _r_type = _item.get("type", "AND")
                        if _r_type == 'UNKNOWN':
                            continue
                        _r_courses = _item.get("courses", [])
                        if _r_type == "OR":
                            cls.OFFICIAL_PREREQUISITES[_code] = [tuple(_r_courses)]
                        else:
                            cls.OFFICIAL_PREREQUISITES[_code] = _r_courses
        except Exception as _e:
            print(f"Error loading official prerequisites: {_e}")


    @classmethod
    def normalize_code(cls, code):
        """Normalizes course code by removing spaces and converting to upper case."""
        if not code:
            return ""
        return re.sub(r"\s+", "", code).upper().replace("\u0130", "I")

    @classmethod
    def get_prerequisite_rule(cls, course_code):
        """
        Retrieves the prerequisite requirements for a given course code.
        Uses recorded official rules only. Missing data is unknown, not no prerequisites.
        """
        norm = cls.normalize_code(course_code)
        if norm in cls.OFFICIAL_PREREQUISITES:
            return cls.OFFICIAL_PREREQUISITES[norm]
        return None

    @classmethod
    def format_rule_description(cls, rule_list):
        """Formats a list of requirements into a clear, human-readable string in Turkish."""
        if not rule_list:
            return "Ön koşulsuz"

        parts = []
        for req in rule_list:
            if isinstance(req, dict):
                parts.append(f"({', '.join(req['of'])} derslerinden en az {req['at_least']} tanesi)")
            elif isinstance(req, (tuple, list, set)):
                parts.append("(" + " veya ".join(req) + ")")
            else:
                parts.append(str(req))

        return " ve ".join(parts)

    @classmethod
    def check_prerequisites(cls, course_code, passed_courses, primary_dept=None):
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
        metadata = cls.RULE_METADATA.get(norm_target, {})
        program_rule = metadata.get('program_rules', {}).get(primary_dept)
        if program_rule is not None:
            metadata = program_rule
            courses = metadata.get('courses', [])
            rule = None if metadata.get('type') == 'UNKNOWN' else [tuple(courses)] if metadata.get('type') == 'OR' else courses
        provenance = {'source': metadata.get('source'), 'curriculum': metadata.get('curriculum')}
        corequisites = metadata.get('corequisites', [])
        coreq_missing = [c for c in corequisites if cls.normalize_code(c) not in passed_set]
        coreq_message = 'Eş koşul kontrolü gerekiyor: ' + ', '.join(coreq_missing) + '. Aynı dönem kayıt durumunu danışmanınızla kontrol edin.'
        provenance['corequisites'] = corequisites
        if rule is None:
            return {
                'can_take': None, 'known': False, 'already_passed': already_passed,
                'has_prereqs': None, 'rule_description': 'Ön koşul bilgisi doğrulanmadı',
                'satisfied_prereqs': [], 'missing_prereqs': [],
                'message': metadata.get('reason') or 'Bu dersin ön koşul bilgisi kayıtlı değil. Bölümün güncel müfredatından kontrol edin.',
                **provenance,
            }
        if not rule:
            return {
                'known': not bool(coreq_missing),
                **provenance,
                "can_take": None if coreq_missing else True,
                "already_passed": already_passed,
                "has_prereqs": False,
                "rule_description": "Ön koşulsuz",
                "satisfied_prereqs": [],
                "missing_prereqs": [],
                "message": coreq_message if coreq_missing else "Bu dersin herhangi bir ön koşulu bulunmamaktadır."
            }

        rule_desc = cls.format_rule_description(rule)
        satisfied = []
        missing = []

        for req in rule:
            if isinstance(req, dict):
                completed = sorted(set(req['of']) & passed_set)
                if len(completed) >= req['at_least']:
                    satisfied.extend(completed)
                else:
                    missing.append(req)
            elif isinstance(req, (tuple, list, set)):
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
                if isinstance(m, dict):
                    missing_strs.append(cls.format_rule_description([m]))
                elif isinstance(m, (tuple, list, set)):
                    missing_strs.append("(" + " veya ".join(m) + ")")
                else:
                    missing_strs.append(str(m))
            msg = f"Eksik Ön Koşul: {', '.join(missing_strs)} dersi transkriptinizde verilmemiş!"

        if can_take and coreq_missing:
            can_take = None
            msg = coreq_message

        return {
            'known': can_take is not None,
            **provenance,
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
