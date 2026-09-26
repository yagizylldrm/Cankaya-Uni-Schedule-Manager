import sys
import os
import re
import json
from typing import List, Dict, Any, Optional

# Ensure current dir and project root are in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

BASE_DIR = os.path.dirname(CURRENT_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(1, BASE_DIR)

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Body, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from data_manager import DataManager, Course, Section, ScheduleSlot
from scheduler_engine import SchedulerEngine
from prerequisite_manager import PrerequisiteManager
from transcript_parser import TranscriptParser

app = FastAPI(
    title="Çankaya Üniversitesi Schedule Manager API",
    description="Vercel Serverless API for Çankaya University Timetable & Prerequisite Management",
    version="2.0.0"
)

# Normalize Vercel internal rewritten paths
@app.middleware("http")
async def vercel_path_normalizer(request: Request, call_next):
    matched = request.headers.get("x-matched-path")
    if matched:
        request.scope["path"] = matched
    return await call_next(request)

# Enable CORS for local development and Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize singletons
dm = DataManager()
scheduler = SchedulerEngine()

router = APIRouter()


# --- Pydantic Models ---

class CombinationsRequest(BaseModel):
    selected_courses: Dict[str, List[str]]  # { "CENG111": ["1", "2"], "MATH157": ["1"] }
    preferences: Optional[Dict[str, bool]] = None  # { "free_friday": False, "free_monday": False, "no_morning": False }
    custom_blocks: Optional[Dict[str, Dict[str, Any]]] = None
    compact: bool = False

class PrereqCheckRequest(BaseModel):
    course_codes: List[str]
    passed_courses: Dict[str, Any] = {}
    primary_dept: str = 'CENG'

class TranscriptTextRequest(BaseModel):
    text: str

class CurriculumProgressRequest(BaseModel):
    primary_dept: str = "CENG"
    passed_courses: Dict[str, Any] = {}


# --- Endpoints on Router ---

@router.get("/")
def api_root():
    return {
        "name": "Çankaya Schedule Manager API",
        "status": "ok",
        "courses_count": len(dm.courses),
        "departments_count": len(dm.departments)
    }

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "courses_count": len(dm.courses),
        "departments_count": len(dm.departments),
        "official_curricula_count": len(dm.official_curricula) if hasattr(dm, "official_curricula") else 0
    }


@router.get("/departments")
def get_departments():
    """Returns sorted list of all departments with codes and human-readable names."""
    dept_map = {}
    for c in dm.courses.values():
        if c.dept_code and c.dept_code not in dept_map:
            name = dm.DEPARTMENT_NAMES.get(c.dept_code, f"{c.dept_code} Bölümü")
            dept_map[c.dept_code] = name

    if hasattr(dm, "official_curricula"):
        for code, curr in dm.official_curricula.items():
            if code not in dept_map:
                p_name = curr.get("program_name", "")
                dept_map[code] = p_name if p_name else f"{code} Bölümü"

    for code, name in dm.DEPARTMENT_NAMES.items():
        if code not in dept_map:
            dept_map[code] = name

    result = [{"code": k, "name": v,
               "has_curriculum": k in dm.official_curricula,
               "curriculum_name": dm.official_curricula.get(k, {}).get("curriculum_name", "")}
              for k, v in dept_map.items()]
    result.sort(key=lambda x: x["code"])
    return result


