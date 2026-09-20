import requests
import re

js = requests.get("https://bilgipaketi.cankaya.edu.tr/assets/index-CekraC_F.js").text

# Look for headers or tokens in Axios instance creation
matches = re.findall(r'.{0,100}(?:Authorization|headers|create\(\{).*?baseURL.{0,100}', js, re.IGNORECASE)
for m in matches:
    print("Match:", m)

# Find where baseURL is defined
base_matches = re.findall(r'.{0,50}https://ogbs.cankaya.edu.tr/Api/InformationPack.{0,100}', js)
for m in base_matches:
    print("Base Match:", m)
