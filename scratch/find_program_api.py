import requests
import re

js = requests.get("https://bilgipaketi.cankaya.edu.tr/assets/index-CekraC_F.js").text

# Find where ProgramId is used in API requests or URL constructions
matches = re.findall(r'.{0,60}ProgramId.{0,100}', js)
print("Matches with ProgramId:")
for m in matches[:20]:
    print(" ", m.strip())

# Find all endpoints with parameter query
query_endpoints = re.findall(r'[`"\'](/[a-zA-Z0-9_\?\&=\${}]+)[`"\']', js)
print("\nEndpoints with queries:")
for q in set(query_endpoints):
    print(" ", q)
