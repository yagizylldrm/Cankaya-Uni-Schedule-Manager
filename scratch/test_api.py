import urllib.request
import ssl
import json

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from ogbs_auth import get_ogbs_token

ctx = ssl._create_unverified_context()
token = get_ogbs_token()
base_url = "https://ogbs.cankaya.edu.tr/Api/InformationPack"

def get_api(endpoint, params=None):
    if params:
        query = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
        url = f"{base_url}{endpoint}?{query}"
    else:
        url = f"{base_url}{endpoint}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    })
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

import urllib.parse

# 1. Fetch curriculums for CENG (ProgramId = 157371)
print("=== 1. Curriculums for CENG (157371) ===")
currs = get_api("/WsPersonel", {"method": 700, "methodNo": 11, "Params": 157371})
print("Curriculums:", currs)

if currs and isinstance(currs, list) and len(currs) > 0:
    cur_id = currs[0][0]
    print(f"\n=== 2. Courses for CENG with Curriculum {cur_id} ===")
    param_str = f"3;157371;{cur_id}"
    courses = get_api("/WsPersonel", {"method": 700, "methodNo": 14, "Params": param_str})
    print(f"Total courses returned: {len(courses) if isinstance(courses, list) else 'N/A'}")
    if isinstance(courses, list):
        for c in courses[:8]:
            print("Course row:", c)

        # Look for ELEC courses to test GrupDersleri
        elec_courses = [c for c in courses if (len(c) > 6 and c[5] == "ELEC") or "seçmeli" in str(c).lower()]
        print(f"\nFound {len(elec_courses)} elective placeholder courses. Sample:")
        for ec in elec_courses[:3]:
            print("Elective row:", ec)
            bim_kod = ec[2]
            muf_no = cur_id
            bolum_kod = 157371
            print(f"Fetching GrupDersleri for BimKodu={bim_kod}, MufredatNo={muf_no}, BolumKodu={bolum_kod}...")
            grup = get_api("/GrupDersleri", {"BimKodu": bim_kod, "MufredatNo": muf_no, "BolumKodu": bolum_kod})
            print("GrupDersleri preview:", str(grup)[:300])

        # Test DersBilgi for a specific course e.g. CENG 111 or CENG 201
        ceng201 = next((c for c in courses if len(c) > 6 and c[5] == "CENG" and c[6] == "201"), courses[0])
        print(f"\nFetching DersBilgi for {ceng201[5]} {ceng201[6]} (BimKodu={ceng201[2]})...")
        dinfo = get_api("/DersBilgi", {"BimKodu": ceng201[2], "MufredatNo": cur_id, "BolumKodu": 157371, "lang": "tr"})
        print("DersBilgi keys:", dinfo.keys() if isinstance(dinfo, dict) else type(dinfo))
        if isinstance(dinfo, dict):
            for k in ['DersKodu', 'DersAdi', 'OnKosul', 'OnKosulEn', 'Kredi', 'Ects', 'DersIcerik', 'Amac']:
                if k in dinfo:
                    print(f"  {k}: {dinfo[k]}")
