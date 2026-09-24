import requests
import json
import time

token = "Bearer REDACTED_OGBS_TOKEN"
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
