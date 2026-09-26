"""Synthetic transcript rows; no student documents or identity data stored here."""
import unittest

from api.transcript_parser import TranscriptParser


class TranscriptTests(unittest.TestCase):
    def parse(self, text):
        return TranscriptParser.parse_text(text)

    def test_multiline_pdf_grades_touching_points(self):
        result = self.parse('''CENG 111 Programming I
(Computer Programming I)
Z İng. 3 2 4 4 16AA  G
CENG 124 Discrete Structures
(Discrete Structures)
Z İng. 3 0 3 5 10.5BA  G
THEA 270 Elective
(Elective)
S İng. 3 0 3 3 12AA  G
CEC 104 Philosophy
(Philosophy)
S Tr 3 0 3 5 7.5CB  G
''')
        self.assertEqual({c: v['grade'] for c, v in result['passed_courses'].items()},
                         {'CENG111': 'AA', 'CENG124': 'BA', 'THEA270': 'AA', 'CEC104': 'CB'})
        self.assertEqual(result['passed_courses']['CENG111']['credit'], 4)
        self.assertEqual(result['passed_courses']['CENG111']['ects'], 4)
        self.assertEqual(result['passed_courses']['CENG124']['credit'], 3)
        self.assertEqual(result['passed_courses']['CENG124']['ects'], 5)

    def test_exemption_failure_and_incomplete_are_separate(self):
        result = self.parse('''* PREP 150 Exemption
(Exemption)
Z İng. - - 0 0 -EX
EE 205 Circuits I
(Circuits I)
Z İng. 3 2 4 6 2FD KL
MATH 205 Algebra
(Algebra)
Z İng. 3 0 3 4 0FF KL
CENG 491 Project
Z İng. 3 0 3 4 0P
''')
        self.assertEqual(set(result['passed_courses']), {'PREP150'})
        self.assertEqual(set(result['failed_courses']), {'EE205', 'MATH205'})
        self.assertEqual(set(result['pending_courses']), {'CENG491'})

    def test_prose_and_legend_are_not_courses(self):
        text = '''Sadece PREP 113 B2 Kuru veya PREP 114 B2+
Kuru’ndan S notu veya PREP 150 Muafiyet’ten EX notu
almış öğrenciler başarılı sayılırlar.
90 - 100 AA 4.00 Başarılı
'''
        self.assertEqual(self.parse(text)['all_detected_courses'], [])

    def test_no_grade_borrowed_from_next_course_or_summary(self):
        result = self.parse('''CENG 111 Programming I
Z İng. 3 2 4 4 -
CENG 124 Discrete Structures
Z İng. 3 0 3 5 12AA G
DNO:
U
S
''')
        self.assertEqual(set(result['passed_courses']), {'CENG124'})
        self.assertNotIn('CENG111', result['pending_courses'])

    def test_simple_pasted_rows_and_latest_attempt(self):
        result = self.parse('CENG111 Programming FF\nCENG111 Programming BA\nMATH157 Calculus CC\nPREP150 EX')
        self.assertEqual(result['passed_courses']['CENG111']['grade'], 'BA')
        self.assertEqual(len(result['passed_courses']), 3)
        self.assertEqual(result['failed_courses'], {})

    def test_grade_before_points_in_table(self):
        result = self.parse('CENG 111 Programming I\nZ İng. 3 2 4 4 AA 16 G')
        self.assertEqual(result['passed_courses']['CENG111']['grade'], 'AA')
        self.assertEqual(result['passed_courses']['CENG111']['credit'], 4)
        self.assertEqual(result['passed_courses']['CENG111']['ects'], 4)

    def test_missing_credit_values_are_not_invented(self):
        result = self.parse('PREP 150 Exemption\nZ İng. - - - - -EX')
        course = result['passed_courses']['PREP150']
        self.assertNotIn('credit', course)
        self.assertNotIn('ects', course)

    def test_latest_attempt_replaces_credit_metadata(self):
        result = self.parse('''CENG 111 Programming I
Z İng. 3 2 4 5 0FF KL
CENG 111 Programming I
Z İng. 3 0 3 6 12BA G
''')
        course = result['passed_courses']['CENG111']
        self.assertEqual(course['grade'], 'BA')
        self.assertEqual(course['credit'], 3)
        self.assertEqual(course['ects'], 6)


if __name__ == '__main__':
    unittest.main()