@router.get("/courses")
def get_courses(
    query: str = "",
    dept: str = "",
    type: str = "TÜMÜ",
    primary_dept: str = "CENG",
    secondary_dept: str = "YOK",
    secondary_type: str = "YOK",
    only_eligible: bool = False,
    hide_passed: bool = False,
    include_outside_curriculum: bool = False,
    passed_codes: str = ""
):
    """Search and filter courses based on department, course type, and student profile."""
    query_clean = query.strip().upper()
    passed_set = set()
    if passed_codes:
        passed_set = {dm.normalize_code(c.strip()) for c in passed_codes.split(",") if c.strip()}

    allowed_codes = None if include_outside_curriculum else dm.curriculum_course_codes(
        primary_dept, secondary_dept, secondary_type)
    custom_codes = set(dm.student_profile.get("custom_overrides", {}))
    results = []
    for course in dm.courses.values():
        if dept and dept != "TÜMÜ" and course.dept_code != dept:
            continue

        norm_code = dm.normalize_code(course.code)

        if allowed_codes is not None and norm_code not in allowed_codes and norm_code not in custom_codes:
            continue

        if hide_passed and norm_code in passed_set:
            continue

        course_type, type_label = dm.classify_course(
            course.code,
            primary_dept=primary_dept,
            secondary_dept=secondary_dept,
            secondary_type=secondary_type
        )

        if type and type != "TÜMÜ":
            if type == "ZORUNLU" and course_type not in ("ZORUNLU", "ZORUNLU_CAP", "ZORUNLU_YANDAL"):
                continue
            elif type == "ZORUNLU_ANA" and course_type != "ZORUNLU":
                continue
            elif type == "ZORUNLU_CAP" and course_type != "ZORUNLU_CAP":
                continue
            elif type == "ZORUNLU_YANDAL" and course_type != "ZORUNLU_YANDAL":
                continue
            elif type == "SECMELI" and course_type not in ("TEKNIK_SECMELI", "SERBEST_SECMELI"):
                continue
            elif type == "TEKNIK_SECMELI" and course_type != "TEKNIK_SECMELI":
                continue
            elif type == "SERBEST_SECMELI" and course_type != "SERBEST_SECMELI":
                continue

        if query_clean:
            matches_code = query_clean in course.code.upper()
            matches_inst = any(query_clean in sec.instructor.upper() for sec in course.sections.values())
            if not matches_code and not matches_inst:
                continue

        prereq_info = PrerequisiteManager.check_prerequisites(norm_code, passed_set, primary_dept=primary_dept)
        can_take = prereq_info.get("can_take", True)
        if only_eligible and not can_take:
            continue

        credit, ects = dm.get_course_credits(course.code, primary_dept=primary_dept)
        c_info = dm.get_course_info(course.code, primary_dept=primary_dept)
        instructors = sorted(list({sec.instructor for sec in course.sections.values() if sec.instructor != "Belirsiz"}))

        results.append({
            "code": course.code,
            "dept_code": course.dept_code,
            "name": c_info.get("name", course.code),
            "credit": credit,
            "ects": ects,
            "type": course_type,
            "type_label": type_label,
            "sections_count": len(course.sections),
            "untimed": is_untimed_course(course),
            "instructors": instructors,
            "can_take": can_take,
            "prereq_message": prereq_info.get("message", ""),
            "is_passed": norm_code in passed_set
        })

    type_priority = {
        "ZORUNLU": 0,
        "ZORUNLU_CAP": 1,
        "ZORUNLU_YANDAL": 2,
        "TEKNIK_SECMELI": 3,
        "SERBEST_SECMELI": 4
    }
    results.sort(key=lambda x: (type_priority.get(x["type"], 5), x["code"]))
    return results


@router.get("/courses/{code}")
def get_course_detail(
    code: str,
    primary_dept: str = "CENG",
    secondary_dept: str = "YOK",
    secondary_type: str = "YOK",
    passed_codes: str = ""
):
    """Returns full details of a specific course: sections, slots, instructors, syllabi, web link."""
    norm = dm.normalize_code(code)
    if norm not in dm.courses:
        found = None
        for k, c in dm.courses.items():
            if dm.normalize_code(k) == norm:
                found = c
                break
        if not found:
            raise HTTPException(status_code=404, detail=f"Ders bulunamadı: {code}")
        course = found
    else:
        course = dm.courses[norm]

    c_info = dm.get_course_info(course.code, primary_dept=primary_dept)
    course_type, type_label = dm.classify_course(
        course.code,
        primary_dept=primary_dept,
        secondary_dept=secondary_dept,
        secondary_type=secondary_type
    )

    passed_set = set()
    if passed_codes:
        passed_set = {dm.normalize_code(c.strip()) for c in passed_codes.split(",") if c.strip()}

    prereq_info = PrerequisiteManager.check_prerequisites(norm, passed_set, primary_dept=primary_dept)
    credit, ects = dm.get_course_credits(course.code, primary_dept=primary_dept)

    sections_data = []
    for sec_no, sec in sorted(course.sections.items(), key=lambda x: str(x[0])):
        slots_data = []
        for s in sec.slots:
            slots_data.append({
                "day": s.day,
                "time_slot": s.time_slot,
                "classroom": s.classroom or sec.classroom
            })
        sections_data.append({
            "section_no": sec.section_no,
            "instructor": sec.instructor,
            "instructor_evidence": sec.instructor_evidence,
            "classroom": sec.classroom,
            "slots": slots_data
        })

    return {
        "code": course.code,
        "dept_code": course.dept_code,
        "name": c_info.get("name", course.code),
        "credit": credit,
        "ects": ects,
        "type": course_type,
        "type_label": type_label,
        "description": c_info.get("description", ""),
        "course_url": c_info.get("course_url", f"http://{norm.lower()}.cankaya.edu.tr/"),
        "dept_url": c_info.get("dept_url", ""),
        "prerequisites": prereq_info,
        "instructor_reference": dm.instructor_references.get(norm),
        "untimed": is_untimed_course(course),
        "sections": sections_data
    }


