import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from api.index import app
from api.sports_booking import (
    SportsBookingService,
    encrypt_session_data,
    decrypt_session_data
)

client = TestClient(app)


class SportsBookingTests(unittest.TestCase):
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
        tampered = ("B" if token[10] != "B" else "C") + token[1:]
        with self.assertRaises(ValueError):
            decrypt_session_data(tampered)

    def test_session_token_expired_rejected(self):
        data = {"user": "bob"}
        token = encrypt_session_data(data, ttl_seconds=-10)
        with self.assertRaises(ValueError):
            decrypt_session_data(token)

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

        with patch("requests.Session.get") as mock_get, patch("requests.Session.post") as mock_post:
            # Mock GET to return page with CSRF token
            mock_get_res = MagicMock()
            mock_get_res.url = "https://randevu.cankaya.edu.tr/Appointment/SeansSelection"
            mock_get_res.text = '<input name="__RequestVerificationToken" type="hidden" value="CSRF_TOKEN_456" />'
            mock_get.return_value = mock_get_res

            # Mock POST to return slots table
            mock_post_res = MagicMock()
            mock_post_res.text = mock_html
            mock_post.return_value = mock_post_res

            slots = SportsBookingService.get_available_slots(token, "28.09.2026", unit_id="4", location_id="8")

            # Verify POST payload sent CSRF token and parameters correctly
            mock_post.assert_called_once()
            _, kwargs = mock_post.call_args
            self.assertEqual(kwargs["data"]["__RequestVerificationToken"], "CSRF_TOKEN_456")
            self.assertEqual(kwargs["data"]["UnitId"], "4")
            self.assertEqual(kwargs["data"]["LocationId"], "8")
            self.assertEqual(kwargs["data"]["AppDate"], "28.09.2026")

            self.assertEqual(len(slots), 2)
            # Slot 1
            self.assertEqual(slots[0]["seans_id"], "101")
            self.assertEqual(slots[0]["time_slot"], "09:00 - 10:00")
            self.assertEqual(slots[0]["occupied"], 14)
            self.assertEqual(slots[0]["capacity"], 25)
            self.assertFalse(slots[0]["is_full"])

            # Slot 2 (full)
            self.assertIsNone(slots[1]["seans_id"])
            self.assertEqual(slots[1]["time_slot"], "10:00 - 11:00")
            self.assertEqual(slots[1]["occupied"], 25)
            self.assertEqual(slots[1]["capacity"], 25)
            self.assertTrue(slots[1]["is_full"])

    def test_book_slot_success_and_failure(self):
        token = encrypt_session_data({"cookies": {".AspNet.ApplicationCookie": "abc"}})

        with patch("requests.Session.get") as mock_get:
            # Success case
            mock_res_success = MagicMock()
            mock_res_success.text = "<div>Randevu başvurunuz alınmıştır. Teşekkür ederiz.</div>"
            mock_get.return_value = mock_res_success

            result = SportsBookingService.book_slot(token, "101")
            self.assertTrue(result["success"])
            self.assertIn("başarıyla", result["message"].lower())

            # Failure case
            mock_res_fail = MagicMock()
            mock_res_fail.text = "<div class='alert alert-danger'>Seçilen seansın kontenjanı dolmuştur.</div>"
            mock_get.return_value = mock_res_fail

            result_fail = SportsBookingService.book_slot(token, "102")
            self.assertFalse(result_fail["success"])
            self.assertIn("kontenjan", result_fail["message"].lower())

    def test_fastapi_sports_login_api_failure(self):
        # Calling login with invalid credentials should return 400 or 502 gracefully
        res = client.post("/api/sports/login", json={"username": "invalid_user", "password": "wrong_password"})
        self.assertIn(res.status_code, [400, 502])
        self.assertIn("detail", res.json())

    def test_fastapi_sports_slots_api_invalid_token(self):
        res = client.post("/api/sports/slots", json={"token": "invalid_token_123", "date": "28.09.2026"})
        self.assertEqual(res.status_code, 401)
        self.assertIn("detail", res.json())


if __name__ == '__main__':
    unittest.main()
