import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

from api.scheduler_engine import SchedulerEngine
from api.data_manager import Section, ScheduleSlot, Course
from api import index as api
from curriculum_fetcher import CurriculumFetcher
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

    def test_pairwise_compatible_but_globally_impossible_names_course_group(self):
        courses = {c: [section(c), section(c, '2', time='10:00 - 10:50')] for c in ['A', 'B', 'C']}
        self.assertEqual(self.engine.generate_combinations(courses), [])
        detail = self.engine.explain_conflicts(courses)[0]
        self.assertEqual(detail['kind'], 'course_group')
        self.assertIn('A, B ve C', detail['message'])

    def test_empty_candidates_do_not_silently_drop_course(self):
        self.assertEqual(self.engine.generate_combinations({'A': [], 'B': [section('B')]}), [])

    def test_identical_timetables_count_once_even_with_different_instructors(self):
        first = section('A', '1')
        duplicate = section('A', '2', time='09:00/09:20')
        different_instructor = section('A', '3')
        different_instructor.instructor = 'Başka Hoca'
        different_time = section('A', '4', time='10:00 - 10:50')
        other = section('B', day='Salı')
        combos = self.engine.generate_combinations({
            'A': [first, duplicate, different_instructor, different_time], 'B': [other]})
        self.assertEqual([combo[0].section_no for combo in combos], ['1', '4'])


