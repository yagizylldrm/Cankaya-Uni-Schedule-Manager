import requests
import re
import json

js = requests.get("https://bilgipaketi.cankaya.edu.tr/assets/index-CekraC_F.js").text
print("JS length:", len(js))

# Look for API endpoints or base URL
endpoints = set(re.findall(r'["\'](/api/[^"\']+)["\']', js))
print("API endpoints found:", endpoints)

urls = set(re.findall(r'https?://[a-zA-Z0-9\.\-\_\:\/]+', js))
cankaya_urls = [u for u in urls if "cankaya" in u]
print("Cankaya URLs:", cankaya_urls)

# Search for keywords like "lisans", "akademik", "zorunlu", "program"
matches = re.findall(r'.{0,50}(?:akademik-program|bolum|department|mufredat|curriculum).{0,50}', js, re.IGNORECASE)
print(f"Total keyword matches: {len(matches)}")
for m in matches[:10]:
    print("Match:", m)
