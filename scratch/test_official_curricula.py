import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from data_manager import DataManager
from prerequisite_manager import PrerequisiteManager

def main():
    dm = DataManager()
    dm.student_profile["custom_overrides"] = {}
    print("DataManager initialized.")
    print(f"Official curricula loaded: {len(dm.official_curricula)} departments.")

    # 1. Test CENG Compulsory Courses
    print("\n--- Testing CENG Compulsory Courses ---")
    ceng_comp = ["CENG111", "CENG114", "CENG124", "EE213", "EE205", "MATH254", "CENG218", "CENG222", "CENG236", "MATH205", "CENG329", "CENG383", "CENG466", "CENG328", "CENG356", "CENG382", "CENG396", "CENG407", "CENG408", "MAN432", "CENG442", "CENG497"]
    for c in ceng_comp:
        c_type, c_label = dm.classify_course(c, primary_dept="CENG")
        assert c_type == "ZORUNLU", f"{c} should be ZORUNLU, got {c_type} ({c_label})"
        print(f"  ✅ {c:10}: {c_label}")

    # 2. Test CENG Technical Elective (Course in CENG but not compulsory)
    print("\n--- Testing CENG Technical Elective ---")
    ceng_elec = ["CENG462", "CENG475", "CENG495"]
    for c in ceng_elec:
        c_type, c_label = dm.classify_course(c, primary_dept="CENG")
        assert c_type == "TEKNIK_SECMELI", f"{c} should be TEKNIK_SECMELI, got {c_type} ({c_label})"
        print(f"  ✅ {c:10}: {c_label}")

    # 3. Test Free Elective (Course outside CENG and not compulsory)
    print("\n--- Testing Free Elective ---")
    free_courses = ["MAN201", "IE333", "ECON101"]
    for c in free_courses:
        c_type, c_label = dm.classify_course(c, primary_dept="CENG")
        assert c_type == "SERBEST_SECMELI", f"{c} should be SERBEST_SECMELI, got {c_type} ({c_label})"
        print(f"  ✅ {c:10}: {c_label}")

    # 4. Test ÇAP (Double Major)
    print("\n--- Testing ÇAP Classification ---")
    # SENG201 is compulsory in SENG, but not in CENG
    c_type, c_label = dm.classify_course("SENG201", primary_dept="CENG", secondary_dept="SENG", secondary_type="CAP")
    assert c_type == "ZORUNLU_CAP", f"SENG201 should be ZORUNLU_CAP, got {c_type} ({c_label})"
    print(f"  ✅ SENG201 (ÇAP): {c_label}")

    # 5. Test Prerequisites
    print("\n--- Testing Official Prerequisites ---")
    # CENG114 requires CENG111
    res1 = PrerequisiteManager.check_prerequisites("CENG114", {"CENG111"})
    assert res1["can_take"] is True, f"CENG114 should be takeable with CENG111: {res1}"
    res2 = PrerequisiteManager.check_prerequisites("CENG114", set())
    assert res2["can_take"] is False, f"CENG114 should NOT be takeable without CENG111: {res2}"
    print(f"  ✅ CENG114 with CENG111: {res1['message']}")
    print(f"  ✅ CENG114 without CENG111: {res2['message']}")

    # MATH158 requires MATH157 or MATH155
    res_math1 = PrerequisiteManager.check_prerequisites("MATH158", {"MATH157"})
    assert res_math1["can_take"] is True, f"MATH158 should be takeable with MATH157: {res_math1}"
    res_math2 = PrerequisiteManager.check_prerequisites("MATH158", {"MATH155"})
    assert res_math2["can_take"] is True, f"MATH158 should be takeable with MATH155: {res_math2}"
    res_math3 = PrerequisiteManager.check_prerequisites("MATH158", set())
    assert res_math3["can_take"] is False, f"MATH158 should NOT be takeable without MATH157/155: {res_math3}"
    print(f"  ✅ MATH158 with MATH157: {res_math1['message']}")
    print(f"  ✅ MATH158 without MATH: {res_math3['message']}")

    # CENG236 requires CENG114 AND MATH158
    res_ceng236_1 = PrerequisiteManager.check_prerequisites("CENG236", {"CENG114"})
    assert res_ceng236_1["can_take"] is False, "CENG236 needs both CENG114 and MATH158"
    res_ceng236_2 = PrerequisiteManager.check_prerequisites("CENG236", {"CENG114", "MATH158"})
    assert res_ceng236_2["can_take"] is True, "CENG236 satisfied with CENG114 and MATH158"
    print(f"  ✅ CENG236 check: {res_ceng236_2['message']}")

    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
