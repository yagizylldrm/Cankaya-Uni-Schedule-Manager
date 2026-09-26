import os
import sys
import json
import time
import base64
import hmac
import hashlib
import logging
import secrets
import re
from datetime import datetime
import urllib.parse
from typing import Dict, Any, Optional, Tuple, List, Set
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# --- Typed Exceptions ---

class SportsError(ValueError):
    """Spor randevu sistemi temel hata sınıfı."""
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class SportsInputError(SportsError):
    def __init__(self, message: str):
        super().__init__("INVALID_INPUT", message, status_code=400)


class SportsAuthenticationError(SportsError):
    def __init__(self, message: str = "Kullanıcı adı veya şifre hatalı."):
        super().__init__("INVALID_CREDENTIALS", message, status_code=401)


class SportsSessionExpiredError(SportsError):
    def __init__(self, message: str = "Oturum süreniz doldu. Lütfen tekrar giriş yapın."):
        super().__init__("SESSION_EXPIRED", message, status_code=401)


class SportsSessionInvalidError(SportsError):
    def __init__(self, message: str = "Geçersiz oturum belirteci."):
        super().__init__("SESSION_INVALID", message, status_code=401)


class SportsUpstreamError(SportsError):
    def __init__(self, message: str = "Üniversite randevu servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin."):
        super().__init__("UPSTREAM_ERROR", message, status_code=502)


class SportsParseError(SportsError):
    def __init__(self, message: str = "Randevu verisi işlenirken beklenmeyen bir yanıt alındı."):
        super().__init__("PARSE_ERROR", message, status_code=502)


# --- Cryptographic Session Token Management ---

_DEV_TRANSIENT_SECRET: Optional[str] = None


def _get_secret_key() -> bytes:
    """
    Oturum şifreleme ve imzalama için 256-bit anahtar üretir.
    Üretim ortamında SPORTS_SESSION_SECRET zorunludur ve en az 32 karakter olmalıdır.
    """
    secret = os.environ.get("SPORTS_SESSION_SECRET", "").strip()
    is_prod = bool(os.environ.get("VERCEL") or os.environ.get("ENVIRONMENT") == "production")

    if is_prod:
        if not secret or len(secret) < 32:
            raise RuntimeError(
                "Üretim ortamında SPORTS_SESSION_SECRET ortam değişkeni zorunludur ve en az 32 karakter olmalıdır."
            )
        return hashlib.sha256(secret.encode("utf-8")).digest()

    if not secret:
        global _DEV_TRANSIENT_SECRET
        if not _DEV_TRANSIENT_SECRET:
            _DEV_TRANSIENT_SECRET = secrets.token_hex(32)
        secret = _DEV_TRANSIENT_SECRET

    return hashlib.sha256(secret.encode("utf-8")).digest()


def _generate_keystream(key: bytes, iv: bytes, length: int) -> bytes:
    """HMAC-SHA256 counter mode ile pseudo-random keystream üretir."""
    stream = bytearray()
    counter = 0
    while len(stream) < length:
        block = hmac.new(key, iv + counter.to_bytes(4, byteorder="big"), hashlib.sha256).digest()
        stream.extend(block)
        counter += 1
    return bytes(stream[:length])


def encrypt_session_data(data: Dict[str, Any], ttl_seconds: int = 3600) -> str:
    """
    Oturum verilerini şifreler ve HMAC-SHA256 ile doğrulanabilir URL-safe bir dizgiye dönüştürür.
    Rastgele 16 byte IV ve son kullanma zamanı (exp) içerir.
    """
    key = _get_secret_key()
    payload = {
        "exp": int(time.time()) + ttl_seconds,
        "data": data
    }
    plaintext = json.dumps(payload, separators=(',', ':')).encode("utf-8")
    iv = secrets.token_bytes(16)
    keystream = _generate_keystream(key, iv, len(plaintext))
    ciphertext = bytes(a ^ b for a, b in zip(plaintext, keystream))
    tag = hmac.new(key, iv + ciphertext, hashlib.sha256).digest()
    packed = iv + tag + ciphertext
    return base64.urlsafe_b64encode(packed).decode("ascii")


