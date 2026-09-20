import unittest
from unittest.mock import patch
from types import SimpleNamespace

from api.scheduler_engine import SchedulerEngine
from api.data_manager import Section, ScheduleSlot, Course
from api import index as api
from fastapi.testclient import TestClient


def section(code, number='1', day='Pazartesi', time='09:00 - 09:50'):
    return Section(code, number, slots=[ScheduleSlot(day, time)])


class ConflictTests(unittest.TestCase):
    def setUp(self):
        self.engine = SchedulerEngine()

    def test_pair_conflict_has_specific_day_and_sections(self):
        details = self.engine.explain_conflicts({'A': [section('A')], 'B': [section('B', time='09:20 - 10:10')]})
        pair = next(d for d in details if d['kind'] == 'course_pair')
        self.assertIn('Pazartesi', pair['message'])
        self.assertIn('A ve B', pair['message'])
        self.assertEqual(pair['action']['type'], 'review_basket')

    def test_relaxation_is_verified_with_all_other_constraints(self):
        courses = {'A': [section('A', day='Cuma')]}
        details = self.engine.explain_conflicts(courses, {'free_friday': True, 'no_morning': True})
        fix = next(d for d in details if d['kind'] == 'preferences')
        self.assertEqual(set(fix['action']['keys']), {'free_friday', 'no_morning'})
        self.assertEqual(self.engine.generate_combinations(courses, {'free_friday': True}), [])

    def test_no_false_fix_for_inherently_overlapping_courses(self):
        details = self.engine.explain_conflicts({'A': [section('A')], 'B': [section('B')]}, {'no_morning': True})
        self.assertFalse(any(d['kind'] == 'preferences' for d in details))

    def test_remove_block_only_when_it_allows_a_complete_schedule(self):
        block = {'day': 'Pazartesi', 'time_slot': '09:00 - 09:50', 'title': 'Spor'}
        details = self.engine.explain_conflicts({'A': [section('A')]}, {}, {'block': block})
        fix = next(d for d in details if d['kind'] == 'custom_block')
        self.assertEqual(fix['action']['key'], 'block')
        self.assertIn('Spor', fix['message'])

    def test_pairwise_compatible_but_globally_impossible_uses_combined_message(self):
        courses = {c: [section(c), section(c, '2', time='10:00 - 10:50')] for c in ['A', 'B', 'C']}
        self.assertEqual(self.engine.generate_combinations(courses), [])
        self.assertEqual(self.engine.explain_conflicts(courses)[0]['kind'], 'combined')

    def test_empty_candidates_do_not_silently_drop_course(self):
        self.assertEqual(self.engine.generate_combinations({'A': [], 'B': [section('B')]}), [])


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(api.app)
        self.a = Course('A')
        self.a.sections = {'1': section('A')}
        self.b = Course('B')
        self.b.sections = {'1': section('B')}

    def test_api_returns_actionable_conflicts(self):
        with patch.object(api.dm, 'courses', {'A': self.a, 'B': self.b}):
            response = self.client.post('/api/combinations', json={'selected_courses': {'A': ['1'], 'B': ['1']}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 0)
        self.assertEqual(response.json()['conflict_details'][0]['kind'], 'course_pair')

    def test_bad_selection_never_returns_partial_schedule(self):
        for selected in [{'A': [], 'B': ['1']}, {'A': ['9'], 'B': ['1']}, {'MISSING': ['1'], 'B': ['1']}]:
            with patch.object(api.dm, 'courses', {'A': self.a, 'B': self.b}):
                response = self.client.post('/api/combinations', json={'selected_courses': selected})
            self.assertEqual(response.json()['count'], 0)
            self.assertTrue(response.json()['conflict_details'])


if __name__ == '__main__':
    unittest.main()
