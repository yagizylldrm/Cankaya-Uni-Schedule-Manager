import urllib.request
import urllib.parse
import ssl
import re

ctx = ssl._create_unverified_context()

def safe_url(url):
    parts = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(parts.path)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))

def fetch(url):
    req = urllib.request.Request(safe_url(url), headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return f"Error: {e}"

html_dersler = fetch("https://www.cankaya.edu.tr/dersler/")
links = re.findall(r'href=["\']([^"\']*DersProgram[^"\']*)["\']', html_dersler)
print(f"Total DersProgram links found: {len(links)}")

found_count = 0
for l in links:
    url = l.strip()
    if not url.startswith("http"):
        url = "http://www.cankaya.edu.tr" + url
    content = fetch(url)
    has_sched = "Sistemde Ders Programı Bulunmamaktadır" not in content and "Error:" not in content
    if has_sched:
        found_count += 1
        print(f"Link: {url} -> Has schedule! (len: {len(content)})")
        tables = re.findall(r'<table[^>]*>.*?</table>', content, re.DOTALL)
        print(f"  Found {len(tables)} tables!")
        if tables:
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tables[0], re.DOTALL)
            for r in rows[:5]:
                cols = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.DOTALL)
                print("   ", [re.sub(r'<[^>]+>', '', c).strip() for c in cols])
        if found_count >= 2:
            break