class ApiTests(unittest.TestCase):
    def test_latest_curriculum_filters_each_department_course_list(self):
        departments = self.client.get('/api/departments').json()
        self.assertTrue(all(any(d['code'] == code and d['has_curriculum']
            for d in departments) for code in api.dm.official_curricula))
        for department, curriculum in api.dm.official_curricula.items():
            with self.subTest(department=department):
                allowed = api.dm.curriculum_course_codes(department)
                self.assertIn(api.dm.normalize_code(curriculum['compulsory_codes'][0]), allowed)
                response = self.client.get('/api/courses', params={'primary_dept': department}).json()
                self.assertTrue(all(api.dm.normalize_code(course['code']) in allowed
                    for course in response))

    def test_elective_pools_are_available_for_math_and_program_aliases(self):
        self.assertEqual(CurriculumFetcher()._infer_dept_code({
            'program_name': 'Matematik (Lisans)',
            'compulsory_courses': [{'code': 'CENG 161'}]}), 'MATH')
        self.assertEqual(len(api.dm.official_curricula['MATH']['elective_slots']), 11)
        self.assertTrue(api.dm.curriculum_course_codes('MATH') &
            set(api.dm.official_curricula['MATH']['technical_elective_codes']))
        for alias, canonical in [('LAW', 'HUK'), ('BF', 'BAF'), ('PRAD', 'HİR'),
                                 ('PSIR', 'PSI'), ('TRAN', 'TINS')]:
            with self.subTest(alias=alias):
                self.assertEqual(api.dm.curriculum_course_codes(alias),
                                 api.dm.curriculum_course_codes(canonical))

    def test_ceng_does_not_inherit_aiit_as_a_compulsory_course(self):
        self.assertNotIn('AIIT101', api.dm.curriculum_course_codes('CENG'))
        self.assertEqual(api.dm.classify_course('AIIT101', primary_dept='CENG')[0], 'MUFREDAT_DISI')
        self.assertEqual(api.dm.classify_course('HIST201', primary_dept='CENG')[0], 'ZORUNLU')
        default = self.client.get('/api/courses', params={
            'primary_dept': 'CENG', 'query': 'CENG154'}).json()
        outside = self.client.get('/api/courses', params={
            'primary_dept': 'CENG', 'query': 'CENG154',
            'include_outside_curriculum': True}).json()
        self.assertEqual(default, [])
        self.assertEqual(outside[0]['code'], 'CENG154')
        self.assertEqual(outside[0]['type'], 'MUFREDAT_DISI')

    def test_zero_credit_course_without_weekly_hours_does_not_conflict(self):
        detail = self.client.get('/api/courses/CENG200').json()
        self.assertTrue(detail['untimed'])
        self.assertEqual(detail['sections'], [])
        response = self.client.post('/api/combinations', json={
            'selected_courses': {'CENG111': ['1'], 'CENG105': ['1'], 'CENG200': []},
            'compact': True,
        }).json()
        self.assertGreater(response['count'], 0)
        combo = response['combinations'][0]
        self.assertIn(['CENG200', 'SAATSIZ'], combo['section_refs'])
        self.assertEqual(response['section_catalog']['CENG200']['SAATSIZ']['slots'], [])
        self.assertEqual(combo['total_ects'], sum(api.dm.get_course_credits(code)[1]
            for code in ('CENG111', 'CENG105', 'CENG200')))

    def test_missing_schedule_for_ordinary_course_is_not_silently_accepted(self):
        unscheduled = Course('MISSING_HOURS')
        with patch.object(api.dm, 'courses', {'MISSING_HOURS': unscheduled}):
            response = self.client.post('/api/combinations', json={
                'selected_courses': {'MISSING_HOURS': []},
            }).json()
        self.assertEqual(response['count'], 0)
        self.assertEqual(response['conflict_details'][0]['kind'], 'selection')
        self.assertIn('haftalık saat bilgisi bulunamadı', response['conflict_details'][0]['message'])

    def test_course_detail_and_eligibility_use_selected_curriculum(self):
        client = TestClient(api.app)
        detail = client.get('/api/courses/MATH205', params={'primary_dept': 'CENG'}).json()
        self.assertIn('Lineer Cebir', detail['name'])
        self.assertEqual(detail['prerequisites']['missing_prereqs'], ['MATH157'])
        params = {'query': 'MATH205', 'primary_dept': 'CENG', 'only_eligible': True}
        self.assertEqual(client.get('/api/courses', params=params).json(), [])
        params['passed_codes'] = 'MATH157'
        self.assertEqual(client.get('/api/courses', params=params).json()[0]['code'], 'MATH205')

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

    def test_api_counts_distinct_timetables_and_honors_explicit_section(self):
        self.a.sections['2'] = section('A', '2')
        selected = {'A': ['1', '2']}
        with patch.object(api.dm, 'courses', {'A': self.a}):
            all_sections = self.client.post('/api/combinations', json={'selected_courses': selected}).json()
            second_only = self.client.post('/api/combinations', json={
                'selected_courses': {'A': ['2']}}).json()
        self.assertEqual(all_sections['count'], 1)
        self.assertEqual(second_only['count'], 1)
        self.assertEqual(second_only['combinations'][0]['sections'][0]['section_no'], '2')

    def test_reference_schedule_reports_math_phys_overlap(self):
        selected = {'CENG466': ['2'], 'EE205': ['8'], 'MATH205': ['1'],
                    'PHYS132': ['2'], 'CENG383': ['2']}
        response = self.client.post('/api/combinations', json={'selected_courses': selected}).json()
        self.assertEqual(response['count'], 0)
        messages = ' '.join(detail['message'] for detail in response['conflict_details'])
        self.assertIn('MATH205 ve PHYS132', messages)
        self.assertNotIn('EE205', messages)

    def test_standalone_root_serves_frontend_before_compatibility_api(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'index.html').write_text('<h1>Schedule Manager</h1>', encoding='utf-8')
            with patch.object(api, 'DIST_DIR', directory):
                response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/html', response.headers['content-type'])
        self.assertIn('Schedule Manager', response.text)

    def test_bad_selection_never_returns_partial_schedule(self):
        for selected in [{'A': [], 'B': ['1']}, {'A': ['9'], 'B': ['1']}, {'MISSING': ['1'], 'B': ['1']}]:
            with patch.object(api.dm, 'courses', {'A': self.a, 'B': self.b}):
                response = self.client.post('/api/combinations', json={'selected_courses': selected})
            self.assertEqual(response.json()['count'], 0)
            self.assertTrue(response.json()['conflict_details'])

    def test_compact_combinations_preserve_every_section_and_total(self):
        self.b.sections = {'1': section('B', day='Salı')}
        request = {'selected_courses': {'A': ['1'], 'B': ['1']}}
        with patch.object(api.dm, 'courses', {'A': self.a, 'B': self.b}):
            full = self.client.post('/api/combinations', json=request).json()
            compact = self.client.post('/api/combinations', json={**request, 'compact': True}).json()
        self.assertEqual(compact['count'], full['count'])
        self.assertEqual(compact['count'], 1)
        refs = compact['combinations'][0]['section_refs']
        hydrated = [compact['section_catalog'][code][number] for code, number in refs]
        self.assertEqual(hydrated, full['combinations'][0]['sections'])
        self.assertEqual(compact['combinations'][0]['total_credits'], full['combinations'][0]['total_credits'])


if __name__ == '__main__':
    unittest.main()
