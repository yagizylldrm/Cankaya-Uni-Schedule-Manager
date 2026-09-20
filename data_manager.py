import json
import os
import re

class ScheduleSlot:
    def __init__(self, day, time_slot, classroom=""):
        self.day = day              # e.g. "Pazartesi", "Salı"
        self.time_slot = time_slot  # e.g. "09:00/09:20"
        self.classroom = classroom  # e.g. "LA01", "B-102", "Online" or ""

    def to_dict(self):
        d = {"day": self.day, "time_slot": self.time_slot}
        if self.classroom:
            d["classroom"] = self.classroom
        return d

    @classmethod
    def from_dict(cls, d):
        return cls(d["day"], d["time_slot"], d.get("classroom", ""))


class Section:
    def __init__(self, course_code, section_no, instructor="Belirsiz", classroom="", slots=None):
        self.course_code = course_code
        self.section_no = str(section_no)
        self.instructor = instructor
        self.classroom = classroom
        self.slots = slots or []  # List of ScheduleSlot objects

    def add_slot(self, day, time_slot, classroom=""):
        for s in self.slots:
            if s.day == day and s.time_slot == time_slot:
                if classroom and not s.classroom:
                    s.classroom = classroom
                return
        self.slots.append(ScheduleSlot(day, time_slot, classroom))
        if classroom and not self.classroom:
            self.classroom = classroom

    def to_dict(self):
        d = {
            "course_code": self.course_code,
            "section_no": self.section_no,
            "instructor": self.instructor,
            "slots": [s.to_dict() for s in self.slots]
        }
        if self.classroom:
            d["classroom"] = self.classroom
        return d

    @classmethod
    def from_dict(cls, d):
        sec = cls(d["course_code"], d["section_no"], d.get("instructor", "Belirsiz"), d.get("classroom", ""))
        sec.slots = [ScheduleSlot.from_dict(s) for s in d.get("slots", [])]
        return sec


class Course:
    def __init__(self, code, dept_code=""):
        self.code = code  # e.g. "CENG111"
        self.dept_code = dept_code or self.extract_dept_code(code)
        self.sections = {}  # section_no -> Section object

    @staticmethod
    def extract_dept_code(code):
        match = re.match(r'^([A-ZÇĞİÖŞÜa-zçğıöşü]+)', code)
        return match.group(1).upper() if match else ""

    @staticmethod
    def extract_course_level(code):
        """Extracts the numeric course level e.g. CENG111 -> 111, MATH219 -> 219."""
        match = re.search(r'(\d+)', code)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        return 0

    def get_or_create_section(self, section_no, instructor="Belirsiz", classroom=""):
        sec_str = str(section_no)
        if sec_str not in self.sections:
            self.sections[sec_str] = Section(self.code, sec_str, instructor, classroom)
        else:
            if instructor and instructor != "Belirsiz" and self.sections[sec_str].instructor == "Belirsiz":
                self.sections[sec_str].instructor = instructor
            if classroom and not self.sections[sec_str].classroom:
                self.sections[sec_str].classroom = classroom
        return self.sections[sec_str]

    def to_dict(self):
        return {
            "code": self.code,
            "dept_code": self.dept_code,
            "sections": {sec_no: sec.to_dict() for sec_no, sec in self.sections.items()}
        }

    @classmethod
    def from_dict(cls, d):
        c = cls(d["code"], d.get("dept_code", ""))
        for sec_no, sec_data in d.get("sections", {}).items():
            c.sections[str(sec_no)] = Section.from_dict(sec_data)
        return c


