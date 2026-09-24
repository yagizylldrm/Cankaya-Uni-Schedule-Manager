import requests
import json
import time

token = "Bearer REDACTED_OGBS_TOKEN"
headers = {
    "Authorization": token,
    "Content-Type": "application/json"
}
base_url = "https://ogbs.cankaya.edu.tr/Api/InformationPack"

# 1. Fetch faculties
r_fak = requests.get(f"{base_url}/Fakulteler?Program=L", headers=headers)
fakulteler = r_fak.json()

DEPT_NAME_TO_CODE = {
    "Bilgisayar Mühendisliği (Lisans)": "CENG",
    "Yazılım Mühendisliği": "SENG",
    "Elektrik-Elektronik Mühendisliği (Lisans)": "ECE",
    "Elektronik ve Haberleşme Mühendisliği (Lisans)": "ECE",
    "Endüstri Mühendisliği (Lisans)": "IE",
    "İnşaat Mühendisliği (Lisans)": "CE",
    "Makine Mühendisliği (Lisans)": "ME",
    "Mekatronik Mühendisliği (Lisans)": "MECE",
    "Malzeme Bilimi ve Mühendisliği (Lisans)": "MSE",
    "İç Mimarlık (Lisans)": "INAR",
    "Mimarlık (Lisans)": "ARCH",
    "Şehir ve Bölge Planlama (Lisans)": "CRP",
    "Hukuk (Lisans)": "LAW",
    "Psikoloji (Lisans)": "PSY",
    "İngiliz Dili ve Edebiyatı (Lisans)": "ELL",
    "İngilizce Mütercim ve Tercümanlık (Lisans)": "TRAN",
    "Mütercim-Tercümanlık (İngilizce) (Lisans)": "TRAN",
    "Matematik (Lisans)": "MATH",
    "İktisat (Lisans)": "ECON",
    "İşletme (Lisans)": "MAN",
    "Siyaset Bilimi ve Uluslararası İlişkiler (Lisans)": "PSIR",
    "Uluslararası Ticaret (Lisans)": "INTT",
    "Uluslararası Ticaret ve Finansman (Lisans)": "INTT",
    "Halkla İlişkiler ve Reklamcılık (Lisans)": "PRAD",
    "Yönetim Bilişim Sistemleri (Lisans)": "MIS",
    "Bankacılık ve Finans (Lisans)": "BF",
    "Bilgisayar Bilimleri (Lisans)": "CS"
}

all_dept_curricula = {}
course_details_to_fetch = {} # (bim, muf, bol) -> course_code

for f in fakulteler:
    fak_no = f.get("FakNo")
    fak_adi = f.get("FakulteAdiTr")
    r_bol = requests.get(f"{base_url}/Bolumler?Program=L&FakNo={fak_no}", headers=headers)
    if r_bol.status_code != 200:
        continue
    for b in r_bol.json():
        prog_id = b.get("ProgramId")
        prog_adi = b.get("ProgramAdi")
        dept_code = DEPT_NAME_TO_CODE.get(prog_adi)
        if not dept_code:
            continue

        r_curr = requests.get(f"{base_url}/WsPersonel", headers=headers, params={"method": 700, "methodNo": 11, "Params": prog_id})
        if r_curr.status_code != 200:
            continue
        currs = r_curr.json()
        if not currs or not isinstance(currs, list):
            continue

        latest_curr = currs[0]
        curr_id = latest_curr[0]
        curr_name = latest_curr[2]

        p_str = f"3;{prog_id};{curr_id}"
        r_courses = requests.get(f"{base_url}/WsPersonel", headers=headers, params={"method": 700, "methodNo": 14, "Params": p_str})
        if r_courses.status_code != 200:
            continue
        courses_raw = r_courses.json()
        if not courses_raw or not isinstance(courses_raw, list):
            continue

        compulsory_courses = []
        compulsory_codes = set()
        elective_groups = []

        for s in courses_raw:
            muf_no = str(s[0] or "").strip()
            bolum_kod = str(s[1] or "").strip()
            bim_kod = str(s[2] or "").strip()
            class_no = str(s[3] or "").strip()
            term_no = str(s[4] or "").strip()
            dept_p = str(s[5] or "").strip()
            num_p = str(s[6] or "").strip()
            c_code = f"{dept_p}{num_p}"
            name_tr = str(s[7] or "").strip()
            name_en = str(s[8] or "").strip()
            theory = str(s[10] or "0").strip()
            practice = str(s[11] or "0").strip()
            credit = str(s[12] or "0").strip()
            ects = str(s[13] or "0").strip().replace(",", ".")

            is_elective = dept_p.startswith("ELEC") or class_no == "Seçmeli Dersler"

            if is_elective:
                elective_groups.append({
                    "code": c_code,
                    "name": name_tr,
                    "year": class_no,
                    "term": term_no,
                    "ects": ects
                })
            else:
                compulsory_codes.add(c_code)
                compulsory_courses.append({
                    "code": c_code,
                    "dept": dept_p,
                    "num": num_p,
                    "name_tr": name_tr,
                    "name_en": name_en,
                    "year": class_no,
                    "term": term_no,
                    "credit": credit,
                    "ects": ects,
                    "bim_kod": bim_kod,
                    "muf_no": muf_no,
                    "bolum_kod": bolum_kod
                })
                if c_code not in course_details_to_fetch and bim_kod and muf_no and bolum_kod:
                    course_details_to_fetch[c_code] = {
                        "bim_kod": bim_kod,
                        "muf_no": muf_no,
                        "bolum_kod": bolum_kod,
                        "code": c_code,
                        "name_tr": name_tr,
                        "name_en": name_en
                    }

        all_dept_curricula[dept_code] = {
            "program_id": prog_id,
            "program_name": prog_adi,
            "curriculum_id": curr_id,
            "curriculum_name": curr_name,
            "compulsory_courses": compulsory_courses,
            "compulsory_codes": sorted(list(compulsory_codes)),
            "elective_count": len(elective_groups)
        }

print(f"Collected {len(all_dept_curricula)} departments curricula.")
print(f"Total unique courses with IDs: {len(course_details_to_fetch)}")

with open("api/cankaya_official_curricula.json", "w", encoding="utf-8") as out:
    json.dump(all_dept_curricula, out, ensure_ascii=False, indent=2)

with open("scratch/course_details_to_fetch.json", "w", encoding="utf-8") as out:
    json.dump(course_details_to_fetch, out, ensure_ascii=False, indent=2)

print("Curricula with course IDs saved successfully!")
