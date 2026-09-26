import os
import sys
import json
import time
import base64
import hmac
import hashlib
import secrets
from typing import Dict, Any, Optional, Tuple, List
import requests
from bs4 import BeautifulSoup

# Secret key for encrypting and signing session tokens
# Stored in environment variable or generated per process lifecycle
_SESSION_SECRET = os.environ.get("SPORTS_SESSION_SECRET")
if not _SESSION_SECRET:
    _SESSION_SECRET = secrets.token_hex(32)

_KEY_BYTES = hashlib.sha256(_SESSION_SECRET.encode("utf-8")).digest()


def _generate_keystream(key: bytes, iv: bytes, length: int) -> bytes:
    """Generates a pseudo-random keystream using HMAC-SHA256 counter mode."""
    stream = bytearray()
    counter = 0
    while len(stream) < length:
        block = hmac.new(key, iv + counter.to_bytes(4, byteorder="big"), hashlib.sha256).digest()
        stream.extend(block)
        counter += 1
    return bytes(stream[:length])


def encrypt_session_data(data: Dict[str, Any], ttl_seconds: int = 3600) -> str:
    """
    Encrypts and MAC-authenticates session data into a URL-safe string.
    Contains timestamp/expiration check and random IV.
    """
    payload = {
        "exp": int(time.time()) + ttl_seconds,
        "data": data
    }
    plaintext = json.dumps(payload, separators=(',', ':')).encode("utf-8")
    iv = secrets.token_bytes(16)
    keystream = _generate_keystream(_KEY_BYTES, iv, len(plaintext))
    ciphertext = bytes(a ^ b for a, b in zip(plaintext, keystream))
    tag = hmac.new(_KEY_BYTES, iv + ciphertext, hashlib.sha256).digest()
    packed = iv + tag + ciphertext
    return base64.urlsafe_b64encode(packed).decode("ascii")


def decrypt_session_data(token: str) -> Dict[str, Any]:
    """
    Decrypts and validates session data token.
    Raises ValueError on tampering, format errors, or expiration.
    """
    if not token or not isinstance(token, str):
        raise ValueError("Geçersiz oturum belirteci.")
    try:
        # Add padding if needed
        rem = len(token) % 4
        padded = token + "=" * (4 - rem if rem else 0)
        packed = base64.urlsafe_b64decode(padded)
    except Exception:
        raise ValueError("Geçersiz oturum belirteci formatı.")

    if len(packed) < 16 + 32:
        raise ValueError("Belirteç boyutu geçersiz.")

    iv = packed[:16]
    tag = packed[16:48]
    ciphertext = packed[48:]

    expected_tag = hmac.new(_KEY_BYTES, iv + ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, expected_tag):
        raise ValueError("Oturum belirteci doğrulanamadı (imza geçersiz).")

    keystream = _generate_keystream(_KEY_BYTES, iv, len(ciphertext))
    plaintext = bytes(a ^ b for a, b in zip(ciphertext, keystream))

    try:
        payload = json.loads(plaintext.decode("utf-8"))
    except Exception:
        raise ValueError("Oturum verisi çözülemedi.")

    if not isinstance(payload, dict) or "exp" not in payload or "data" not in payload:
        raise ValueError("Oturum yapısı bozuk.")

    if time.time() > payload["exp"]:
        raise ValueError("Oturum süresi doldu. Lütfen tekrar giriş yapın.")

    return payload["data"]


