import json
import re

with open("scratch/all_course_details.json") as f:
    details = json.load(f)

# Rules where multiple courses are OR alternatives:
# Calculus I: MATH157 or MATH155
# Calculus II: MATH158 or MATH156
# General Math: MATH154 or MATH151
OR_PATTERNS = {
    "MATH158": ["MATH157", "MATH155"],
    "MATH154": ["MATH153", "MATH151"],
    "MATH253": ["MATH158", "MATH156"]
}

prereq_rules = {}

for code, d in sorted(details.items()):
    raw = d.get("prereq_raw", "").strip()
    if not raw or raw in ("Yok", "None", "-"):
        continue

    # Clean and split by semicolon
    parts = [re.sub(r'\s+', '', p.strip()).upper() for p in raw.split(";") if p.strip()]
    if not parts:
        continue

    # Special handling for CENG408 self-reference typo in university database
    if code == "CENG408" and parts == ["CENG408"]:
        parts = ["CENG407"]

    if code in OR_PATTERNS:
        prereq_rules[code] = {
            "type": "OR",
            "courses": OR_PATTERNS[code],
            "description": f"Bu dersi alabilmek için { ' veya '.join(OR_PATTERNS[code]) } derslerinden birini başarmış olmanız gerekir."
        }
    elif len(parts) == 1:
        prereq_rules[code] = {
            "type": "AND",
            "courses": parts,
            "description": f"Bu dersi alabilmek için {parts[0]} dersini başarmış olmanız gerekir."
        }
    else:
        # Multiple courses default to AND (e.g. CENG236 requires CENG114 and MATH158)
        prereq_rules[code] = {
            "type": "AND",
            "courses": parts,
            "description": f"Bu dersi alabilmek için { ', '.join(parts) } derslerini başarmış olmanız gerekir."
        }

print(f"Generated {len(prereq_rules)} official prerequisite rules.")

with open("cankaya_official_prerequisites.json", "w", encoding="utf-8") as out:
    json.dump(prereq_rules, out, ensure_ascii=False, indent=2)

print("Saved to cankaya_official_prerequisites.json!")
