import requests
import re

js = requests.get("https://bilgipaketi.cankaya.edu.tr/assets/index-CekraC_F.js").text

matches = re.findall(r'.{0,100}academic_program.{0,200}', js)
for m in matches:
    print("Match:", m.strip())