def is_untimed_course(course):
    """Verified catalog courses without meetings may omit section choices."""
    details = dm.KNOWN_COURSE_DETAILS.get(dm.normalize_code(course.code))
    return not course.sections and details is not None


@router.post("/combinations")
def generate_schedule_combinations(req: CombinationsRequest):
    """Computes all conflict-free timetable combinations."""
    if not req.selected_courses:
        return {"count": 0, "combinations": [], "conflicts_info": "Hiçbir ders seçilmedi."}

    target_dict = {}
    missing_courses = []
    invalid_selections = []

    for code, sec_nos in req.selected_courses.items():
        norm = dm.normalize_code(code)
        course = dm.courses.get(norm)
        if not course:
            for k, c in dm.courses.items():
                if dm.normalize_code(k) == norm:
                    course = c
                    break

        if not course:
            missing_courses.append(code)
            continue

        selected_sections = []
        if not sec_nos:
            if is_untimed_course(course):
                # A verified course without weekly meetings contributes credits/ECTS
                # without occupying time. Keep it in every combination as an empty slot.
                selected_sections.append(Section(course.code, "SAATSIZ", slots=[]))
            elif not course.sections:
                invalid_selections.append(f"{code}: bu ders için şube veya haftalık saat bilgisi bulunamadı.")
            else:
                invalid_selections.append(f"{code}: en az bir şube seçin.")
        else:
            for sno in sec_nos:
                s_str = str(sno)
                if s_str in course.sections:
                    selected_sections.append(course.sections[s_str])
                else:
                    invalid_selections.append(f"{code}: {s_str} şubesi bulunamadı.")

        if selected_sections:
            target_dict[course.code] = selected_sections

    if missing_courses or invalid_selections:
        messages = [f"{code}: güncel ders listesinde bulunamadı." for code in missing_courses] + invalid_selections
        return {"count": 0, "combinations": [], "conflicts_info": "Ders ve şube seçimlerinizi kontrol edin.",
                "conflict_details": [{"kind": "selection", "message": message,
                    "action": {"type": "review_basket", "label": "Ders seçimlerini incele"}} for message in messages]}

    if not target_dict:
        return {
            "count": 0,
            "combinations": [],
            "conflicts_info": "Seçilen derslere ait geçerli şube bulunamadı."
        }

    prefs = req.preferences or {}
    custom_blocks = req.custom_blocks or {}

    raw_combos = scheduler.generate_combinations(
        target_dict,
        preferences=prefs,
        custom_blocks=custom_blocks
    )

    count = len(raw_combos)
    conflicts_info = None

    if count == 0:
        custom_block_clash_courses = []
        if custom_blocks:
            for c_code, sec_list in target_dict.items():
                if sec_list and all(scheduler.section_overlaps_custom_blocks(s, custom_blocks)[0] for s in sec_list):
                    custom_block_clash_courses.append(c_code)

        if custom_block_clash_courses:
            conflicts_info = (
                f"Seçtiğiniz {', '.join(custom_block_clash_courses)} derslerinin tüm şubeleri "
                f"eklediğiniz kişisel etkinliklerinizle (mola, yemek vb.) çakışmaktadır. "
                f"Lütfen ilgili saatteki etkinliği kaldırın veya farklı dersler seçin."
            )
        else:
            conflicts_info = (
                "Seçtiğiniz dersler/şubeler veya kişisel etkinlikler arasında çakışma oluşturmayan bir kombinasyon bulunamadı. "
                "Lütfen farklı şubeler seçmeyi veya filtre tercihlerinizi esnetmeyi deneyin."
            )

    credits = {code: dm.get_course_credits(code) for code in target_dict}
    total_credit = sum(value[0] for value in credits.values())
    total_ects = sum(value[1] for value in credits.values())
    section_payloads = {
        id(sec): {
            "course_code": sec.course_code,
            "section_no": sec.section_no,
            "instructor": sec.instructor,
            "classroom": sec.classroom,
            "slots": [slot.to_dict() for slot in sec.slots],
        }
        for sections in target_dict.values() for sec in sections
    }
    section_days = {
        id(sec): {slot.day for slot in sec.slots}
        for sections in target_dict.values() for sec in sections
    }
    serialized_combos = []
    for idx, combo in enumerate(raw_combos):
        days_used = set()
        combo_sections = []
        for sec in combo:
            days_used.update(section_days[id(sec)])
            combo_sections.append([sec.course_code, sec.section_no] if req.compact else section_payloads[id(sec)])

        serialized_combos.append({
            "index": idx,
            "total_courses": len(target_dict),
            "total_credits": total_credit,
            "total_ects": total_ects,
            "days_count": len(days_used),
            "section_refs" if req.compact else "sections": combo_sections
        })

    response = {
        "count": count,
        "combinations": serialized_combos,
        "conflicts_info": conflicts_info,
        "conflict_details": scheduler.explain_conflicts(target_dict, prefs, custom_blocks) if count == 0 else []
    }
    if req.compact:
        response["section_catalog"] = {
            code: {str(sec.section_no): section_payloads[id(sec)] for sec in sections}
            for code, sections in target_dict.items()
        }
    return response