class DataManager:
    DEFAULT_CACHE_FILE = "cankaya_courses.json"
    PROFILE_CACHE_FILE = "student_profile.json"

    @staticmethod
    def normalize_code(code):
        """Normalizes course code by removing spaces and standardizing Turkish I/İ characters."""
        c = re.sub(r'[\s_]+', '', code.upper())
        c = c.replace('İ', 'I').replace('İ', 'I')
        return c

    # Common university compulsory courses for all departments in Çankaya University
    COMMON_UNIVERSITY_COMPULSORY = {
        "AIIT101", "AIIT102", "HIST201", "HIST202", "HIST205",
        "TURK101", "TURK102", "TURK103", "TURK105", "TURK107",
        "ENG109", "ENG121", "ENG122", "ENG209", "ENG210", "ENG221", "ENG321", "ING101"
    }

    # Faculty of Engineering departments
    ENGINEERING_DEPTS = {"CENG", "SENG", "EE", "IE", "ME", "MECE", "CE", "CEC", "MSE"}

    # Common compulsory courses across all engineering departments at Çankaya
    ENGINEERING_COMMON_COMPULSORY = {
        "MATH157", "MATH158", "MATH205", "MATH221", "MATH251", "MATH254",
        "PHYS131", "PHYS132", "CHEM103", "STAT201", "STAT205",
        "CENG105", "CENG161"
    }

    # Faculty of Economics and Administrative Sciences (İİBF) departments
    IIBF_DEPTS = {"MAN", "ECON", "INTT", "BAF", "PSI", "HİR"}

    # Common compulsory courses across İİBF departments
    IIBF_COMMON_COMPULSORY = {
        "ECON101", "ECON102", "ECON104", "MAN101", "MAN102", "MAN103",
        "MATH103", "MATH105", "MATH107", "MATH111", "MATH113",
        "STAT201", "STAT205", "LAW101", "HUK101", "HUK103", "HUK111",
        "CENG105", "MIS101"
    }

    # Department-specific curriculum definitions (Çankaya University)
    DEPARTMENT_CURRICULUM = {
        "CENG": {
            "compulsory_other": {
                "MATH157", "MATH158", "MATH205", "MATH221", "MATH251", "MATH254",
                "PHYS131", "PHYS132", "CHEM103", "STAT201", "STAT205",
                "EE200", "EE203", "EE209"
            },
            "compulsory_own": {
                "CENG105", "CENG111", "CENG154", "CENG161", "CENG162",
                "CENG235", "CENG241", "CENG329", "CENG361", "CENG383", "CENG393",
                "CENG403", "CENG407", "CENG491"
            }
        },
        "SENG": {
            "compulsory_other": {
                "CENG105", "CENG111", "CENG154", "CENG161", "CENG162",
                "CENG235", "CENG241", "CENG329", "CENG361", "CENG383", "CENG393",
                "MATH157", "MATH158", "MATH205", "MATH221", "MATH251", "MATH254",
                "PHYS131", "PHYS132", "CHEM103", "STAT201", "STAT205",
                "EE200", "EE209"
            },
            "compulsory_own": {
                "SENG101", "SENG201", "SENG203", "SENG206", "SENG216", "SENG271",
                "SENG301", "SENG303", "SENG315", "SENG383", "SENG407", "SENG408"
            }
        },
        "EE": {
            "compulsory_other": {
                "CENG105", "CENG161", "CENG162", "CENG235",
                "MATH157", "MATH158", "MATH205", "MATH221", "MATH251", "MATH254",
                "PHYS131", "PHYS132", "CHEM103", "STAT201", "STAT205"
            },
            "compulsory_own": {
                "EE101", "EE103", "EE200", "EE203", "EE205", "EE209", "EE213",
                "EE300", "EE301", "EE309", "EE315", "EE321", "EE402", "EE407"
            }
        },
        "IE": {
            "compulsory_other": {
                "CENG105", "CENG161", "ECON101", "MAN101",
                "MATH157", "MATH158", "MATH205", "MATH221",
                "PHYS131", "PHYS132", "CHEM103", "STAT201", "STAT205"
            },
            "compulsory_own": {
                "IE117", "IE227", "IE241", "IE333", "IE334", "IE341", "IE345", "IE365",
                "IE404", "IE407"
            }
        },
        "ME": {
            "compulsory_other": {
                "CENG105", "CENG161", "EE200", "EE209",
                "MATH157", "MATH158", "MATH205", "MATH221",
                "PHYS131", "PHYS132", "CHEM103", "STAT201", "STAT205"
            },
            "compulsory_own": {
                "ME113", "ME198", "ME203", "ME205", "ME210", "ME211", "ME215", "ME225",
                "ME301", "ME303", "ME307", "ME313", "ME331", "ME403", "ME407"
            }
        },
        "MECE": {
            "compulsory_other": {
                "CENG161", "CENG162", "CENG235", "EE200", "EE203", "EE205",
                "ME203", "ME205", "ME210", "MATH157", "MATH158", "MATH205", "MATH221",
                "PHYS131", "PHYS132", "CHEM103"
            },
            "compulsory_own": {
                "MECE101", "MECE113", "MECE200", "MECE203", "MECE210", "MECE223", "MECE235",
                "MECE300", "MECE301", "MECE307", "MECE309", "MECE349", "MECE386",
                "MECE401", "MECE407", "MECE408"
            }
        },
        "CE": {
            "compulsory_other": {
                "CENG105", "CENG161", "MATH157", "MATH158", "MATH205", "MATH221",
                "PHYS131", "PHYS132", "CHEM103", "STAT201", "STAT205"
            },
            "compulsory_own": {
                "CE115", "CE221", "CE224", "CE241", "CE255", "CE270", "CE301", "CE335",
                "CE361", "CE371", "CE381", "CE415", "CE417",
                "CEC103", "CEC104", "CEC108", "CEC109", "CEC111", "CEC112",
                "CEC210", "CEC211", "CEC212", "CEC214", "CEC216", "CEC217",
                "CEC224", "CEC226", "CEC227"
            }
        },
        "MAN": {
            "compulsory_other": {
                "ECON101", "ECON104", "MATH103", "MATH105", "MATH107", "MATH111", "MATH113",
                "STAT201", "STAT205", "LAW101", "HUK101", "HUK103", "HUK111",
                "CENG105", "MIS101"
            },
            "compulsory_own": {
                "MAN101", "MAN103", "MAN201", "MAN205", "MAN209", "MAN211",
                "MAN305", "MAN307", "MAN317", "MAN401", "MAN406"
            }
        },
        "ECON": {
            "compulsory_other": {
                "MAN101", "MAN103", "MAN201", "MATH103", "MATH105", "MATH107", "MATH111", "MATH113",
                "STAT201", "STAT205", "LAW101", "HUK101", "HUK103", "HUK111",
                "CENG105"
            },
            "compulsory_own": {
                "ECON101", "ECON104", "ECON205", "ECON207", "ECON209", "ECON213", "ECON223",
                "ECON305", "ECON311", "ECON316", "ECON317", "ECON407"
            }
        },
        "INTT": {
            "compulsory_other": {
                "ECON101", "ECON104", "MAN101", "MAN103", "MAN201",
                "MATH103", "MATH105", "MATH107", "MATH111", "MATH113",
                "STAT201", "STAT205", "LAW101", "HUK101", "HUK103", "HUK111",
                "CENG105"
            },
            "compulsory_own": {
                "INTT101", "INTT105", "INTT233", "INTT237", "INTT305", "INTT309",
                "INTT313", "INTT323", "INTT333", "INTT337", "INTT401", "INTT403"
            }
        },
        "PSI": {
            "compulsory_other": {
                "ECON101", "ECON104", "HIST201", "HIST202", "LAW101",
                "HUK101", "HUK103", "HUK111"
            },
            "compulsory_own": {
                "PSI101", "PSI103", "PSI201", "PSI203", "PSI205",
                "PSI301", "PSI303", "PSI322", "PSI329", "PSI401", "PSI403"
            }
        },
        "PSY": {
            "compulsory_other": {
                "STAT201", "STAT205", "BIO101"
            },
            "compulsory_own": {
                "PSY101", "PSY113", "PSY215", "PSY221", "PSY243", "PSY251",
                "PSY331", "PSY335", "PSY341", "PSY381", "PSY405", "PSY410"
            }
        },
        "ARCH": {
            "compulsory_other": {
                "INAR101", "INAR141", "MATH103", "MATH105", "MATH157", "PHYS105", "PHYS131"
            },
            "compulsory_own": {
                "ARCH101", "ARCH103", "ARCH121", "ARCH131", "ARCH139",
                "ARCH201", "ARCH203", "ARCH205", "ARCH207", "ARCH225", "ARCH233", "ARCH245", "ARCH291",
                "ARCH301", "ARCH304", "ARCH305", "ARCH311", "ARCH315", "ARCH319", "ARCH355",
                "ARCH401", "ARCH407"
            }
        },
        "INAR": {
            "compulsory_other": {
                "ARCH101", "ARCH103", "ARCH121", "MATH103", "MATH105", "MATH157"
            },
            "compulsory_own": {
                "INAR101", "INAR141", "INAR165", "INAR171", "INAR185",
                "INAR201", "INAR219", "INAR261", "INAR285", "INAR291", "INAR295",
                "INAR301", "INAR337", "INAR355", "INAR366", "INAR369", "INAR370",
                "INAR371", "INAR372", "INAR373", "INAR377", "INAR381", "INAR390",
                "INAR392", "INAR393", "INAR395", "INAR401", "INAR461", "INAR491"
            }
        },
        "LAW": {
            "compulsory_other": {
                "TURK101", "TURK102", "HIST201", "HIST202", "ENG109", "ENG121"
            },
            "compulsory_own": {
                "HUK103", "HUK111", "HUK113", "HUK121", "HUK123", "HUK125",
                "HUK143", "HUK145", "HUK147", "HUK155", "HUK207", "HUK213",
                "HUK217", "HUK231", "HUK241", "HUK261", "HUK301", "HUK313",
                "HUK315", "HUK317", "HUK321", "HUK331", "HUK361", "HUK371",
                "HUK415", "HUK417", "HUK419", "HUK421", "HUK429", "HUK431",
                "LAW101", "LAW201", "LAW301"
            }
        },
        "HUK": {
            "compulsory_other": {
                "TURK101", "TURK102", "HIST201", "HIST202", "ENG109", "ENG121"
            },
            "compulsory_own": {
                "HUK103", "HUK111", "HUK113", "HUK121", "HUK123", "HUK125",
                "HUK143", "HUK145", "HUK147", "HUK155", "HUK207", "HUK213",
                "HUK217", "HUK231", "HUK241", "HUK261", "HUK301", "HUK313",
                "HUK315", "HUK317", "HUK321", "HUK331", "HUK361", "HUK371",
                "HUK415", "HUK417", "HUK419", "HUK421", "HUK429", "HUK431",
                "LAW101", "LAW201", "LAW301"
            }
        },
        "MATH": {
            "compulsory_other": {
                "CENG161", "CENG162", "PHYS131", "PHYS132"
            },
            "compulsory_own": {
                "MATH103", "MATH105", "MATH111", "MATH113", "MATH141", "MATH153",
                "MATH157", "MATH158", "MATH201", "MATH205", "MATH221", "MATH223",
                "MATH233", "MATH243", "MATH251", "MATH253", "MATH254", "MATH311",
                "MATH315", "MATH327", "MATH329", "MATH355", "MATH408", "MATH451"
            }
        },
        "ELL": {
            "compulsory_other": {
                "TURK101", "TURK102", "HIST201", "HIST202"
            },
            "compulsory_own": {
                "ELL121", "ELL123", "ELL125", "ELL131", "ELL133", "ELL223",
                "ELL225", "ELL233", "ELL237", "ELL331", "ELL341", "ELL365",
                "ELL372", "ELL381", "ELL391", "ELL431", "ELL467", "ELL471"
            }
        },
        "HİR": {
            "compulsory_other": {
                "ECON101", "MAN101", "TURK101", "TURK102", "HIST201", "HIST202", "ENG121", "ENG122"
            },
            "compulsory_own": {
                "HİR101", "HİR107", "HİR111", "HİR113", "HİR115", "HİR204",
                "HİR207", "HİR209", "HİR211", "HİR213", "HİR303", "HİR305",
                "HİR309", "HİR311", "HİR315", "HİR320", "HİR401", "HİR403", "HİR405"
            }
        }
    }

    # General Yandal (Minor) packages (typically 5 to 7 specific core courses)
    YANDAL_GENERAL_PACKAGES = {
        "SENG": {"SENG101", "SENG201", "SENG203", "SENG271", "SENG301", "SENG303", "SENG315"},
        "CENG": {"CENG161", "CENG162", "CENG154", "CENG235", "CENG241", "CENG361", "CENG383"},
        "EE": {"EE101", "EE103", "EE200", "EE203", "EE205", "EE213", "EE301", "EE309"},
        "IE": {"IE117", "IE227", "IE241", "IE333", "IE341", "IE345", "IE365"},
        "ME": {"ME113", "ME203", "ME205", "ME210", "ME301", "ME303", "ME307"},
        "MECE": {"MECE101", "MECE200", "MECE203", "MECE210", "MECE223", "MECE301", "MECE307"},
        "CE": {"CE115", "CE221", "CE224", "CE241", "CE255", "CE270", "CE301"},
        "MATH": {"MATH141", "MATH153", "MATH201", "MATH202", "MATH221", "MATH251", "MATH311", "MATH315", "MATH327"},
        "MAN": {"MAN101", "MAN201", "MAN205", "MAN305", "MAN307", "MAN317", "MAN401"},
        "ECON": {"ECON101", "ECON104", "ECON205", "ECON207", "ECON305", "ECON311"},
        "INTT": {"INTT101", "INTT105", "INTT233", "INTT237", "INTT305", "INTT309"},
        "PSI": {"PSI101", "PSI103", "PSI201", "PSI203", "PSI301", "PSI303"},
        "PSY": {"PSY101", "PSY113", "PSY215", "PSY221", "PSY243", "PSY251"},
        "HUK": {"HUK103", "HUK111", "HUK121", "HUK143", "HUK207", "HUK213", "HUK231"},
        "LAW": {"LAW101", "LAW201", "HUK103", "HUK111", "HUK121", "HUK207"},
        "ARCH": {"ARCH101", "ARCH103", "ARCH121", "ARCH131", "ARCH201", "ARCH203"},
        "INAR": {"INAR101", "INAR141", "INAR165", "INAR171", "INAR201", "INAR219"},
        "ELL": {"ELL121", "ELL123", "ELL125", "ELL131", "ELL223", "ELL233"}
    }

    # Department combination-specific Yandal exemptions and customized packages
    # (Primary, Secondary Minor): Set of mandatory courses
    YANDAL_COMBINATION_PACKAGES = {
        # CENG students doing SENG minor: they already have programming and discrete math, so they take SENG core:
        ("CENG", "SENG"): {"SENG101", "SENG201", "SENG203", "SENG206", "SENG216", "SENG271", "SENG301", "SENG303", "SENG315"},
        # SENG students doing CENG minor: they already have programming, so they take CENG hardware/systems:
        ("SENG", "CENG"): {"CENG235", "CENG329", "CENG361", "CENG383", "CENG403"},
        # CENG/SENG students doing MATH minor: they already take MATH157, 158, 205, 221:
        ("CENG", "MATH"): {"MATH141", "MATH153", "MATH201", "MATH202", "MATH311", "MATH315", "MATH327", "MATH329"},
        ("SENG", "MATH"): {"MATH141", "MATH153", "MATH201", "MATH202", "MATH311", "MATH315", "MATH327", "MATH329"},
        # Engineering students doing MAN minor:
        ("CENG", "MAN"): {"MAN101", "MAN201", "MAN205", "MAN305", "MAN307", "MAN317"},
        ("SENG", "MAN"): {"MAN101", "MAN201", "MAN205", "MAN305", "MAN307", "MAN317"},
        ("IE", "MAN"): {"MAN201", "MAN205", "MAN305", "MAN307", "MAN317", "MAN401"},
        ("EE", "MAN"): {"MAN101", "MAN201", "MAN205", "MAN305", "MAN307", "MAN317"},
        ("ME", "MAN"): {"MAN101", "MAN201", "MAN205", "MAN305", "MAN307", "MAN317"},
        # Engineering students doing ECON minor:
        ("CENG", "ECON"): {"ECON101", "ECON104", "ECON205", "ECON207", "ECON305", "ECON311"},
        ("IE", "ECON"): {"ECON205", "ECON207", "ECON305", "ECON311", "ECON316", "ECON317"},
        # Engineering students doing EE/CENG/IE minor:
        ("CENG", "EE"): {"EE101", "EE103", "EE203", "EE205", "EE213", "EE301", "EE309"},
        ("EE", "CENG"): {"CENG161", "CENG162", "CENG241", "CENG361", "CENG383"},
        ("IE", "CENG"): {"CENG161", "CENG162", "CENG241", "CENG235", "CENG361"},
        ("ME", "MECE"): {"MECE101", "MECE200", "MECE223", "MECE235", "MECE301", "MECE307"},
        ("MECE", "ME"): {"ME113", "ME211", "ME215", "ME301", "ME303", "ME307"},
    }

    # Known Course Credits: (Local Credit, ECTS / AKTS) for Çankaya University
    KNOWN_COURSE_CREDITS = {
        # Common university compulsory
        "HIST201": (2, 2), "HIST202": (2, 2), "HIST205": (2, 2),
        "TURK101": (2, 2), "TURK102": (2, 2), "TURK103": (2, 2), "TURK105": (2, 2), "TURK107": (2, 2),
        "AIIT101": (2, 2), "AIIT102": (2, 2),
        "ENG109": (3, 3), "ENG121": (3, 4), "ENG122": (3, 4), "ENG209": (3, 4), "ENG210": (3, 4),
        "ENG221": (3, 4), "ENG321": (3, 4), "ING101": (3, 3),

        # Engineering & Science common
        "MATH157": (4, 7), "MATH158": (4, 7), "MATH205": (3, 6), "MATH221": (3, 5),
        "MATH251": (3, 5), "MATH254": (3, 6), "PHYS131": (4, 6), "PHYS132": (4, 6),
        "PHYS105": (3, 4), "CHEM103": (4, 5), "STAT201": (3, 5), "STAT205": (3, 5),

        # Computer Engineering (CENG)
        "CENG105": (3, 5), "CENG111": (3, 6), "CENG154": (3, 5), "CENG161": (4, 6),
        "CENG162": (4, 6), "CENG235": (3, 5), "CENG241": (3, 6), "CENG329": (3, 5),
        "CENG361": (3, 6), "CENG383": (3, 5), "CENG393": (1, 2), "CENG403": (3, 5),
        "CENG407": (4, 8), "CENG408": (4, 8), "CENG491": (4, 8), "CENG492": (4, 8),

        # Software Engineering (SENG)
        "SENG101": (3, 5), "SENG201": (3, 5), "SENG203": (3, 6), "SENG206": (3, 5),
        "SENG216": (3, 5), "SENG271": (3, 5), "SENG301": (3, 6), "SENG303": (3, 5),
        "SENG315": (3, 5), "SENG383": (3, 5), "SENG407": (4, 8), "SENG408": (4, 8),

        # Electrical & Electronics (EE)
        "EE101": (3, 5), "EE103": (3, 5), "EE200": (3, 5), "EE203": (4, 6), "EE205": (3, 5),
        "EE209": (3, 5), "EE213": (3, 5), "EE300": (3, 5), "EE301": (3, 6), "EE309": (4, 6),
        "EE315": (3, 5), "EE321": (3, 5), "EE402": (3, 5), "EE407": (4, 8), "EE408": (4, 8),

        # Industrial Engineering (IE)
        "IE117": (3, 5), "IE227": (3, 5), "IE241": (3, 5), "IE333": (3, 6), "IE334": (3, 6),
        "IE341": (3, 5), "IE345": (3, 5), "IE365": (3, 5), "IE404": (3, 5), "IE407": (4, 8), "IE408": (4, 8),

        # Mechanical / Mechatronics (ME / MECE)
        "ME113": (3, 5), "ME198": (1, 2), "ME203": (3, 5), "ME205": (3, 5), "ME210": (3, 5),
        "ME211": (3, 5), "ME215": (3, 5), "ME225": (3, 5), "ME301": (3, 6), "ME303": (3, 5),
        "ME307": (3, 5), "ME313": (3, 5), "ME331": (3, 5), "ME403": (3, 5), "ME407": (4, 8),
        "MECE101": (3, 5), "MECE113": (3, 5), "MECE200": (3, 5), "MECE203": (3, 5),
        "MECE210": (3, 5), "MECE223": (3, 5), "MECE235": (3, 5), "MECE300": (3, 5),
        "MECE301": (3, 6), "MECE307": (3, 5), "MECE309": (3, 5), "MECE349": (3, 5),
        "MECE386": (3, 5), "MECE401": (3, 5), "MECE407": (4, 8), "MECE408": (4, 8),

        # Civil Engineering (CE / CEC)
        "CE115": (3, 5), "CE221": (3, 5), "CE224": (3, 5), "CE241": (3, 5), "CE255": (3, 5),
        "CE270": (3, 5), "CE301": (3, 6), "CE335": (3, 5), "CE361": (3, 5), "CE371": (3, 5),
        "CE381": (3, 5), "CE415": (3, 5), "CE417": (4, 8),

        # Mathematics (MATH)
        "MATH103": (3, 5), "MATH105": (3, 5), "MATH107": (3, 5), "MATH111": (3, 5), "MATH113": (3, 5),
        "MATH141": (4, 6), "MATH153": (4, 6), "MATH201": (3, 5), "MATH202": (3, 5), "MATH223": (3, 5),
        "MATH233": (3, 5), "MATH243": (3, 5), "MATH253": (3, 5), "MATH311": (3, 6), "MATH315": (3, 6),
        "MATH327": (3, 5), "MATH329": (3, 5), "MATH355": (3, 5), "MATH408": (3, 5), "MATH451": (3, 5),

        # Management & Economics (MAN / ECON / INTT / BAF)
        "MAN101": (3, 5), "MAN102": (3, 5), "MAN103": (3, 5), "MAN201": (3, 5), "MAN205": (3, 5),
        "MAN209": (3, 5), "MAN211": (3, 5), "MAN305": (3, 6), "MAN307": (3, 5), "MAN317": (3, 5),
        "MAN401": (3, 6), "MAN406": (3, 6),
        "ECON101": (3, 5), "ECON102": (3, 5), "ECON104": (3, 5), "ECON205": (3, 5), "ECON207": (3, 5),
        "ECON209": (3, 5), "ECON213": (3, 5), "ECON223": (3, 5), "ECON305": (3, 6), "ECON311": (3, 5),
        "ECON316": (3, 5), "ECON317": (3, 5), "ECON407": (4, 8),
        "INTT101": (3, 5), "INTT105": (3, 5), "INTT233": (3, 5), "INTT237": (3, 5), "INTT305": (3, 5),
        "INTT309": (3, 5), "INTT313": (3, 5), "INTT323": (3, 5), "INTT333": (3, 5), "INTT337": (3, 5),
        "INTT401": (3, 6), "INTT403": (3, 6),

        # Law (HUK / LAW)
        "HUK103": (2, 3), "HUK111": (3, 4), "HUK113": (3, 4), "HUK121": (3, 4), "HUK123": (3, 4),
        "HUK125": (2, 3), "HUK143": (2, 3), "HUK145": (3, 4), "HUK147": (2, 3), "HUK155": (2, 3),
        "HUK207": (3, 5), "HUK213": (3, 5), "HUK217": (3, 5), "HUK231": (3, 5), "HUK241": (3, 5),
        "HUK261": (3, 5), "HUK301": (3, 5), "HUK313": (3, 5), "HUK315": (3, 5), "HUK317": (3, 5),
        "HUK321": (3, 5), "HUK331": (3, 5), "HUK361": (3, 5), "HUK371": (3, 5), "HUK415": (3, 5),
        "HUK417": (3, 5), "HUK419": (3, 5), "HUK421": (3, 5), "HUK429": (3, 5), "HUK431": (3, 5),
        "LAW101": (3, 5), "LAW201": (3, 5), "LAW301": (3, 5),

        # Architecture & Interior Architecture (ARCH / INAR)
        "ARCH101": (6, 10), "ARCH103": (3, 4), "ARCH121": (3, 4), "ARCH131": (3, 4), "ARCH139": (3, 4),
        "ARCH201": (6, 10), "ARCH203": (3, 4), "ARCH205": (3, 4), "ARCH207": (3, 4), "ARCH225": (3, 4),
        "ARCH301": (6, 10), "ARCH304": (3, 4), "ARCH305": (3, 4), "ARCH311": (3, 4), "ARCH401": (6, 12),
        "INAR101": (6, 10), "INAR141": (3, 4), "INAR165": (3, 4), "INAR171": (3, 4), "INAR185": (3, 4),
        "INAR201": (6, 10), "INAR219": (3, 4), "INAR261": (3, 4), "INAR301": (6, 10), "INAR401": (6, 12),

        # Psychology & Political Science (PSY / PSI)
        "PSY101": (3, 5), "PSY113": (3, 5), "PSY215": (3, 5), "PSY221": (3, 5), "PSY243": (3, 5),
        "PSY251": (3, 5), "PSY331": (3, 5), "PSY335": (3, 5), "PSY341": (3, 5), "PSY381": (3, 5),
        "PSI101": (3, 5), "PSI103": (3, 5), "PSI201": (3, 5), "PSI203": (3, 5), "PSI205": (3, 5),
        "PSI301": (3, 5), "PSI303": (3, 5), "PSI322": (3, 5), "PSI329": (3, 5), "PSI401": (3, 5),

        # English Language & Literature (ELL)
        "ELL121": (3, 5), "ELL123": (3, 5), "ELL125": (3, 5), "ELL131": (3, 5), "ELL133": (3, 5),
        "ELL223": (3, 5), "ELL225": (3, 5), "ELL233": (3, 5), "ELL237": (3, 5), "ELL331": (3, 5),

        # Public Relations (HİR)
        "HİR101": (3, 5), "HİR107": (3, 5), "HİR111": (3, 5), "HİR113": (3, 5), "HİR115": (3, 5),
        "HİR204": (3, 5), "HİR207": (3, 5), "HİR209": (3, 5), "HİR211": (3, 5), "HİR213": (3, 5),
    }

    DEPARTMENT_NAMES = {
        "CENG": "Bilgisayar Mühendisliği (Computer Engineering)",
        "SENG": "Yazılım Mühendisliği (Software Engineering)",
        "EE": "Elektrik-Elektronik Mühendisliği (Electrical & Electronics)",
        "IE": "Endüstri Mühendisliği (Industrial Engineering)",
        "ME": "Makine Mühendisliği (Mechanical Engineering)",
        "MECE": "Mekatronik Mühendisliği (Mechatronics Engineering)",
        "CE": "İnşaat Mühendisliği (Civil Engineering)",
        "CEC": "İnşaat Mühendisliği (Civil Engineering)",
        "MATH": "Matematik (Mathematics)",
        "PHYS": "Fizik (Physics)",
        "CHEM": "Kimya (Chemistry)",
        "MAN": "İşletme (Management)",
        "ECON": "İktisat (Economics)",
        "INTT": "Uluslararası Ticaret ve Finansman",
        "BAF": "Bankacılık ve Finans",
        "HUK": "Hukuk Fakültesi (Faculty of Law)",
        "LAW": "Hukuk Fakültesi (Faculty of Law)",
        "ARCH": "Mimarlık (Architecture)",
        "INAR": "İç Mimarlık (Interior Architecture)",
        "CRP": "Şehir ve Bölge Planlama",
        "PSY": "Psikoloji (Psychology)",
        "PSI": "Siyaset Bilimi ve Uluslararası İlişkiler",
        "ELL": "İngiliz Dili ve Edebiyatı",
        "ENG": "Yabancı Diller / Akademik İngilizce",
        "ING": "Yabancı Diller / Akademik İngilizce",
        "TURK": "Türk Dili Bölümü",
        "HIST": "Atatürk İlkeleri ve İnkılap Tarihi Bölümü",
        "AIIT": "Atatürk İlkeleri ve İnkılap Tarihi Bölümü",
        "HİR": "Halkla İlişkiler ve Reklamcılık",
        "STAT": "İstatistik",
        "MIS": "Yönetim Bilişim Sistemleri",
        "DSGN": "Tasarım",
        "BIO": "Biyoloji"
    }

    KNOWN_COURSE_DETAILS = {
        # Ortak Zorunlular
        "TURK101": {
            "name": "Türk Dili I / Turkish Language I",
            "desc": "Dilin tanımı, dil ve kültür ilişkisi, Türkçenin dünya dilleri arasındaki yeri, ses ve şekil bilgisi, yazım ve noktalama kuralları."
        },
        "TURK102": {
            "name": "Türk Dili II / Turkish Language II",
            "desc": "Yazılı ve sözlü anlatım türleri, kompozisyon kuralları, resmi yazışmalar, dilekçe, rapor hazırlama ve diksiyon."
        },
        "HIST201": {
            "name": "Atatürk İlkeleri ve İnkılap Tarihi I",
            "desc": "Osmanlı Devleti'nin son dönemi, I. Dünya Savaşı, Kurtuluş Savaşı hazırlık dönemi, Kongreler ve TBMM'nin açılışı."
        },
        "HIST202": {
            "name": "Atatürk İlkeleri ve İnkılap Tarihi II",
            "desc": "Cumhuriyetin ilanı, Atatürk devrimleri, hukuk, eğitim ve ekonomi alanındaki modernleşme hareketleri."
        },
        "ENG121": {
            "name": "English for Academic Purposes I",
            "desc": "Akademik okuma, metin analizi, not alma, akademik kelime dağarcığı geliştirme ve paragraf/kompozisyon yazımı."
        },
        "ENG122": {
            "name": "English for Academic Purposes II",
            "desc": "İleri düzey akademik araştırma, argüman geliştirme, kaynak tarama, atıf yapma ve akademik makale yazma."
        },
        "ENG209": {
            "name": "Career English / Mesleki İngilizce",
            "desc": "İş hayatı ve mesleki iletişim, özgeçmiş (CV) hazırlama, mülakat teknikleri ve mesleki sunum becerileri."
        },
        "ENG221": {
            "name": "Academic Presentation Skills",
            "desc": "Akademik ve profesyonel sunum teknikleri, topluluk önünde konuşma ve etkili görsel sunum hazırlama."
        },

        # Matematik & Temel Bilimler
        "MATH157": {
            "name": "Calculus I / Genel Matematik I",
            "desc": "Fonksiyonlar, limit, süreklilik, türev ve türevin fiziksel/geometrik uygulamaları, belirli ve belirsiz integral, kalkülüsün temel teoremleri."
        },
        "MATH158": {
            "name": "Calculus II / Genel Matematik II",
            "desc": "İntegrasyon teknikleri, diziler, sonsuz seriler, Taylor ve Maclaurin serileri, kutupsal koordinatlar, çok değişkenli fonksiyonlar ve kısmi türev."
        },
        "MATH205": {
            "name": "Differential Equations / Diferansiyel Denklemler",
            "desc": "Birinci ve yüksek mertebeden lineer diferansiyel denklemler, sabit katsayılı denklemler, Laplace dönüşümleri ve seri çözümleri."
        },
        "MATH221": {
            "name": "Linear Algebra / Lineer Cebir",
            "desc": "Matrisler, determinantlar, lineer denklem sistemleri, vektör uzayları, taban ve boyut, doğrusal dönüşümler, özdeğerler ve özvektörler."
        },
        "PHYS131": {
            "name": "General Physics I / Genel Fizik I",
            "desc": "Vektörler, bir ve iki boyutta hareket, Newton hareket yasaları, iş, kinetik ve potansiyel enerji, çizgisel ve açısal momentum, dönme dinamiği."
        },
        "PHYS132": {
            "name": "General Physics II / Genel Fizik II",
            "desc": "Elektrik yükleri, Coulomb yasası, elektrik alanı, Gauss yasası, potansiyel, sığa, akım ve direnç, manyetik alan, Faraday indüksiyon yasası."
        },
        "CHEM103": {
            "name": "General Chemistry / Genel Kimya",
            "desc": "Maddenin yapısı ve ölçümü, atomlar, moleküller, kimyasal denklemler, stokiyometri, gazlar, termokimya ve kimyasal bağlar."
        },

        # Bilgisayar & Yazılım Mühendisliği
        "CENG105": {
            "name": "Introduction to Computers and Programming",
            "desc": "Temel bilgisayar mimarisi, işletim sistemleri, algoritmik düşünme, akış şemaları ve temel programlama prensipleri."
        },
        "CENG111": {
            "name": "Introduction to Computer Engineering Concepts",
            "desc": "Bilgisayar mühendisliği disiplinlerine genel bakış, sayı sistemleri, donanım/yazılım kavramları, etik ve mühendislik prensipleri."
        },
        "CENG154": {
            "name": "Discrete Mathematics / Ayrık Matematik",
            "desc": "Önermeler ve mantık, kümeler teorisi, bağıntılar, fonksiyonlar, matematiksel tümevarım, sayma yöntemleri ve çizge (graph) kuramı."
        },
        "CENG161": {
            "name": "Computer Programming I / Bilgisayar Programlama I",
            "desc": "Yapısal programlama ilkeleri, C/C++ dilinde değişkenler, koşul ve döngü yapıları, fonksiyonlar, diziler, karakter dizileri ve göstericiler (pointers)."
        },
        "CENG162": {
            "name": "Computer Programming II / Bilgisayar Programlama II",
            "desc": "Nesneye yönelik programlama (OOP), sınıflar, kapsülleme, kalıtım, polimorfizm, dinamik bellek yönetimi ve şablonlar (templates)."
        },
        "CENG235": {
            "name": "Logic Design / Mantık Tasarımı",
            "desc": "Boole cebri, mantık kapıları, Karnaugh haritaları, birleşimsel (combinational) devreler, ardışıl (sequential) devreler, flip-floplar ve sayaçlar."
        },
        "CENG241": {
            "name": "Data Structures / Veri Yapıları",
            "desc": "Yığın (stack), kuyruk (queue), bağlı listeler (linked lists), ikili arama ağaçları (BST), yığınlar (heaps), çizge algoritmaları ve karma tabloları (hashing)."
        },
        "CENG329": {
            "name": "Algorithms / Algoritmalar",
            "desc": "Algoritma karmaşıklığı, Asimptotik gösterimler (Big-O), böl ve yönet, dinamik programlama, açgözlü (greedy) algoritmalar ve en kısa yol algoritmaları."
        },
        "CENG361": {
            "name": "Database Management Systems / Veritabanı Sistemleri",
            "desc": "İlişkisel veritabanı modelleri, ER diyagramları, SQL sorgu dili, ilişkisel cebir, normalizasyon, transaction yönetimi ve indeksleme."
        },
        "CENG383": {
            "name": "Operating Systems / İşletim Sistemleri",
            "desc": "İşletim sistemi mimarisi, süreçler (processes), iş parçacıkları (threads), CPU çizelgeleme, senkronizasyon, kilitlenmeler (deadlocks), sanal bellek ve dosya sistemleri."
        },
        "CENG403": {
            "name": "Software Engineering / Yazılım Mühendisliği",
            "desc": "Yazılım geliştirme yaşam döngüleri, çevik yöntemler (Agile/Scrum), gereksinim analizi, UML modelleme, mimari tasarım ve yazılım test yöntemleri."
        },
        "CENG407": {
            "name": "Innovative System Design and Development I",
            "desc": "Bitirme projesi I; takım çalışmasıyla gerçek dünya mühendislik probleminin analizi, sistem gereksinimleri ve mimari tasarımı."
        },
        "CENG408": {
            "name": "Innovative System Design and Development II",
            "desc": "Bitirme projesi II; tasarlanan sistemin geliştirilmesi, test edilmesi, belgelenmesi ve jüri önünde sunumu."
        },
        "SENG101": {
            "name": "Introduction to Software Engineering",
            "desc": "Yazılım mühendisliğinin temelleri, yazılım geliştirme süreçleri, kalite faktörleri ve profesyonel etik kuralları."
        },
        "SENG201": {
            "name": "Software Requirements Engineering",
            "desc": "Yazılım gereksinim analizi, gereksinim çıkarma teknikleri, fonksiyonel/fonksiyonel olmayan gereksinimler ve kullanım senaryoları (use cases)."
        },
        "SENG203": {
            "name": "Software Design and Architecture",
            "desc": "Yazılım mimarisi desenleri (design patterns), bileşen tabanlı tasarım, mikroservisler ve yazılım mimarisinin modellenmesi."
        },
        "SENG301": {
            "name": "Software Testing and Quality Assurance",
            "desc": "Birim testi (unit test), entegrasyon testi, kara kutu ve beyaz kutu test teknikleri, test otomasyonu ve yazılım kalite metrikleri."
        },

        # Elektrik, Endüstri, Makine, İnşaat
        "EE203": {
            "name": "Circuit Theory I / Devre Teorisi I",
            "desc": "Temel devre elemanları, Kirchhoff yasaları, düğüm ve çevre akımları yöntemleri, Thévenin ve Norton eşdeğer devreleri, op-amp devreleri."
        },
        "EE205": {
            "name": "Circuit Theory II / Devre Teorisi II",
            "desc": "Sinüzoidal kararlı durum analizi, fazörler, AC güç hesapları, rezonans, üç fazlı devreler ve frekans cevabı."
        },
        "IE241": {
            "name": "Operations Research I / Yöneylem Araştırması I",
            "desc": "Doğrusal programlama modelleri, grafik çözüm yöntemi, Simpleks algoritması, dualite teorisi ve duyarlılık analizi."
        },
        "IE333": {
            "name": "Operations Research II / Yöneylem Araştırması II",
            "desc": "Tamsayılı programlama, dinamik programlama, Markov zincirleri, kuyruk modelleri ve ağ optimizasyonu."
        },
        "ME113": {
            "name": "Computer Aided Engineering Drawing",
            "desc": "Teknik resim prensipleri, izdüşüm yöntemleri, kesit alma, ölçülendirme, toleranslar ve AutoCAD / SolidWorks ile 2B/3B modelleme."
        },
        "ME211": {
            "name": "Statics / Statik",
            "desc": "Parçacıkların ve rijit cisimlerin dengesi, serbest cisim diyagramları, kafes ve çerçeve sistemler, ağırlık merkezleri ve sürtünme."
        },
        "CE221": {
            "name": "Engineering Mechanics: Statics",
            "desc": "Taşıyıcı sistemlerde kuvvet dengesi, kesit tesirleri, moment diyagramları ve yapı elemanlarının statik analizi."
        },

        # İşletme, İktisat, Hukuk, Mimarlık
        "MAN101": {
            "name": "Introduction to Business / İşletmeye Giriş",
            "desc": "İşletme fonksiyonları; yönetim, pazarlama, finansman, üretim, insan kaynakları ve küresel iş ortamı."
        },
        "ECON101": {
            "name": "Introduction to Economics I / Mikroiktisada Giriş",
            "desc": "Mikroekonomik prensipler; piyasa mekanizması, arz ve talep, tüketici davranışı, üretim maliyetleri ve piyasa yapıları."
        },
        "ECON102": {
            "name": "Introduction to Economics II / Makroiktisada Giriş",
            "desc": "Makroekonomik göstergeler; milli gelir, enflasyon, işsizlik, para ve bankacılık sistemi, para ve maliye politikaları."
        },
        "HUK111": {
            "name": "Anayasa Hukuku",
            "desc": "Devlet kavramı ve teorileri, anayasa kavramı, kurucu iktidar, kuvvetler ayrılığı ilkesi, temel hak ve özgürlükler rejimi."
        },
        "ARCH101": {
            "name": "Basic Design / Temel Tasarım",
            "desc": "Tasarım elemanları; nokta, çizgi, düzlem, hacim, mekan, oran, armoni, kompozisyon ve iki/üç boyutlu tasarım alıştırmaları."
        },
        "ARCH103": {
            "name": "Architectural Design Studio I",
            "desc": "Mimari düşünce ve tasarım sürecine giriş; mekan organizasyonu, insan-mekan ölçeği ve kavramsal proje geliştirme."
        }
    }

    def get_course_info(self, course_code):
        """Returns structured information, links, and descriptions for a given course code."""
        norm = self.normalize_code(course_code)
        dept_code = Course.extract_dept_code(norm)
        level_num = Course.extract_course_level(norm)
        level = max(1, min(4, level_num // 100)) if level_num >= 100 else 1

        dept_name = self.DEPARTMENT_NAMES.get(dept_code, f"{dept_code} Bölümü")
        cr, ec = self.get_course_credits(norm)

        if norm in self.KNOWN_COURSE_DETAILS:
            details = self.KNOWN_COURSE_DETAILS[norm]
            name = details["name"]
            desc = details["desc"]
        else:
            name = f"{norm} - {dept_name}"
            desc = (
                f"Çankaya Üniversitesi {dept_name} bünyesinde açılan {level}. sınıf lisans dersi. "
                f"Dersin ayrıntılı izlencesi (syllabus), haftalık ders konuları, sınav ve değerlendirme kriterleri "
                f"için aşağıdaki resmi ders sayfasını veya bölüm kataloğunu inceleyebilirsiniz."
            )

        # Standard Çankaya URLs
        course_url = f"http://{norm.lower()}.cankaya.edu.tr/"
        dept_url = f"https://{dept_code.lower()}.cankaya.edu.tr/tr/lisans/ders-tanimlari/"
        ebs_url = "https://ebs.cankaya.edu.tr/"
        search_url = f"https://www.google.com/search?q=cankaya+universitesi+{norm}+ders+tanimi+syllabus"

        return {
            "code": norm,
            "name": name,
            "dept_code": dept_code,
            "dept_name": dept_name,
            "level": level,
            "credit": cr,
            "ects": ec,
            "description": desc,
            "course_url": course_url,
            "dept_url": dept_url,
            "ebs_url": ebs_url,
            "search_url": search_url
        }

    def __init__(self, cache_filepath=None):
        self.cache_filepath = cache_filepath or self.DEFAULT_CACHE_FILE
        self.courses = {}  # course_code -> Course object
        self.departments = set()
        self.student_profile = {
            "primary_dept": "CENG",
            "secondary_type": "YOK",  # "YOK", "CAP", "YANDAL"
            "secondary_dept": "YOK",
            "custom_overrides": {},  # course_code -> "ZORUNLU" or "SECMELI"
            "custom_credits": {}     # course_code -> {"credit": int, "ects": int}
        }

        self.reload_official_curricula()
        self.load_from_cache()
        self.load_student_profile()

    def reload_official_curricula(self):
        """Reloads official curricula and course details from local JSON files."""
        curricula_path = os.path.join(os.path.dirname(__file__), "cankaya_official_curricula.json")
        if os.path.exists(curricula_path):
            try:
                with open(curricula_path, "r", encoding="utf-8") as f:
                    self.official_curricula = json.load(f)
            except Exception as e:
                print(f"Error loading official curricula: {e}")

        details_path = os.path.join(os.path.dirname(__file__), "cankaya_course_details.json")
        if os.path.exists(details_path):
            try:
                with open(details_path, "r", encoding="utf-8") as f:
                    course_details = json.load(f)
                    for code, d in course_details.items():
                        norm = self.normalize_code(code)
                        if norm not in self.KNOWN_COURSE_DETAILS:
                            self.KNOWN_COURSE_DETAILS[norm] = {
                                "name": d.get("name") or norm,
                                "desc": d.get("desc") or ""
                            }
            except Exception as e:
                print(f"Error loading course details: {e}")

    def process_raw_entries(self, raw_entries):
        """Builds structured Course & Section objects from raw scraped entries."""
        self.courses.clear()
        self.departments.clear()

        for entry in raw_entries:
            c_code = entry["course_code"]
            sec_no = entry["section"]
            dept = entry.get("dept_code", "")
            inst = entry.get("instructor", "Belirsiz")
            classroom = entry.get("classroom", "")
            day = entry.get("day", "")
            t_slot = entry.get("time_slot", "")

            if not c_code or not day or not t_slot:
                continue

            if c_code not in self.courses:
                self.courses[c_code] = Course(c_code, dept)
            
            course = self.courses[c_code]
            if dept:
                self.departments.add(dept)

            section = course.get_or_create_section(sec_no, inst, classroom)
            section.add_slot(day, t_slot, classroom)

        self.save_to_cache()

    def save_to_cache(self):
        data = {
            "departments": sorted(list(self.departments)),
            "courses": {c_code: c.to_dict() for c_code, c in self.courses.items()}
        }
        try:
            with open(self.cache_filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Saved {len(self.courses)} courses to {self.cache_filepath}")
        except Exception as e:
            print(f"Cache write error: {e}")

    def load_from_cache(self):
        if not os.path.exists(self.cache_filepath):
            return False

        try:
            with open(self.cache_filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            self.departments = set(data.get("departments", []))
            self.courses = {}
            for c_code, c_data in data.get("courses", {}).items():
                self.courses[c_code] = Course.from_dict(c_data)
                dept = self.courses[c_code].dept_code
                if dept:
                    self.departments.add(dept)

            print(f"Loaded {len(self.courses)} courses from cache ({self.cache_filepath})")
            return True
        except Exception as e:
            print(f"Cache load error: {e}")
            return False

    def load_student_profile(self):
        if os.path.exists(self.PROFILE_CACHE_FILE):
            try:
                with open(self.PROFILE_CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.student_profile.update(data)
            except Exception:
                pass

    def save_student_profile(self, primary_dept=None, secondary_dept=None, secondary_type=None):
        if primary_dept is not None:
            self.student_profile["primary_dept"] = primary_dept
        if secondary_dept is not None:
            self.student_profile["secondary_dept"] = secondary_dept
        if secondary_type is not None:
            self.student_profile["secondary_type"] = secondary_type
        try:
            with open(self.PROFILE_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.student_profile, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving student profile: {e}")

    def get_custom_schedule_blocks(self):
        """Returns the dictionary of user-defined custom timetable blocks."""
        return self.student_profile.setdefault("custom_schedule_blocks", {})

    def set_custom_schedule_block(self, day, time_slot, title, note="", color="amber"):
        """Adds or updates a custom timetable block for a specific day and time slot."""
        blocks = self.student_profile.setdefault("custom_schedule_blocks", {})
        key = f"{day}:{time_slot}"
        blocks[key] = {
            "day": day,
            "time_slot": time_slot,
            "title": title,
            "note": note,
            "color": color
        }
        self.save_student_profile()

    def delete_custom_schedule_block(self, day, time_slot):
        """Deletes a custom timetable block for a specific day and time slot."""
        blocks = self.student_profile.setdefault("custom_schedule_blocks", {})
        key = f"{day}:{time_slot}"
        if key in blocks:
            del blocks[key]
            self.save_student_profile()

    def get_passed_courses(self):
        """Returns dictionary of passed courses: {code: {'grade': ..., 'name': ...}}."""
        return self.student_profile.setdefault("passed_courses", {})

    def set_passed_courses(self, passed_dict):
        """Sets the dictionary of passed courses and saves profile."""
        clean_dict = {}
        for code, info in passed_dict.items():
            norm = self.normalize_code(code)
            if isinstance(info, dict):
                clean_dict[norm] = info
            elif isinstance(info, str):
                clean_dict[norm] = {"code": norm, "grade": info, "name": norm}
            else:
                clean_dict[norm] = {"code": norm, "grade": "CC", "name": norm}
        self.student_profile["passed_courses"] = clean_dict
        self.save_student_profile()

    def add_passed_course(self, course_code, grade="CC", name=""):
        norm = self.normalize_code(course_code)
        passed = self.get_passed_courses()
        passed[norm] = {
            "code": norm,
            "grade": grade.upper(),
            "name": name or norm
        }
        self.save_student_profile()

    def remove_passed_course(self, course_code):
        norm = self.normalize_code(course_code)
        passed = self.get_passed_courses()
        if norm in passed:
            del passed[norm]
            self.save_student_profile()

    def is_course_passed(self, course_code):
        norm = self.normalize_code(course_code)
        return norm in self.get_passed_courses()

    def check_course_prerequisites(self, course_code):
        from prerequisite_manager import PrerequisiteManager
        passed = self.get_passed_courses()
        return PrerequisiteManager.check_prerequisites(course_code, passed)

    def toggle_custom_course_type(self, course_code):
        """Toggles user custom override for a course between ZORUNLU and SECMELI."""
        norm = self.normalize_code(course_code)
        overrides = self.student_profile.setdefault("custom_overrides", {})

        current_type, _ = self.classify_course(course_code)
        if "ZORUNLU" in current_type:
            overrides[norm] = "SECMELI"
        else:
            overrides[norm] = "ZORUNLU"

        self.save_student_profile(
            self.student_profile.get("primary_dept", "CENG"),
            self.student_profile.get("secondary_dept", "YOK"),
            self.student_profile.get("secondary_type", "YOK")
        )

    def get_course_credits(self, course_code):
        """
        Returns (credit, ects) tuple for a given course code.
        Checks custom user overrides first, then known credits, then intelligent heuristics.
        """
        norm = self.normalize_code(course_code)

        # 1. Custom user override
        custom_credits = self.student_profile.get("custom_credits", {})
        if norm in custom_credits:
            c = custom_credits[norm]
            return int(c.get("credit", 3)), int(c.get("ects", 5))

        # 2. Known mapping
        if norm in self.KNOWN_COURSE_CREDITS:
            return self.KNOWN_COURSE_CREDITS[norm]

        # 3. Intelligent Heuristic Fallbacks:
        # Common university mandatory
        if norm in self.COMMON_UNIVERSITY_COMPULSORY:
            return 2, 2

        # Senior graduation projects
        level = Course.extract_course_level(norm)
        if level in (407, 408, 491, 492):
            return 4, 8

        # Architecture / Design studio courses
        dept = Course.extract_dept_code(norm)
        if dept in ("ARCH", "INAR", "DSGN", "İVA") and level in (101, 102, 201, 202, 301, 302, 401, 402):
            return 6, 10

        # Standard undergraduate lecture course default
        return 3, 5

    def set_custom_course_credits(self, course_code, credit, ects):
        """Sets a user custom override for credit and ECTS of a course."""
        norm = self.normalize_code(course_code)
        self.student_profile.setdefault("custom_credits", {})[norm] = {
            "credit": int(credit),
            "ects": int(ects)
        }
        self.save_student_profile(
            self.student_profile.get("primary_dept", "CENG"),
            self.student_profile.get("secondary_dept", "YOK"),
            self.student_profile.get("secondary_type", "YOK")
        )

    def classify_course(self, course_code, primary_dept=None, secondary_dept=None, secondary_type=None):
        """
        Classifies course as:
        - 'ZORUNLU' (Compulsory for primary major based on Bilgi Paketi academic program)
        - 'ZORUNLU_CAP' (Compulsory for double major / ÇAP)
        - 'ZORUNLU_YANDAL' (Compulsory for minor / Yandal)
        - 'TEKNIK_SECMELI' (Department technical elective)
        - 'SERBEST_SECMELI' (Free / social elective)
        """
        primary = (primary_dept or self.student_profile.get("primary_dept", "CENG")).upper()
        secondary = (secondary_dept or self.student_profile.get("secondary_dept", "YOK")).upper()
        sec_type = (secondary_type or self.student_profile.get("secondary_type", "YOK")).upper()

        code_upper = course_code.upper()
        norm_code = self.normalize_code(code_upper)
        course_dept = Course.extract_dept_code(code_upper)

        # 0. Check User Custom Overrides first
        overrides = self.student_profile.get("custom_overrides", {})
        if norm_code in overrides:
            custom_val = overrides[norm_code]
            if custom_val == "ZORUNLU":
                return "ZORUNLU", "Zorunlu (Özel)"
            elif custom_val == "SECMELI":
                return "SERBEST_SECMELI", "🔸 Seçmeli (Özel)"

        # 1. Primary Department Official Curriculum Check (Bilgi Paketi)
        is_primary_compulsory = False
        if self.official_curricula and primary in self.official_curricula:
            comp_codes = {self.normalize_code(c) for c in self.official_curricula[primary].get("compulsory_codes", [])}
            if norm_code in comp_codes:
                is_primary_compulsory = True
        elif primary in self.DEPARTMENT_CURRICULUM:
            curr = self.DEPARTMENT_CURRICULUM[primary]
            norm_comp_other = {self.normalize_code(c) for c in curr.get("compulsory_other", set())}
            norm_comp_own = {self.normalize_code(c) for c in curr.get("compulsory_own", set())}
            if norm_code in norm_comp_other or norm_code in norm_comp_own:
                is_primary_compulsory = True

        # University-wide common compulsory safeguard (TURK, HIST/AIIT, ENG, ESR)
        if norm_code in self.COMMON_UNIVERSITY_COMPULSORY:
            is_primary_compulsory = True

        if is_primary_compulsory:
            return "ZORUNLU", "Zorunlu"

        # 2. Check Secondary Program (ÇAP vs YANDAL)
        if secondary and secondary != "YOK" and sec_type not in ("YOK", ""):
            # --- CASE A: YANDAL (MINOR) ---
            if sec_type == "YANDAL":
                comb = (primary, secondary)
                if comb in self.YANDAL_COMBINATION_PACKAGES:
                    minor_pkg = {self.normalize_code(c) for c in self.YANDAL_COMBINATION_PACKAGES[comb]}
                else:
                    minor_pkg = {self.normalize_code(c) for c in self.YANDAL_GENERAL_PACKAGES.get(secondary, set())}

                if norm_code in minor_pkg:
                    return "ZORUNLU_YANDAL", "🔵 Zorunlu (Yandal)"

                # Check if in secondary official technical elective pool or department
                if self.official_curricula and secondary in self.official_curricula:
                    sec_tech = {self.normalize_code(c) for c in self.official_curricula[secondary].get("technical_elective_codes", [])}
                    if norm_code in sec_tech:
                        return "TEKNIK_SECMELI", "🔹 Seçmeli (Yandal)"

                if course_dept == secondary:
                    return "TEKNIK_SECMELI", "🔹 Seçmeli (Yandal)"

            # --- CASE B: ÇİFT ANADAL (ÇAP - DOUBLE MAJOR) ---
            elif sec_type == "CAP":
                is_sec_compulsory = False
                if self.official_curricula and secondary in self.official_curricula:
                    sec_comp = {self.normalize_code(c) for c in self.official_curricula[secondary].get("compulsory_codes", [])}
                    if norm_code in sec_comp:
                        is_sec_compulsory = True
                elif secondary in self.DEPARTMENT_CURRICULUM:
                    curr_sec = self.DEPARTMENT_CURRICULUM[secondary]
                    norm_sec_other = {self.normalize_code(c) for c in curr_sec.get("compulsory_other", set())}
                    norm_sec_own = {self.normalize_code(c) for c in curr_sec.get("compulsory_own", set())}
                    if norm_code in norm_sec_other or norm_code in norm_sec_own:
                        is_sec_compulsory = True

                if is_sec_compulsory:
                    return "ZORUNLU_CAP", "🟣 Zorunlu (ÇAP)"

                if self.official_curricula and secondary in self.official_curricula:
                    sec_tech = {self.normalize_code(c) for c in self.official_curricula[secondary].get("technical_elective_codes", [])}
                    if norm_code in sec_tech:
                        return "TEKNIK_SECMELI", "🔹 Teknik Seçmeli (ÇAP)"

                if course_dept == secondary:
                    return "TEKNIK_SECMELI", "🔹 Teknik Seçmeli (ÇAP)"

        # 3. Check Primary Department Official Elective Pools (Bilgi Paketi)
        if self.official_curricula and primary in self.official_curricula:
            prim_curr = self.official_curricula[primary]
            tech_codes = {self.normalize_code(c) for c in prim_curr.get("technical_elective_codes", [])}
            if norm_code in tech_codes:
                return "TEKNIK_SECMELI", "🔹 Teknik Seçmeli"

            social_codes = {self.normalize_code(c) for c in prim_curr.get("social_elective_codes", [])}
            if norm_code in social_codes:
                return "SERBEST_SECMELI", "🔸 Sosyal / Serbest Seçmeli"

        # 4. Fallback Heuristics:
        # If belongs to student's department but not compulsory -> Technical Elective
        if course_dept == primary:
            return "TEKNIK_SECMELI", "🔹 Teknik Seçmeli"

        # Otherwise Free / Social Elective
        return "SERBEST_SECMELI", "🔸 Serbest/Sosyal Seçmeli"

    def get_curriculum_progress(self, primary_dept=None, passed_courses=None):
        """
        Calculates curriculum completion metrics for student's primary department:
        - Compulsory courses: total, passed, remaining list
        - Technical electives: required slots, passed count, remaining slots
        - Social / free electives: required slots, passed count, remaining slots
        """
        primary = (primary_dept or self.student_profile.get("primary_dept", "CENG")).upper()
        if passed_courses is None:
            passed_dict = self.get_passed_courses()
        elif isinstance(passed_courses, dict):
            passed_dict = passed_courses
        elif isinstance(passed_courses, (list, set, tuple)):
            passed_dict = {self.normalize_code(c): {"code": c, "grade": "CC"} for c in passed_courses}
        else:
            passed_dict = {}

        norm_passed = {self.normalize_code(c) for c in passed_dict.keys()}

        curriculum = self.official_curricula.get(primary)
        if not curriculum:
            # Fallback search by key or program_name
            for k, v in self.official_curricula.items():
                if primary in k or primary in v.get("program_name", "").upper():
                    curriculum = v
                    break

        if not curriculum:
            # Fallback to DEPARTMENT_CURRICULUM if available
            comp_codes = set()
            if primary in self.DEPARTMENT_CURRICULUM:
                curr = self.DEPARTMENT_CURRICULUM[primary]
                comp_codes = {self.normalize_code(c) for c in curr.get("compulsory_other", set()) | curr.get("compulsory_own", set())}
            comp_codes.update({self.normalize_code(c) for c in self.COMMON_UNIVERSITY_COMPULSORY})

            passed_comp = sorted(list(comp_codes & norm_passed))
            remaining_comp = sorted(list(comp_codes - norm_passed))
            return {
                "department": primary,
                "program_name": self.DEPARTMENT_NAMES.get(primary, primary),
                "curriculum_name": "Standart Müfredat",
                "compulsory_total": len(comp_codes),
                "compulsory_passed": len(passed_comp),
                "compulsory_remaining_count": len(remaining_comp),
                "compulsory_remaining": [{"code": c, "norm_code": c, "name": self.get_course_info(c).get("name", c)} for c in remaining_comp],
                "tech_slots_total": 5,
                "tech_slots_passed": sum(1 for c in norm_passed if Course.extract_dept_code(c) == primary and c not in comp_codes),
                "tech_slots_remaining": max(0, 5 - sum(1 for c in norm_passed if Course.extract_dept_code(c) == primary and c not in comp_codes)),
                "social_slots_total": 2,
                "social_slots_passed": sum(1 for c in norm_passed if Course.extract_dept_code(c) != primary and c not in comp_codes),
                "social_slots_remaining": max(0, 2 - sum(1 for c in norm_passed if Course.extract_dept_code(c) != primary and c not in comp_codes)),
            }

        # With official Bilgi Paketi curriculum
        compulsory_courses = curriculum.get("compulsory_courses", [])
        passed_comp = []
        remaining_comp = []

        for c in compulsory_courses:
            norm_c = c.get("norm_code") or self.normalize_code(c.get("code", ""))
            if norm_c in norm_passed:
                passed_comp.append(c)
            else:
                remaining_comp.append(c)

        # Elective slots
        elective_slots = curriculum.get("elective_slots", [])
        tech_slots_total = sum(1 for s in elective_slots if s.get("slot_category") == "TEKNIK_SECMELI")
        social_slots_total = sum(1 for s in elective_slots if s.get("slot_category") == "SOSYAL_SECMELI")

        # If elective_slots is empty, fallback to elective_count or default
        if not elective_slots and curriculum.get("elective_count", 0) > 0:
            total_el = curriculum.get("elective_count", 0)
            tech_slots_total = max(1, total_el - 2)
            social_slots_total = min(2, total_el)

        tech_codes = {self.normalize_code(c) for c in curriculum.get("technical_elective_codes", [])}
        social_codes = {self.normalize_code(c) for c in curriculum.get("social_elective_codes", [])}

        passed_tech = []
        passed_social = []

        for norm_c in norm_passed:
            if norm_c in tech_codes:
                passed_tech.append(norm_c)
            elif norm_c in social_codes:
                passed_social.append(norm_c)

        tech_remaining = max(0, tech_slots_total - len(passed_tech))
        social_remaining = max(0, social_slots_total - len(passed_social))

        return {
            "department": primary,
            "program_name": curriculum.get("program_name") or self.DEPARTMENT_NAMES.get(primary, primary),
            "curriculum_name": curriculum.get("curriculum_name", ""),
            "compulsory_total": len(compulsory_courses),
            "compulsory_passed": len(passed_comp),
            "compulsory_remaining_count": len(remaining_comp),
            "compulsory_remaining": remaining_comp,
            "tech_slots_total": tech_slots_total,
            "tech_slots_passed": len(passed_tech),
            "tech_slots_remaining": tech_remaining,
            "social_slots_total": social_slots_total,
            "social_slots_passed": len(passed_social),
            "social_slots_remaining": social_remaining
        }


    def get_all_courses(self):
        return sorted(list(self.courses.values()), key=lambda c: c.code)

    def search_courses(self, query="", dept_filter=None, type_filter=None, primary_dept=None, secondary_dept=None, secondary_type=None):
        query = query.strip().upper()
        results = []

        for course in self.courses.values():
            if dept_filter and dept_filter != "TÜMÜ" and course.dept_code != dept_filter:
                continue

            course_type, type_label = self.classify_course(course.code, primary_dept, secondary_dept, secondary_type)
            if type_filter and type_filter != "TÜMÜ":
                if type_filter == "ZORUNLU":
                    if course_type not in ("ZORUNLU", "ZORUNLU_CAP", "ZORUNLU_YANDAL"):
                        continue
                elif type_filter == "ZORUNLU_ANA":
                    if course_type != "ZORUNLU":
                        continue
                elif type_filter == "ZORUNLU_CAP":
                    if course_type != "ZORUNLU_CAP":
                        continue
                elif type_filter == "ZORUNLU_YANDAL":
                    if course_type != "ZORUNLU_YANDAL":
                        continue
                elif type_filter == "SECMELI":
                    if course_type not in ("TEKNIK_SECMELI", "SERBEST_SECMELI"):
                        continue
                elif type_filter == "TEKNIK_SECMELI":
                    if course_type != "TEKNIK_SECMELI":
                        continue
                elif type_filter == "SERBEST_SECMELI":
                    if course_type != "SERBEST_SECMELI":
                        continue

            if not query:
                results.append((course, course_type, type_label))
            elif query in course.code.upper():
                results.append((course, course_type, type_label))
            else:
                inst_match = False
                for sec in course.sections.values():
                    if query in sec.instructor.upper():
                        inst_match = True
                        break
                if inst_match:
                    results.append((course, course_type, type_label))

        return sorted(results, key=lambda x: (
            0 if x[1] == "ZORUNLU" else 1 if x[1] == "ZORUNLU_CAP" else 2 if x[1] == "ZORUNLU_YANDAL" else 3 if x[1] == "TEKNIK_SECMELI" else 4,
            x[0].code
        ))
