import requests
import json

token = "Bearer REDACTED_OGBS_TOKEN"
headers = {
    "Authorization": token,
    "Content-Type": "application/json"
}
base_url = "https://ogbs.cankaya.edu.tr/Api/InformationPack"

# 1. Get all undergraduate faculties
r_fak = requests.get(f"{base_url}/Fakulteler?Program=L", headers=headers)
fakulteler = r_fak.json()

programs = []
for f in fakulteler:
    fak_no = f.get("FakNo")
    fak_adi = f.get("FakulteAdiTr")
    r_bol = requests.get(f"{base_url}/Bolumler?Program=L&FakNo={fak_no}", headers=headers)
    if r_bol.status_code == 200:
        for b in r_bol.json():
            programs.append({
                "fak_no": fak_no,
                "fak_adi": fak_adi,
                "program_id": b.get("ProgramId"),
                "program_adi_tr": b.get("ProgramAdi"),
                "program_adi_en": b.get("ProgramAdiEn")
            })

print(f"Total programs: {len(programs)}")
for p in programs:
    print(f"ID: {p['program_id']} | {p['fak_adi']} -> {p['program_adi_tr']}")

# Test fetching Sayfa=10 (Akademik Program) for the first few programs
for p in programs:
    if "Bilgisayar Mühendisliği" in p["program_adi_tr"] or "Computer Engineering" in str(p["program_adi_en"]):
        print(f"\n--- Testing CENG ProgramId={p['program_id']} ---")
        r_info = requests.get(f"{base_url}/BolumBilgi", headers=headers, params={"ProgramId": p["program_id"], "Sayfa": 10})
        print("Status:", r_info.status_code)
        data = r_info.json()
        print("Data type:", type(data))
        if isinstance(data, list) and len(data) > 0:
            print("First item keys:", data[0].keys())
            print("First item:", data[0])
            print("Total items:", len(data))
        elif isinstance(data, dict):
            print("Keys:", data.keys())
            print("Sample:", str(data)[:500])
        break