@router.post("/prerequisites/check")
def check_prerequisites(req: PrereqCheckRequest):
    """Checks prerequisite satisfaction for an array of courses against student's passed courses."""
    passed_dict = req.passed_courses or {}
    results = {}

    for code in req.course_codes:
        norm = dm.normalize_code(code)
        info = PrerequisiteManager.check_prerequisites(norm, passed_dict, primary_dept=req.primary_dept)
        results[code] = info

    return {"results": results}


@router.post("/transcript/parse")
def parse_transcript_text(req: TranscriptTextRequest):
    """Parses raw text pasted from Oasis transcript."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Transkript metni boş olamaz.")

    parsed = TranscriptParser.parse_text(req.text)
    return parsed


@router.post("/transcript/upload")
async def upload_transcript_file(file: UploadFile = File(...)):
    """Uploads and parses a transcript file (.pdf, .txt, .html, .json)."""
    contents = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        try:
            parsed = TranscriptParser.parse_file(tmp_path)
            return parsed
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass
    else:
        try:
            raw_text = contents.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = contents.decode("latin-1")
        parsed = TranscriptParser.parse_text(raw_text)
        return parsed


@router.post("/curriculum/progress")
def get_curriculum_progress(req: CurriculumProgressRequest, response: Response):
    """Calculates curriculum progress for primary major and passed courses."""
    response.headers["Cache-Control"] = "no-store"
    progress = dm.get_curriculum_progress(
        primary_dept=req.primary_dept,
        passed_courses=req.passed_courses
    )
    return progress


from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Locate dist directory (either inside api/dist or in root dist)
DIST_DIR = os.path.join(CURRENT_DIR, "dist")
if not os.path.exists(DIST_DIR):
    DIST_DIR = os.path.join(BASE_DIR, "dist")

ASSETS_DIR = os.path.join(DIST_DIR, "assets")
if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

@app.get("/")
def root_page():
    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {
        "name": "Çankaya Schedule API",
        "status": "ok",
        "courses_count": len(dm.courses)
    }

# Register the SPA root before the compatibility router's own GET / endpoint.
app.include_router(router, prefix="/api")
app.include_router(router, prefix="/api/index.py")
app.include_router(router, prefix="")

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail=f"API route not found: {full_path}")

    target = os.path.join(DIST_DIR, full_path)
    if full_path and os.path.isfile(target):
        return FileResponse(target)

    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    return {
        "name": "Çankaya Schedule API",
        "status": "ok",
        "courses_count": len(dm.courses)
    }
