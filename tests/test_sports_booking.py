import os
import subprocess
import sys
import unittest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from api.index import app
from api import index as api_index
from api.sports_booking import (
    SportsBookingService,
    SportsError,
    SportsInputError,
    SportsAuthenticationError,
    SportsSessionExpiredError,
    SportsSessionInvalidError,
    SportsUpstreamError,
    SportsParseError,
    encrypt_session_data,
    decrypt_session_data
)

client = TestClient(app)


class SportsBookingTests(unittest.TestCase):
    def test_default_base_url_uses_standard_origin(self):
        url = SportsBookingService.get_base_url()
        self.assertTrue(url.startswith("https://"))
        self.assertNotIn("cankaya-sports-proxy.yagizhere.workers.dev", url)

    def test_session_uses_browser_headers_without_overriding_host(self):
        session = SportsBookingService._create_session()

        self.assertEqual(SportsBookingService.TIMEOUT, (10, 30))
        self.assertEqual(
            session.headers["User-Agent"],
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        )
        self.assertEqual(
            session.headers["Accept"],
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        )
        self.assertEqual(
            session.headers["Accept-Language"],
            "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        )
        self.assertEqual(session.headers["Accept-Encoding"], "gzip, deflate")
        self.assertEqual(session.headers["ngrok-skip-browser-warning"], "true")
        self.assertNotIn("Host", session.headers)

    def test_base_url_can_be_overridden_with_environment_variable(self):
        env = os.environ.copy()
        env["SPORTS_BASE_URL"] = "https://sports.example.test/"
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from api.sports_booking import SportsBookingService; print(SportsBookingService.get_base_url())"
            ],
            capture_output=True,
            check=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
            env=env,
            text=True
        )
        self.assertEqual(result.stdout.strip(), "https://sports.example.test")

    def test_base_url_validation_in_production(self):
        env = os.environ.copy()
        env["VERCEL"] = "1"
        env.pop("SPORTS_BASE_URL", None)

        # Missing SPORTS_BASE_URL in production raises error
        res_missing = subprocess.run(
            [
                sys.executable,
                "-c",
                "from api.sports_booking import SportsBookingService; SportsBookingService.get_base_url()"
            ],
            capture_output=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
            env=env,
            text=True
        )
        self.assertNotEqual(res_missing.returncode, 0)
        self.assertIn("SPORTS_BASE_URL", res_missing.stderr)

        # Non-HTTPS URL in production raises error
        env["SPORTS_BASE_URL"] = "http://insecure-tunnel.ngrok-free.app"
        res_http = subprocess.run(
            [
                sys.executable,
                "-c",
                "from api.sports_booking import SportsBookingService; SportsBookingService.get_base_url()"
            ],
            capture_output=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
            env=env,
            text=True
        )
        self.assertNotEqual(res_http.returncode, 0)

        # Path in origin in production raises error
        env["SPORTS_BASE_URL"] = "https://my-tunnel.ngrok-free.app/some/path"
        res_path = subprocess.run(
            [
                sys.executable,
                "-c",
                "from api.sports_booking import SportsBookingService; SportsBookingService.get_base_url()"
            ],
            capture_output=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
            env=env,
            text=True
        )
        self.assertNotEqual(res_path.returncode, 0)

    def test_session_secret_enforced_in_production(self):
        env = os.environ.copy()
        env["VERCEL"] = "1"
        env.pop("SPORTS_SESSION_SECRET", None)

        res = subprocess.run(
            [
                sys.executable,
                "-c",
                "from api.sports_booking import _get_secret_key; _get_secret_key()"
            ],
            capture_output=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
            env=env,
            text=True
        )
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("SPORTS_SESSION_SECRET", res.stderr)

    def test_cross_process_secret_consistency(self):
        secret = "super_secret_key_for_testing_1234567890_at_least_32_chars"
        env = os.environ.copy()
        env["SPORTS_SESSION_SECRET"] = secret

        # Process 1 creates token
        res1 = subprocess.run(
            [
                sys.executable,
                "-c",
                "from api.sports_booking import encrypt_session_data; print(encrypt_session_data({'user': 'proc1'}))"
            ],
            capture_output=True,
            check=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
            env=env,
            text=True
        )
        token = res1.stdout.strip()

        # Process 2 decrypts token
        res2 = subprocess.run(
            [
                sys.executable,
                "-c",
                f"from api.sports_booking import decrypt_session_data; import json; print(json.dumps(decrypt_session_data('{token}')))"
            ],
            capture_output=True,
            check=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
            env=env,
            text=True
        )
        data = json.loads(res2.stdout.strip())
        self.assertEqual(data["user"], "proc1")

    def test_login_upstream_error_hides_response_diagnostics(self):
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.headers = {"Content-Type": "text/html; charset=UTF-8"}
        base_url = SportsBookingService.get_base_url()
        mock_response.url = f"{base_url}/cdn-cgi/challenge-platform"
        mock_response.text = "<html>\n  <title>Just a moment...</title>\n  Cloudflare challenge\n</html>"
        mock_response.history = []

        with patch("requests.Session.get", return_value=mock_response) as mock_get:
            with self.assertRaises(SportsUpstreamError) as context:
                SportsBookingService.authenticate("student", "password")

        mock_get.assert_called_once_with(
            f"{base_url}/Account/StudentLogin",
            timeout=(10, 30),
            allow_redirects=True
        )
        message = str(context.exception)
        self.assertEqual(
            message,
            "Üniversite randevu servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin."
        )
        self.assertNotIn("HTTP 403", message)
        self.assertNotIn("text/html", message)
        self.assertNotIn("/cdn-cgi/challenge-platform", message)
        self.assertNotIn("Just a moment...", message)

    def test_missing_login_token_hides_response_diagnostics(self):
        mock_response = MagicMock(
            status_code=200,
            headers={"Content-Type": "text/html"},
            url="https://secret-tunnel.ngrok-free.app/internal",
            text="<html>secret upstream body</html>",
            history=[],
        )

        with patch("requests.Session.get", return_value=mock_response):
            with self.assertRaises(SportsUpstreamError) as context:
                SportsBookingService.authenticate("student", "password")

        message = str(context.exception)
        self.assertEqual(message, "Üniversite randevu servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin.")
        self.assertNotIn("secret", message)
        self.assertNotIn("ngrok", message)
        self.assertNotIn("text/html", message)

    def test_login_post_uses_origin_and_referer_headers(self):
        base_url = SportsBookingService.get_base_url()
        login_url = f"{base_url}/Account/StudentLogin"

        get_response = MagicMock()
        get_response.status_code = 200
        get_response.headers = {"Content-Type": "text/html; charset=UTF-8"}
        get_response.url = login_url
        get_response.history = []
        get_response.text = (
            '<form><input name="__RequestVerificationToken" '
            'type="hidden" value="CSRF_TOKEN" /></form>'
        )

        post_response = MagicMock()
        post_response.status_code = 302
        post_response.url = f"{base_url}/Appointment/Index"
        post_response.history = []
        post_response.text = "<html>Authenticated</html>"

        session = SportsBookingService._create_session()
        session.cookies.set(".AspNet.ApplicationCookie", "auth_cookie")

        with patch.object(
            SportsBookingService, "_create_session", return_value=session
        ), patch.object(
            session, "get", return_value=get_response
        ), patch.object(
            session, "post", return_value=post_response
        ) as mock_post:
            SportsBookingService.authenticate("student", "password")

        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["headers"]["Origin"], base_url)
        self.assertEqual(kwargs["headers"]["Referer"], login_url)
        self.assertEqual(kwargs["timeout"], (10, 30))
        self.assertTrue(kwargs["allow_redirects"])

    def test_session_token_encryption_decryption(self):
        data = {
            "cookies": {".AspNet.ApplicationCookie": "cookie_xyz_123"},
            "username": "202011001",
            "student_name": "Test Student"
        }
        token = encrypt_session_data(data, ttl_seconds=600)
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 20)

        decrypted = decrypt_session_data(token)
        self.assertEqual(decrypted["username"], "202011001")
        self.assertEqual(decrypted["student_name"], "Test Student")
        self.assertEqual(decrypted["cookies"][".AspNet.ApplicationCookie"], "cookie_xyz_123")

    def test_session_token_tampering_rejected(self):
        data = {"user": "alice"}
        token = encrypt_session_data(data)
        # Deterministically alter a character inside the ciphertext/tag
        tampered_char = "Z" if token[10] != "Z" else "Y"
        tampered = token[:10] + tampered_char + token[11:]
        with self.assertRaises(SportsSessionInvalidError):
            decrypt_session_data(tampered)

    def test_session_token_expired_rejected(self):
        data = {"user": "bob"}
        token = encrypt_session_data(data, ttl_seconds=-10)
        with self.assertRaises(SportsSessionExpiredError):
            decrypt_session_data(token)

    def test_session_token_wrong_version_rejected(self):
        data = {"user": "carol"}
        token = encrypt_session_data(data)
        import base64
        rem = len(token) % 4
        padded = token + "=" * (4 - rem if rem else 0)
        raw = bytearray(base64.urlsafe_b64decode(padded))
        # Modify version byte from 0x01 to 0x02
        raw[0] = 0x02
        tampered_version = base64.urlsafe_b64encode(bytes(raw)).decode("ascii")
        with self.assertRaises(SportsSessionInvalidError) as ctx:
            decrypt_session_data(tampered_version)
        self.assertIn("sürüm", str(ctx.exception).lower())

    def test_session_token_corrupted_tag_rejected(self):
        data = {"user": "dave"}
        token = encrypt_session_data(data)
        import base64
        rem = len(token) % 4
        padded = token + "=" * (4 - rem if rem else 0)
        raw = bytearray(base64.urlsafe_b64decode(padded))
        # Byte layout: 1B version, 12B nonce, then ciphertext+tag (AES-GCM tag is last 16 bytes)
        raw[-1] ^= 0xFF
        corrupted_token = base64.urlsafe_b64encode(bytes(raw)).decode("ascii")
        with self.assertRaises(SportsSessionInvalidError) as ctx:
            decrypt_session_data(corrupted_token)
        self.assertIn("doğrulanamadı", str(ctx.exception).lower())

    def test_input_validation(self):
        # Invalid date format
        with self.assertRaises(SportsInputError):
            SportsBookingService._validate_date("2026-09-28")
        with self.assertRaises(SportsInputError):
            SportsBookingService._validate_date("32.09.2026")
        self.assertEqual(SportsBookingService._validate_date("28.09.2026"), "28.09.2026")

        # Invalid numeric IDs
        with self.assertRaises(SportsInputError):
            SportsBookingService._validate_numeric_id("abc", "Birim ID")
        with self.assertRaises(SportsInputError):
            SportsBookingService._validate_numeric_id("../hack", "Seans ID")
        self.assertEqual(SportsBookingService._validate_numeric_id("101", "Seans ID"), "101")

        # Invalid login inputs
        with self.assertRaises(SportsInputError):
            SportsBookingService.authenticate("", "pass")
        with self.assertRaises(SportsInputError):
            SportsBookingService.authenticate("user", "")

    def test_get_available_slots_html_parsing(self):
        mock_html = """
        <html>
        <body>
            <table id="customTable">
                <thead>
                    <tr>
                        <th>Seans Adı</th>
                        <th>Başlangıç</th>
                        <th>Bitiş</th>
                        <th>Doluluk</th>
                        <th>İşlem</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Fitness Seansı 1</td>
                        <td>09:00</td>
                        <td>10:00</td>
                        <td><span class="badge badge-success">14 / 25</span></td>
                        <td><a href="/Appointment/SeansSelected/101" class="btn btn-primary">Seç</a></td>
                    </tr>
                    <tr>
                        <td>Fitness Seansı 2</td>
                        <td>10:00</td>
                        <td>11:00</td>
                        <td><span class="badge badge-danger">25 / 25</span></td>
                        <td><span class="badge badge-secondary">Dolu</span></td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        """
        token = encrypt_session_data({"cookies": {".AspNet.ApplicationCookie": "abc"}})
        base_url = SportsBookingService.get_base_url()

        with patch("requests.Session.get") as mock_get, patch("requests.Session.post") as mock_post:
            mock_get_res = MagicMock()
            mock_get_res.url = f"{base_url}/Appointment/SeansSelection"
            mock_get_res.text = '<input name="__RequestVerificationToken" type="hidden" value="CSRF_TOKEN_456" />'
            mock_get_res.history = []
            mock_get.return_value = mock_get_res

            mock_post_res = MagicMock()
            mock_post_res.url = f"{base_url}/Appointment/SeansSelection"
            mock_post_res.text = mock_html
            mock_post_res.history = []
            mock_post.return_value = mock_post_res

            slots = SportsBookingService.get_available_slots(token, "28.09.2026", unit_id="4", location_id="8")

            mock_post.assert_called_once()
            _, kwargs = mock_post.call_args
            self.assertEqual(kwargs["data"]["__RequestVerificationToken"], "CSRF_TOKEN_456")
            self.assertEqual(kwargs["data"]["UnitId"], "4")
            self.assertEqual(kwargs["data"]["LocationId"], "8")
            self.assertEqual(kwargs["data"]["AppDate"], "28.09.2026")
            self.assertEqual(kwargs["timeout"], (10, 30))

            self.assertEqual(len(slots), 2)
            self.assertEqual(slots[0]["seans_id"], "101")
            self.assertEqual(slots[0]["time_slot"], "09:00 - 10:00")
            self.assertEqual(slots[0]["occupied"], 14)
            self.assertEqual(slots[0]["capacity"], 25)
            self.assertFalse(slots[0]["is_full"])

            self.assertIsNone(slots[1]["seans_id"])
            self.assertEqual(slots[1]["time_slot"], "10:00 - 11:00")
            self.assertEqual(slots[1]["occupied"], 25)
            self.assertEqual(slots[1]["capacity"], 25)
            self.assertTrue(slots[1]["is_full"])

    def test_get_available_slots_empty_records(self):
        empty_html = """
        <html><body><div class="alert alert-info">Seçilen kriterlere uygun kayıt bulunamadı.</div></body></html>
        """
        token = encrypt_session_data({"cookies": {".AspNet.ApplicationCookie": "abc"}})
        base_url = SportsBookingService.get_base_url()

        with patch("requests.Session.get") as mock_get, patch("requests.Session.post") as mock_post:
            mock_get_res = MagicMock(url=f"{base_url}/Appointment/SeansSelection", history=[])
            mock_get_res.text = '<input name="__RequestVerificationToken" type="hidden" value="CSRF_123" />'
            mock_get.return_value = mock_get_res

            mock_post_res = MagicMock(url=f"{base_url}/Appointment/SeansSelection", history=[], text=empty_html)
            mock_post.return_value = mock_post_res

            slots = SportsBookingService.get_available_slots(token, "28.09.2026")
            self.assertEqual(slots, [])

    def test_book_slot_success_and_failure(self):
        token = encrypt_session_data({"cookies": {".AspNet.ApplicationCookie": "abc"}})

        with patch("requests.Session.get") as mock_get:
            mock_res_success = MagicMock(history=[])
            mock_res_success.url = "https://randevu.cankaya.edu.tr/Appointment/SeansSelected/101"
            mock_res_success.text = "<div>Randevu başvurunuz alınmıştır. Teşekkür ederiz.</div>"
            mock_get.return_value = mock_res_success

            result = SportsBookingService.book_slot(token, "101")
            self.assertTrue(result["success"])
            self.assertIn("başarıyla", result["message"].lower())

            mock_res_fail = MagicMock(history=[])
            mock_res_fail.url = "https://randevu.cankaya.edu.tr/Appointment/SeansSelected/102"
            mock_res_fail.text = "<div class='alert alert-danger'>Seçilen seansın kontenjanı dolmuştur.</div>"
            mock_get.return_value = mock_res_fail

            result_fail = SportsBookingService.book_slot(token, "102")
            self.assertFalse(result_fail["success"])
            self.assertIn("kontenjan", result_fail["message"].lower())

    def test_unsafe_external_redirect_blocked(self):
        token = encrypt_session_data({"cookies": {".AspNet.ApplicationCookie": "abc"}})
        with patch("requests.Session.get") as mock_get:
            redirect_item = MagicMock()
            redirect_item.headers = {"Location": "https://malicious-domain.com/steal-cookie"}
            mock_res = MagicMock()
            mock_res.history = [redirect_item]
            mock_get.return_value = mock_res

            with self.assertRaises(SportsUpstreamError):
                SportsBookingService.book_slot(token, "101")

    def test_fastapi_sports_login_api_failure_mocked(self):
        service = api_index.SportsBookingService
        base_url = service.get_base_url()
        login_url = f"{base_url}/Account/StudentLogin"

        get_response = MagicMock()
        get_response.status_code = 200
        get_response.headers = {"Content-Type": "text/html; charset=UTF-8"}
        get_response.url = login_url
        get_response.history = []
        get_response.text = (
            '<form action="/Account/StudentLogin" method="post">'
            '<input name="__RequestVerificationToken" type="hidden" '
            'value="CSRF_TOKEN" />'
            '</form>'
        )

        post_response = MagicMock()
        post_response.status_code = 200
        post_response.headers = {"Content-Type": "text/html; charset=UTF-8"}
        post_response.url = login_url
        post_response.history = []
        post_response.text = (
            '<form action="/Account/StudentLogin" method="post">'
            '<div class="validation-summary-errors">InvalidUserName</div>'
            '</form>'
        )

        session = service._create_session()
        with patch.object(
            service, "_create_session", return_value=session
        ), patch.object(
            session, "get", return_value=get_response
        ) as mock_get, patch.object(
            session, "post", return_value=post_response
        ) as mock_post:
            res = client.post(
                "/api/sports/login",
                json={"username": "test_user", "password": "wrong_password"},
            )

        mock_get.assert_called_once_with(
            login_url,
            timeout=service.TIMEOUT,
            allow_redirects=True,
        )
        mock_post.assert_called_once()
        _, post_kwargs = mock_post.call_args
        self.assertEqual(post_kwargs["data"]["__RequestVerificationToken"], "CSRF_TOKEN")
        self.assertEqual(post_kwargs["data"]["UserName"], "test_user")
        self.assertEqual(post_kwargs["headers"]["Origin"], base_url)
        self.assertEqual(post_kwargs["headers"]["Referer"], login_url)

        self.assertEqual(res.status_code, 401)
        data = res.json()
        self.assertEqual(data["detail"]["code"], "INVALID_CREDENTIALS")
        self.assertEqual(data["detail"]["message"], "Kullanıcı adı veya şifre hatalı.")
        self.assertIn("no-store", res.headers.get("cache-control", "").lower())

    def test_fastapi_sports_slots_api_invalid_token(self):
        res = client.post("/api/sports/slots", json={"token": "invalid_token_12345", "date": "28.09.2026"})
        self.assertEqual(res.status_code, 401)
        data = res.json()
        self.assertEqual(data["detail"]["code"], "SESSION_INVALID")
        self.assertIn("no-store", res.headers.get("cache-control", "").lower())

    def test_fastapi_concurrent_booking_lock(self):
        token = encrypt_session_data({"cookies": {".AspNet.ApplicationCookie": "abc"}})

        # Inject fake lock for this token
        import hashlib
        from api.index import _BOOKING_LOCKS
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        _BOOKING_LOCKS.add(token_hash)

        try:
            res = client.post("/api/sports/book", json={"token": token, "seans_id": "101"})
            self.assertEqual(res.status_code, 409)
            self.assertEqual(res.json()["detail"]["code"], "CONCURRENT_BOOKING")
        finally:
            _BOOKING_LOCKS.discard(token_hash)


    def test_rate_limiter_extracts_client_ip_with_headers_and_limits(self):
        from api.index import _check_rate_limit, _rate_limiter, SlidingWindowRateLimiter
        from starlette.requests import Request

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/sports/login",
            "headers": [
                (b"x-forwarded-for", b"203.0.113.195, 70.41.3.18"),
                (b"x-real-ip", b"198.51.100.1"),
            ],
            "client": ("127.0.0.1", 12345),
        }
        req = Request(scope)
        # x-real-ip takes precedence
        self.assertEqual(_rate_limiter.get_client_ip(req), "198.51.100.1")

        # Test sliding window rate limit
        test_limiter = SlidingWindowRateLimiter(max_keys=10)
        # Should allow up to limit
        for _ in range(3):
            test_limiter.check_rate_limit(req, "test_action", limit=3, window=60)

        # 4th should raise 429
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as ctx:
            test_limiter.check_rate_limit(req, "test_action", limit=3, window=60)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.headers.get("Retry-After"), "60")

    def test_rate_limiter_bounds_memory_keys(self):
        from api.index import SlidingWindowRateLimiter
        limiter = SlidingWindowRateLimiter(max_keys=5)
        from starlette.requests import Request

        for i in range(10):
            req = Request({
                "type": "http",
                "method": "POST",
                "path": "/api/test",
                "headers": [(b"x-real-ip", f"192.0.2.{i}".encode("ascii"))],
                "client": ("127.0.0.1", 12345),
            })
            limiter.check_rate_limit(req, "action", limit=5, window=60)

        self.assertLessEqual(len(limiter._storage), 5)


if __name__ == '__main__':
    unittest.main()
