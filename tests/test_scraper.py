import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

from api.scraper import CankayaScraper
from refresh_schedules import build_cache


FIXTURES = Path(__file__).parent / 'fixtures'


def fixture(name):
    return (FIXTURES / name).read_text(encoding='utf-8')


def response(html):
    result = Mock()
    result.text = html
    return result


class ScraperTests(unittest.TestCase):
    def setUp(self):
        self.scraper = CankayaScraper(session=Mock())

    def test_current_plain_text_slots_and_rooms(self):
        entries = self.scraper.parse_schedule_table(fixture('ceng162.html'), 'CENG', '')
        self.assertEqual({(e['day'], e['time_slot']) for e in entries}, {
            ('Cuma', '09:00/09:20'), ('Cuma', '10:00/10:20'), ('Cuma', '11:00/11:20'),
            ('Salı', '11:00/11:20'), ('Salı', '12:00/12:20'),
        })
        self.assertEqual(len(entries), 5)
        self.assertTrue(all(e['course_code'] == 'CENG162' and e['section'] == '1' for e in entries))
        self.assertTrue(all(e['instructor'] == 'Belirsiz' for e in entries))
        self.assertEqual(entries[-1]['classroom'], 'H312 Computerized Lecture Hall-2 (MERKEZ KAMPÜS)')

    def test_multiple_sections_in_plain_cell(self):
        html = fixture('ceng162.html').replace('CENG162 - 1<br/>L111',
            'CENG162 - 2<br/>Room-2<br/><br/>CENG162 - 1<br/>L111')
        entries = self.scraper.parse_schedule_table(html, 'CENG', '')
        self.assertEqual(len(entries), 8)
        self.assertTrue(all(e['classroom'] == 'Room-2' for e in entries if e['section'] == '2'))

    def test_legacy_and_current_sources_agree_for_ceng162(self):
        old = self.scraper.parse_schedule_table(fixture('ceng_year1.html'), 'CENG', 1)
        new = self.scraper.parse_schedule_table(fixture('ceng162.html'), 'CENG', '')
        self.assertEqual({(e['section'], e['day'], e['time_slot']) for e in old if e['course_code'] == 'CENG162'},
                         {(e['section'], e['day'], e['time_slot']) for e in new})

    def test_unrelated_table_does_not_shift_days(self):
        html = '<table><tr><td>Unrelated</td></tr></table>' + fixture('ceng162.html')
        self.assertEqual(len(self.scraper.parse_schedule_table(html, 'CENG', '')), 5)

    def test_missing_and_malformed_tables_fail(self):
        for html in ['<html>Maintenance</html>', fixture('ceng162.html').replace('<td class="text-center"> </td>', '', 1)]:
            with self.assertRaises(ValueError):
                self.scraper.parse_schedule_table(html, 'CENG', '')

    def test_explicit_no_schedule_is_allowed(self):
        self.assertEqual(self.scraper.parse_schedule_table('<p>Sistemde Ders Programı Bulunmamaktadır!!!</p>', 'ARCH', ''), [])

    def test_catalog_links_are_trimmed_and_use_https(self):
        self.scraper.session.get.return_value = response(fixture('offered_courses.html'))
        courses = self.scraper.fetch_offered_courses()
        self.assertEqual(len(courses), 3)  # Two additional rows are portal links.
        ceng = next(c for c in courses if c['code'] == 'CENG162')
        self.assertEqual(ceng['url'], 'https://www.cankaya.edu.tr/akademik_birimler/DersProgram/CENG-162.html')
        self.assertTrue(all(c['code'] for c in courses))

    def test_departments_come_from_current_catalog(self):
        self.scraper.session.get.return_value = response(fixture('offered_courses.html'))
        self.assertEqual([d['code'] for d in self.scraper.fetch_department_codes()], ['ADA', 'ARCH', 'CENG'])

    def test_cancel_never_returns_partial_data(self):
        self.scraper.fetch_offered_courses = Mock(return_value=[
            {'code': 'CENG162', 'dept_code': 'CENG', 'url': 'https://example.test/1'}])
        with self.assertRaises(RuntimeError):
            self.scraper.fetch_all_schedules(cancel_check=lambda: True)
        self.scraper.session.get.assert_not_called()

    def test_failed_page_never_returns_partial_data(self):
        self.scraper.fetch_offered_courses = Mock(return_value=[
            {'code': 'CENG162', 'dept_code': 'CENG', 'url': 'https://example.test/1'},
            {'code': 'CENG111', 'dept_code': 'CENG', 'url': 'https://example.test/2'},
        ])
        self.scraper.session.get.side_effect = [response(fixture('ceng162.html'))] + [requests.Timeout()] * 3
        with patch('api.scraper.time.sleep'), self.assertRaises(RuntimeError):
            self.scraper.fetch_all_schedules()
        self.assertEqual(self.scraper.session.get.call_count, 4)

    def test_wrong_course_page_fails(self):
        self.scraper.fetch_offered_courses = Mock(return_value=[
            {'code': 'CENG111', 'dept_code': 'CENG', 'url': 'https://example.test/1'}])
        self.scraper.session.get.return_value = response(fixture('ceng162.html'))
        with patch('api.scraper.time.sleep'), self.assertRaises(RuntimeError):
            self.scraper.fetch_all_schedules()

    def test_cache_rebuild_preserves_offered_courses_without_inventing_sections(self):
        self.scraper.offered_courses = [{'code': 'CENG162', 'dept_code': 'CENG'}, {'code': 'ARCH100', 'dept_code': 'ARCH'}]
        entries = self.scraper.parse_schedule_table(fixture('ceng162.html'), 'CENG', '')
        cache = build_cache(self.scraper, entries)
        self.assertEqual(cache['courses']['ARCH100']['sections'], {})
        self.assertEqual(len(cache['courses']['CENG162']['sections']['1']['slots']), 5)
        self.assertEqual(cache['source'], self.scraper.COURSES_URL)


if __name__ == '__main__':
    unittest.main()
