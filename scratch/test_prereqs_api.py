import requests
import json
import time

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

with open("api/cankaya_official_curricula.json") as f:
    curricula = json.load(f)

# Collect all courses with BimKodu, MufredatNo, BolumKodu
# Let's inspect CENG first
ceng_courses = curricula["CENG"]["compulsory_courses"]
print(f"Checking CENG {len(ceng_courses)} courses for prerequisites...")

prereqs = {}
for c in ceng_courses:
    code = c["code"]
    # We need BimKodu, MufredatNo, BolumKodu.
    # Where do we get them? From the raw courses list!
