import requests
import re

js = requests.get("https://bilgipaketi.cankaya.edu.tr/assets/index-CekraC_F.js").text

matches = re.findall(r'.{0,60}Sayfa.{0,100}', js)
for m in matches:
    print(m.strip())