def decrypt_session_data(token: str) -> Dict[str, Any]:
    """
    Oturum belirtecini çözer ve doğrular.
    Format bozukluğu veya imza uyuşmazlığında SportsSessionInvalidError,
    süresi dolmuşsa SportsSessionExpiredError fırlatır.
    """
    if not token or not isinstance(token, str) or len(token) > 4096:
        raise SportsSessionInvalidError("Geçersiz oturum belirteci.")

    try:
        rem = len(token) % 4
        padded = token + "=" * (4 - rem if rem else 0)
        packed = base64.urlsafe_b64decode(padded)
    except Exception:
        raise SportsSessionInvalidError("Geçersiz oturum belirteci formatı.")

    if len(packed) < 16 + 32:
        raise SportsSessionInvalidError("Belirteç boyutu geçersiz.")

    iv = packed[:16]
    tag = packed[16:48]
    ciphertext = packed[48:]

    key = _get_secret_key()
    expected_tag = hmac.new(key, iv + ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, expected_tag):
        raise SportsSessionInvalidError("Oturum belirteci doğrulanamadı (imza geçersiz).")

    keystream = _generate_keystream(key, iv, len(ciphertext))
    plaintext = bytes(a ^ b for a, b in zip(ciphertext, keystream))

    try:
        payload = json.loads(plaintext.decode("utf-8"))
    except Exception:
        raise SportsSessionInvalidError("Oturum verisi çözülemedi.")

    if not isinstance(payload, dict) or "exp" not in payload or "data" not in payload:
        raise SportsSessionInvalidError("Oturum veri yapısı bozuk.")

    if not isinstance(payload.get("data"), dict):
        raise SportsSessionInvalidError("Oturum içeriği geçersiz.")

    if time.time() > payload["exp"]:
        raise SportsSessionExpiredError("Oturum süresi doldu. Lütfen tekrar giriş yapın.")

    return payload["data"]


# --- Service Implementation ---

class _SportsBookingMeta(type):
    @property
    def BASE_URL(cls) -> str:
        return cls.get_base_url()


