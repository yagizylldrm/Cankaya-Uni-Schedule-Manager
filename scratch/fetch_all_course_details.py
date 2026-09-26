import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from ogbs_auth import get_ogbs_auth_header

token = get_ogbs_auth_header()
headers = {
    "Authorization": token,
    "Content-Type": "application/json"
}
base_url = "https://ogbs.cankaya.edu.tr/Api/InformationPack"

with open("scratch/course_details_to_fetch.json") as f:
    courses = json.load(f)

print(f"Fetching DersBilgi for {len(courses)} courses...")

results = {}

def fetch_one(code, item):
    bim = item["bim_kod"]
    muf = item["muf_no"]
    bol = item["bolum_kod"]
    url = f"{base_url}/DersBilgi"
    try:
        r = requests.get(url, headers=headers, params={"BimKodu": bim, "MufredatNo": muf, "BolumKodu": bol, "lang": "tr"}, timeout=10)
        if r.status_code == 200:
            d = r.json()
            return code, {
                "code": code,
                "name": item.get("name_tr", "") or d.get("DersAdi", ""),
                "name_en": item.get("name_en", ""),
                "desc": d.get("DersTanimi", "") or "",
                "type": d.get("DersTuru", "Zorunlu"),
                "prereq_raw": d.get("Prequisites", "") or "",
                "coreq_raw": d.get("Corequisites", "") or "",
                "credit": d.get("Kredi", ""),
                "ects": d.get("ECTSKredi", "")
            }
    except Exception as e:
        pass
    return code, None

count = 0
with ThreadPoolExecutor(max_workers=12) as executor:
    futures = [executor.submit(fetch_one, code, item) for code, item in courses.items()]
    for f in as_completed(futures):
        code, res = f.result()
        if res:
            results[code] = res
        count += 1
        if count % 100 == 0:
            print(f"Fetched {count}/{len(courses)} courses...")

print(f"Successfully fetched details for {len(results)} courses.")

# Save to scratch/all_course_details.json
with open("scratch/all_course_details.json", "w", encoding="utf-8") as out:
    json.dump(results, out, ensure_ascii=False, indent=2)

print("Saved to scratch/all_course_details.json!")
