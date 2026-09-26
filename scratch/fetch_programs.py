import requests
import json

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

# 1. Get Undergraduate faculties
r_fak = requests.get(f"{base_url}/Fakulteler?Program=L", headers=headers)
print("Fakulteler status:", r_fak.status_code)
fakulteler = r_fak.json()

programs = []
for f in fakulteler:
    fak_no = f.get("FakNo")
    fak_adi = f.get("FakulteAdiTr")
    r_bol = requests.get(f"{base_url}/Bolumler?Program=L&FakNo={fak_no}", headers=headers)
    if r_bol.status_code == 200:
        bolumler = r_bol.json()
        for b in bolumler:
            programs.append({
                "fak_no": fak_no,
                "fak_adi": fak_adi,
                "program_id": b.get("ProgramId"),
                "bolum_kodu": b.get("BolumKodu"),
                "program_adi_tr": b.get("ProgramAdiTr"),
                "program_adi_en": b.get("ProgramAdiEn")
            })

print(f"Total undergraduate programs: {len(programs)}")
for p in programs[:15]:
    print(f"  ID: {p['program_id']} | Kodu: {p['bolum_kodu']} | {p['program_adi_tr']}")

# Save program list to scratch
with open("scratch/cankaya_programs.json", "w", encoding="utf-8") as out:
    json.dump(programs, out, ensure_ascii=False, indent=2)
