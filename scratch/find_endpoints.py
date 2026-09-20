import requests
import re
import json

js = requests.get("https://bilgipaketi.cankaya.edu.tr/assets/index-CekraC_F.js").text

# Find all occurrences of Xe.get or similar API calls
calls = re.findall(r'(\w+)\.get\([`"\']([^`"\']+)[`"\']\)', js)
print("Axios get calls:")
for obj, endpoint in set(calls):
    print(f"  {endpoint}")

# Also look for any string starting with / in the context of API
patterns = re.findall(r'[`"\'](/[^`"\']*(?:Ders|Program|Bolum|Fakulte|Akademik|Mufredat|Curriculum)[^`"\']*)[`"\']', js, re.IGNORECASE)
print("\nMatched endpoints:")
for p in set(patterns):
    print(f"  {p}")