class SportsBookingService(metaclass=_SportsBookingMeta):
    TIMEOUT = (10, 30)

    @classmethod
    def get_base_url(cls) -> str:
        """
        Spor randevu servisi URL'ini doğrular ve döner.
        Üretim ortamında kullanıcının ngrok reverse proxy HTTPS adresi (SPORTS_BASE_URL) zorunludur.
        Path, query veya fragment içeremez.
        """
        raw_url = os.environ.get("SPORTS_BASE_URL", "").strip().rstrip("/")
        is_prod = bool(os.environ.get("VERCEL") or os.environ.get("ENVIRONMENT") == "production")

        if is_prod:
            if not raw_url:
                raise RuntimeError(
                    "Üretim ortamında SPORTS_BASE_URL ortam değişkeni zorunludur. "
                    "Kullanıcıya ait güvenli ngrok HTTPS reverse proxy adresi tanımlanmalıdır."
                )
            parsed = urllib.parse.urlparse(raw_url)
            if parsed.scheme != "https" or not parsed.netloc:
                raise RuntimeError(f"SPORTS_BASE_URL geçerli bir HTTPS adresi olmalıdır: {raw_url}")
            if parsed.path or parsed.query or parsed.fragment:
                raise RuntimeError(f"SPORTS_BASE_URL yalnız origin olmalıdır: {raw_url}")
            return f"https://{parsed.netloc}"

        if raw_url:
            parsed = urllib.parse.urlparse(raw_url)
            if parsed.scheme in ("http", "https") and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
            return raw_url

        # Development/Test default: standard university endpoint
        return "https://randevu.cankaya.edu.tr"

    @classmethod
    def _create_session(cls, cookies: Optional[Dict[str, str]] = None) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate",
            "ngrok-skip-browser-warning": "true",
        })
        if cookies:
            session.cookies.update(cookies)
        return session

    @classmethod
    def _validate_date(cls, date_str: str) -> str:
        """Tarihin tam GG.AA.YYYY formatında ve geçerli bir takvim tarihi olduğunu doğrular."""
        if not date_str or not isinstance(date_str, str):
            raise SportsInputError("Tarih parametresi zorunludur.")
        cleaned = date_str.strip()
        try:
            datetime.strptime(cleaned, "%d.%m.%Y")
        except ValueError:
            raise SportsInputError("Geçersiz tarih formatı. Tarih GG.AA.YYYY biçiminde olmalıdır (örn: 28.09.2026).")
        return cleaned

    @classmethod
    def _validate_numeric_id(cls, val: Any, field_name: str) -> str:
        """Sayısal ID alanlarını doğrular, URL injection ve geçersiz karakterleri engeller."""
        s = str(val).strip() if val is not None else ""
        if not s or not re.fullmatch(r"\d{1,10}", s):
            raise SportsInputError(f"Geçersiz {field_name}: {val}")
        return s

    @classmethod
    def _validate_redirects(cls, response: requests.Response, base_url: str):
        """Yönlendirmelerin yalnız izin verilen HTTPS hedeflerine yapıldığını denetler."""
        base_parsed = urllib.parse.urlparse(base_url)
        allowed_hosts = {base_parsed.netloc.lower(), "randevu.cankaya.edu.tr"}

        for r in response.history:
            loc = r.headers.get("Location")
            if loc:
                parsed_loc = urllib.parse.urlparse(loc)
                if parsed_loc.netloc and parsed_loc.netloc.lower() not in allowed_hosts:
                    logger.warning("Unsafe redirect target blocked: %s", parsed_loc.netloc)
                    raise SportsUpstreamError("Güvenli olmayan harici yönlendirme engellendi.")

    @classmethod
    def authenticate(cls, username: str, password: str) -> Dict[str, Any]:
        """
        Öğrenci kimlik bilgilerini üniversite randevu sistemine iletir.
        Başarılı olursa ASP.NET oturum çerezlerini şifreleyerek token döner.
        Kullanıcı adı ve şifre kalıcı olarak saklanmaz veya döndürülmez.
        """
        if not username or not isinstance(username, str) or not username.strip():
            raise SportsInputError("Kullanıcı adı gereklidir.")
        if not password or not isinstance(password, str):
            raise SportsInputError("Şifre gereklidir.")

        clean_user = username.strip()
        if len(clean_user) > 64:
            raise SportsInputError("Kullanıcı adı en fazla 64 karakter olabilir.")
        if len(password) > 128:
            raise SportsInputError("Şifre en fazla 128 karakter olabilir.")

        base_url = cls.get_base_url()
        login_url = f"{base_url}/Account/StudentLogin"
        session = cls._create_session()

        try:
            get_res = session.get(login_url, timeout=cls.TIMEOUT, allow_redirects=True)
            cls._validate_redirects(get_res, base_url)
        except requests.RequestException as e:
            logger.warning("Failed to reach login page: %s", type(e).__name__)
            raise SportsUpstreamError("Üniversite randevu sunucusuna bağlanılamadı.")

        if get_res.status_code >= 400:
            content_type = get_res.headers.get("Content-Type", "")
            preview = " ".join(get_res.text[:300].split())
            logger.warning("Login page HTTP %s (type: %s, url: %s)", get_res.status_code, content_type, get_res.url)
            raise SportsUpstreamError(
                f"Randevu servisi yanıt vermiyor (HTTP {get_res.status_code}, {content_type}, url: {get_res.url}, preview: {preview})"
            )

        soup = BeautifulSoup(get_res.text, "html.parser")
        token_input = soup.find("input", {"name": "__RequestVerificationToken"})
        if not token_input or not token_input.get("value"):
            content_type = get_res.headers.get("Content-Type", "bilinmiyor")
            response_preview = " ".join(get_res.text[:300].split())
            logger.warning("CSRF token missing on login page: HTTP %s, type: %s", get_res.status_code, content_type)
            raise SportsUpstreamError(
                f"Giriş güvenlik belirteci (__RequestVerificationToken) alınamadı. "
                f"HTTP {get_res.status_code}, Content-Type: {content_type}, "
                f"Son URL: {get_res.url}, Yanıt: {response_preview}"
            )

        payload = {
            "__RequestVerificationToken": token_input["value"],
            "UserName": clean_user,
            "Password": password
        }

        try:
            post_res = session.post(
                login_url,
                data=payload,
                headers={
                    "Origin": base_url,
                    "Referer": f"{base_url}/Account/StudentLogin",
                },
                timeout=cls.TIMEOUT,
                allow_redirects=True,
            )
            cls._validate_redirects(post_res, base_url)
        except requests.RequestException as e:
            logger.warning("Login POST failed: %s", type(e).__name__)
            raise SportsUpstreamError("Giriş isteği gönderilirken bağlantı hatası oluştu.")

        # Giriş sayfası URL'inde kalındıysa kimlik doğrulama başarısızdır
        if "/Account/StudentLogin" in post_res.url:
            post_soup = BeautifulSoup(post_res.text, "html.parser")
            error_msg = None
            err_el = post_soup.select_one(".validation-summary-errors, .field-validation-error, .text-danger")
            if err_el:
                error_msg = err_el.get_text(strip=True)
            if not error_msg or error_msg == "InvalidUserName":
                error_msg = "Kullanıcı adı veya şifre hatalı."
            raise SportsAuthenticationError(error_msg)

        cookies_dict = session.cookies.get_dict()
        has_auth_cookie = any(
            k.startswith(".AspNet") or k == "ASP.NET_SessionId" or "Auth" in k
            for k in cookies_dict.keys()
        )
        if not has_auth_cookie and ".AspNet.ApplicationCookie" not in cookies_dict:
            if post_res.status_code >= 400:
                raise SportsAuthenticationError("Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.")

        # Öğrenci adını sayfadan güvenli şekilde çıkar
        post_soup = BeautifulSoup(post_res.text, "html.parser")
        student_name = ""
        user_badge = post_soup.select_one(".user-panel .info, .navbar-badge, .user-name, .dropdown-user")
        if user_badge:
            student_name = user_badge.get_text(strip=True)
        if not student_name:
            student_name = clean_user

        token = encrypt_session_data({
            "cookies": cookies_dict,
            "username": clean_user,
            "student_name": student_name[:100]
        })

        return {
            "success": True,
            "token": token,
            "student_name": student_name[:100],
            "username": clean_user
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
        Belirtilen tarih ve tesis için randevu seanslarını çeker.
        ASP.NET MVC AntiForgeryToken gereksinimini GET SeansSelection üzerinden karşılar.
        """
        clean_date = cls._validate_date(date_str)
        clean_unit = cls._validate_numeric_id(unit_id, "Birim ID")
        clean_loc = cls._validate_numeric_id(location_id, "Tesis ID")

        session_data = decrypt_session_data(session_token)
        cookies = session_data.get("cookies", {})
        session = cls._create_session(cookies)

        base_url = cls.get_base_url()
        page_url = f"{base_url}/Appointment/SeansSelection"

        # 1. Seans seçim sayfasını aç ve __RequestVerificationToken al
        try:
            get_res = session.get(page_url, timeout=cls.TIMEOUT, allow_redirects=True)
            cls._validate_redirects(get_res, base_url)
        except requests.RequestException as e:
            logger.warning("Failed to reach SeansSelection: %s", type(e).__name__)
            raise SportsUpstreamError("Seans seçim sayfasına erişilemedi.")

        if "/Account/StudentLogin" in get_res.url or "Login" in get_res.url:
            raise SportsSessionExpiredError("Üniversite oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.")

        soup = BeautifulSoup(get_res.text, "html.parser")
        token_input = soup.find("input", {"name": "__RequestVerificationToken"})
        token_val = token_input.get("value") if token_input else ""

        if not token_val:
            logger.warning("Verification token missing on SeansSelection page")
            raise SportsUpstreamError("Seans sayfası güvenlik belirteci alınamadı.")

        # 2. Formu post et
        payload = {
            "__RequestVerificationToken": token_val,
            "UnitId": clean_unit,
            "LocationId": clean_loc,
            "AppDate": clean_date
        }

        try:
            post_res = session.post(page_url, data=payload, timeout=cls.TIMEOUT, allow_redirects=True)
            cls._validate_redirects(post_res, base_url)
        except requests.RequestException as e:
            logger.warning("SeansSelection POST failed: %s", type(e).__name__)
            raise SportsUpstreamError("Seans listesi alınamadı.")

        if "/Account/StudentLogin" in post_res.url or "Login" in post_res.url:
            raise SportsSessionExpiredError("Üniversite oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.")

        soup = BeautifulSoup(post_res.text, "html.parser")
        table = soup.select_one("#customTable, table")

        # Tablo bulunamadıysa: açık 'kayıt bulunamadı' mesajı varsa boş dön, yoksa parse error
        if not table:
            page_text = soup.get_text().lower()
            if "kayıt bulunamadı" in page_text or "kayıt bulunamamıştır" in page_text or "seans bulunmamaktadır" in page_text:
                return []
            raise SportsParseError("Seans tablosu HTML içinde bulunamadı.")

        rows = table.select("tbody tr")
        slots: List[Dict[str, Any]] = []

        for row in rows:
            cols = row.find_all("td")
            if len(cols) < 4:
                continue

            seans_adi = cols[0].get_text(strip=True)
            baslangic = cols[1].get_text(strip=True) if len(cols) > 1 else ""
            bitis = cols[2].get_text(strip=True) if len(cols) > 2 else ""

            if "bulunamadı" in seans_adi.lower() or not baslangic:
                continue

            time_slot = f"{baslangic} - {bitis}" if baslangic and bitis else seans_adi

            doluluk_col = cols[3] if len(cols) > 3 else None
            doluluk_text = ""
            if doluluk_col:
                span = doluluk_col.find("span")
                doluluk_text = span.get_text(strip=True) if span else doluluk_col.get_text(strip=True)

            seans_id = None
            if len(cols) >= 5:
                link = cols[4].find("a")
                if link and "href" in link.attrs:
                    href = link["href"].strip()
                    m_href = re.search(r"/Appointment/SeansSelected/(\d+)", href)
                    if m_href:
                        seans_id = m_href.group(1)

            capacity = None
            occupied = None
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
        Seçilen seans için rezervasyon oluşturur (/Appointment/SeansSelected/{seans_id}).
        """
        clean_seans = cls._validate_numeric_id(seans_id, "Seans ID")

        session_data = decrypt_session_data(session_token)
        cookies = session_data.get("cookies", {})
        session = cls._create_session(cookies)

        base_url = cls.get_base_url()
        endpoint = f"{base_url}/Appointment/SeansSelected/{clean_seans}"

        try:
            res = session.get(endpoint, timeout=cls.TIMEOUT, allow_redirects=True)
            cls._validate_redirects(res, base_url)
        except requests.RequestException as e:
            logger.warning("Booking GET failed: %s", type(e).__name__)
            raise SportsUpstreamError("Randevu alma isteği başarısız oldu. Lütfen tekrar deneyin.")

        if "/Account/StudentLogin" in res.url or "Login" in res.url:
            raise SportsSessionExpiredError("Üniversite oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.")

        text_lower = res.text.lower()
        if "başvurunuz alınmıştır" in text_lower or "randevunuz başarıyla" in text_lower:
            return {
                "success": True,
                "message": "Randevunuz başarıyla oluşturuldu!"
            }

        # Hata uyarısını DOM'dan ayrıştır
        soup = BeautifulSoup(res.text, "html.parser")
        msg = None
        alert = soup.select_one(".alert, .sweet-alert, .swal2-title, .validation-summary-errors, .alert-danger")
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