class SportsBookingService:
    BASE_URL = os.getenv(
        "SPORTS_BASE_URL",
        "https://cankaya-sports-proxy.yagizhere.workers.dev"
    ).rstrip("/")

    @classmethod
    def _create_session(cls, cookies: Optional[Dict[str, str]] = None) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        })
        if cookies:
            session.cookies.update(cookies)
        return session

    @classmethod
    def authenticate(cls, username: str, password: str) -> Dict[str, Any]:
        """
        Authenticates against the configured sports booking service.
        Extracts ASP.NET session cookies and returns an encrypted session token.
        Credentials are never stored or returned.
        """
        if not username or not password:
            raise ValueError("Kullanıcı adı ve şifre gereklidir.")

        session = cls._create_session()
        login_url = f"{cls.BASE_URL}/Account/StudentLogin"

        try:
            get_res = session.get(login_url, timeout=15)
        except Exception as e:
            raise RuntimeError(f"Üniversite randevu sunucusuna bağlanılamadı: {e}")

        soup = BeautifulSoup(get_res.text, "html.parser")
        token_input = soup.find("input", {"name": "__RequestVerificationToken"})
        if not token_input or not token_input.get("value"):
            raise RuntimeError("Giriş güvenlik belirteci (__RequestVerificationToken) alınamadı.")

        payload = {
            "__RequestVerificationToken": token_input["value"],
            "UserName": username.strip(),
            "Password": password
        }

        try:
            post_res = session.post(login_url, data=payload, timeout=15, allow_redirects=True)
        except Exception as e:
            raise RuntimeError(f"Giriş isteği gönderilirken hata oluştu: {e}")

        # Check if still on the login page
        if "/Account/StudentLogin" in post_res.url:
            post_soup = BeautifulSoup(post_res.text, "html.parser")
            # Try to find validation messages
            error_msg = None
            err_el = post_soup.select_one(".validation-summary-errors, .field-validation-error, .text-danger")
            if err_el:
                error_msg = err_el.get_text(strip=True)
            if not error_msg or error_msg == "InvalidUserName":
                error_msg = "Kullanıcı adı veya şifre hatalı."
            raise ValueError(error_msg)

        # Check that we received session authentication cookies
        cookies_dict = session.cookies.get_dict()
        has_auth_cookie = any(
            k.startswith(".AspNet") or k == "ASP.NET_SessionId" or "Auth" in k
            for k in cookies_dict.keys()
        )
        if not has_auth_cookie and ".AspNet.ApplicationCookie" not in cookies_dict:
            # Check if redirection indicated success
            if post_res.status_code >= 400:
                raise ValueError("Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.")

        # Extract student name or welcome text if available
        post_soup = BeautifulSoup(post_res.text, "html.parser")
        student_name = ""
        user_badge = post_soup.select_one(".user-panel .info, .navbar-badge, .user-name, .dropdown-user")
        if user_badge:
            student_name = user_badge.get_text(strip=True)
        if not student_name:
            student_name = username.strip()

        token = encrypt_session_data({
            "cookies": cookies_dict,
            "username": username.strip(),
            "student_name": student_name
        })

        return {
            "success": True,
            "token": token,
            "student_name": student_name,
            "username": username.strip()
        }

    @classmethod
    def get_available_slots(
        cls,
        session_token: str,
        date_str: str,
        unit_id: str = "4",
        location_id: str = "8"
    ) -> List[Dict[str, Any]]:
        """
        Fetches sports time slots for given date, unit_id, and location_id.
        Retrieves form CSRF token from /Appointment/SeansSelection before posting,
        fulfilling ASP.NET MVC AntiForgeryToken requirements.
        """
        session_data = decrypt_session_data(session_token)
        cookies = session_data.get("cookies", {})
        session = cls._create_session(cookies)

        page_url = f"{cls.BASE_URL}/Appointment/SeansSelection"

        # 1. Fetch SeansSelection page to obtain __RequestVerificationToken
        try:
            get_res = session.get(page_url, timeout=15)
        except Exception as e:
            raise RuntimeError(f"Seans seçim sayfasına erişilemedi: {e}")

        # Check if redirected to login (session expired on university server)
        if "/Account/StudentLogin" in get_res.url or "Login" in get_res.url:
            raise ValueError("Üniversite oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.")

        soup = BeautifulSoup(get_res.text, "html.parser")
        token_input = soup.find("input", {"name": "__RequestVerificationToken"})
        token_val = token_input.get("value") if token_input else ""

        # 2. Post SeansSelection form with AntiForgeryToken, UnitId, LocationId, AppDate
        payload = {
            "__RequestVerificationToken": token_val,
            "UnitId": str(unit_id),
            "LocationId": str(location_id),
            "AppDate": date_str
        }

        try:
            post_res = session.post(page_url, data=payload, timeout=15)
        except Exception as e:
            raise RuntimeError(f"Seans listesi alınamadı: {e}")

        soup = BeautifulSoup(post_res.text, "html.parser")
        slots = []

        # Find table rows inside #customTable tbody tr or standard table
        rows = soup.select("#customTable tbody tr")
        if not rows:
            # Fallback to any table tbody tr if table id is not customTable
            rows = soup.select("table tbody tr")

        for row in rows:
            cols = row.find_all("td")
            if len(cols) < 4:
                continue

            seans_adi = cols[0].get_text(strip=True)
            baslangic = cols[1].get_text(strip=True) if len(cols) > 1 else ""
            bitis = cols[2].get_text(strip=True) if len(cols) > 2 else ""

            # If seans_adi is "Kayıt Bulunamadı" or empty
            if "bulunamadı" in seans_adi.lower() or not baslangic:
                continue

            time_slot = f"{baslangic} - {bitis}" if baslangic and bitis else seans_adi

            # Capacity / Occupancy column
            doluluk_col = cols[3] if len(cols) > 3 else None
            doluluk_text = ""
            if doluluk_col:
                span = doluluk_col.find("span")
                doluluk_text = span.get_text(strip=True) if span else doluluk_col.get_text(strip=True)

            # Booking button / link in 5th column
            link = None
            seans_id = None
            if len(cols) >= 5:
                link = cols[4].find("a")
                if link and "href" in link.attrs:
                    href = link["href"]
                    seans_id = href.rstrip("/").split("/")[-1]

            # Parse occupancy numbers if format is "XX / YY" or "XX/YY"
            capacity = None
            occupied = None
            import re
            m = re.search(r"(\d+)\s*/\s*(\d+)", doluluk_text)
            if m:
                occupied = int(m.group(1))
                capacity = int(m.group(2))

            is_full = False
            if "dolu" in doluluk_text.lower():
                is_full = True
            elif capacity is not None and occupied is not None and occupied >= capacity:
                is_full = True
            elif not seans_id:
                # If there's no booking link, check if it's full or past
                is_full = True

            slots.append({
                "seans_id": seans_id,
                "seans_adi": seans_adi,
                "baslangic": baslangic,
                "bitis": bitis,
                "time_slot": time_slot,
                "doluluk": doluluk_text,
                "occupied": occupied,
                "capacity": capacity,
                "is_full": is_full
            })

        return slots

    @classmethod
    def book_slot(cls, session_token: str, seans_id: str) -> Dict[str, Any]:
        """
        Books a session via GET /Appointment/SeansSelected/{seans_id}.
        """
        if not seans_id:
            raise ValueError("Geçerli bir seans seçilmedi.")

        session_data = decrypt_session_data(session_token)
        cookies = session_data.get("cookies", {})
        session = cls._create_session(cookies)

        endpoint = f"{cls.BASE_URL}/Appointment/SeansSelected/{seans_id}"
        try:
            res = session.get(endpoint, timeout=15)
        except Exception as e:
            raise RuntimeError(f"Randevu alma isteği başarısız oldu: {e}")

        # Check for success indicators in text
        text_lower = res.text.lower()
        if "başvurunuz alınmıştır" in text_lower or "successful" in text_lower or "başarıyla" in text_lower:
            return {
                "success": True,
                "message": "Randevunuz başarıyla oluşturuldu!"
            }

        # Check if error or warning can be parsed from page
        soup = BeautifulSoup(res.text, "html.parser")
        msg = None
        alert = soup.select_one(".alert, .sweet-alert, .swal2-title, .validation-summary-errors")
        if alert:
            msg = alert.get_text(strip=True)

        if not msg:
            if "kontenjan" in text_lower or "dolu" in text_lower:
                msg = "Seçilen seansın kontenjanı dolmuş."
            elif "zaten" in text_lower or "daha önce" in text_lower or "mevcut" in text_lower:
                msg = "Bu tarih ve saatte zaten bir randevunuz bulunmaktadır."
            else:
                msg = "Randevu alınamadı veya seans kontenjanı doldu."

        return {
            "success": False,
            "message": msg
        }
