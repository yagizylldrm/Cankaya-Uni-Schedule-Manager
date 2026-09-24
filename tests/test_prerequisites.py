import unittest
from pathlib import Path

from api.prerequisite_manager import PrerequisiteManager as Manager
from refresh_prerequisites import parse_rules


class PrerequisiteTests(unittest.TestCase):
    def test_department_tables_include_empty_rules_and_combined_conditions(self):
        html = (Path(__file__).parent / 'fixtures/ceng_curriculum.html').read_text(encoding='utf-8')
        rules = parse_rules(html)
        self.assertEqual(len(rules), 53)
        self.assertEqual(rules['CENG383']['courses'], ['CENG218'])
        self.assertEqual(rules['CENG497']['courses'], ['CENG218', 'MATH205'])
        self.assertEqual(rules['CENG471']['courses'], ['CENG114', 'CENG328'])
        self.assertEqual(rules['CENG162']['courses'], [])
        self.assertEqual(rules['CENG435']['courses'], [])
        self.assertNotIn('MATH158', rules)  # Do not overwrite other departments' rules.

    def test_algorithms_requires_data_structures(self):
        self.assertFalse(Manager.check_prerequisites('CENG383', [])['can_take'])
        result = Manager.check_prerequisites('CENG 383', ['CENG 218'])
        self.assertTrue(result['can_take'])
        self.assertTrue(result['source'].startswith('https://ceng.cankaya.edu.tr/'))

    def test_shared_courses_are_parsed_when_loading_a_whole_program(self):
        html = (Path(__file__).parent / 'fixtures/ceng_curriculum.html').read_text(encoding='utf-8')
        rules = parse_rules(html, course_prefix=None)
        self.assertEqual(rules['MATH205']['courses'], ['MATH157'])
        self.assertEqual(rules['MATH254']['courses'], ['MATH157'])
        self.assertEqual(rules['PHYS132']['courses'], [])

    def test_shared_course_uses_selected_program_requirements(self):
        result = Manager.check_prerequisites('MATH205', [], primary_dept='CENG')
        self.assertFalse(result['can_take'])
        self.assertEqual(result['missing_prereqs'], ['MATH157'])
        self.assertTrue(Manager.check_prerequisites('MATH205', ['MATH157'], primary_dept='CENG')['can_take'])
        self.assertEqual(result['source'], 'https://ceng.cankaya.edu.tr/tr/undergraduate-curriculum/')
        # A program-specific rule must not leak to an unrelated program.
        self.assertEqual(Manager.check_prerequisites('MATH205', [], primary_dept='OTHER'),
                         Manager.check_prerequisites('MATH205', []))

    def test_official_details_override_stale_hardcoded_names(self):
        from unittest.mock import patch
        from api.data_manager import DataManager
        with patch.dict(DataManager.KNOWN_COURSE_DETAILS, {'MATH205': {'name': 'Differential Equations', 'desc': 'stale'}}):
            dm = DataManager()
            self.assertIn('Lineer Cebir', dm.get_course_info('MATH205')['name'])
            self.assertNotEqual(dm.get_course_info('MATH205')['description'], 'stale')
            self.assertEqual(DataManager.KNOWN_COURSE_DETAILS['MATH205']['name'], 'Differential Equations')

    def test_graphics_requires_both_courses(self):
        result = Manager.check_prerequisites('CENG497', ['CENG218'])
        self.assertFalse(result['can_take'])
        self.assertEqual(result['missing_prereqs'], ['MATH205'])
        self.assertTrue(Manager.check_prerequisites('CENG497', ['CENG218', 'MATH205'])['can_take'])

    def test_explicit_no_prerequisite_overrides_old_guesses(self):
        for code in ['CENG162', 'CENG435', 'CENG462']:
            result = Manager.check_prerequisites(code, [])
            self.assertTrue(result['known'])
            self.assertTrue(result['can_take'])
            self.assertFalse(result['has_prereqs'])

    def test_missing_data_is_not_a_no_prerequisite_claim(self):
        for code in ['ZZZ102', 'ZZZ205', 'ZZZ408']:
            result = Manager.check_prerequisites(code, [])
            self.assertFalse(result['known'])
            self.assertIsNone(result['can_take'])
            self.assertIsNone(result['has_prereqs'])

    def test_unrecognized_expression_aborts_import(self):
        html = '<table><tr><th>Ders Kodu</th><th>Ön Koşullar</th></tr><tr><td>CENG497</td><td>120 kredi</td></tr></table>'
        with self.assertRaises(ValueError):
            parse_rules(html)

    def test_math_equivalence_rules(self):
        # MATH158 requires MATH157 or MATH155
        self.assertFalse(Manager.check_prerequisites('MATH158', [])['can_take'])
        self.assertTrue(Manager.check_prerequisites('MATH158', ['MATH157'])['can_take'])
        self.assertTrue(Manager.check_prerequisites('MATH158', ['MATH155'])['can_take'])

    def test_psychology_official_prerequisites(self):
        self.assertFalse(Manager.check_prerequisites('PSY114', [])['can_take'])
        self.assertTrue(Manager.check_prerequisites('PSY114', ['PSY113'])['can_take'])
        self.assertFalse(Manager.check_prerequisites('PSY342', [])['can_take'])
        self.assertTrue(Manager.check_prerequisites('PSY342', ['PSY243'])['can_take'])

    def test_industrial_engineering_prerequisites(self):
        self.assertFalse(Manager.check_prerequisites('IE228', [])['can_take'])
        self.assertTrue(Manager.check_prerequisites('IE228', ['IE227'])['can_take'])
        self.assertFalse(Manager.check_prerequisites('IE408', [])['can_take'])
        self.assertTrue(Manager.check_prerequisites('IE408', ['IE407'])['can_take'])

    def test_civil_and_mechanical_engineering_prerequisites(self):
        self.assertFalse(Manager.check_prerequisites('CE224', [])['can_take'])
        self.assertTrue(Manager.check_prerequisites('CE224', ['CE221'])['can_take'])
        self.assertFalse(Manager.check_prerequisites('ME200', [])['can_take'])
        self.assertTrue(Manager.check_prerequisites('ME200', ['ME210'])['can_take'])

    def test_verified_empty_prerequisites_across_faculties(self):
        for code in ['TURK101', 'HIST201', 'ENG121', 'PHYS131', 'MATH157', 'CENG105']:
            result = Manager.check_prerequisites(code, [])
            self.assertTrue(result['known'], f"{code} should be known")
            self.assertTrue(result['can_take'], f"{code} should be takeable")
            self.assertFalse(result['has_prereqs'], f"{code} should have no prereqs")

    def test_course_names_accurate(self):
        from api.data_manager import DataManager
        dm = DataManager()
        math205_info = dm.get_course_info('MATH205')
        self.assertIn('Lineer Cebir', math205_info['name'])
        self.assertNotIn('Differential Equations', math205_info['name'])

        math254_info = dm.get_course_info('MATH254')
        self.assertIn('Diferansiyel', math254_info['name'])


if __name__ == '__main__':
    unittest.main()
