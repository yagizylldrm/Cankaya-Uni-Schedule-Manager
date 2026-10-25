import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateGpa, simulateNewCgpa } from '../src/utils/gpaCalculator.js';

test('gpaCalculator retake replaces old grade without dropping other past courses', () => {
  const res = simulateNewCgpa({ pastCompletedCredits: 6, pastTotalPoints: 18, pastCourses: [{courseCode:'MATH101', credits:3, grade:'BB'}], currentCourses: [{courseCode:'MATH101', credits:3, grade:'AA'}] });
  assert.strictEqual(res.newCgpa, 3.5);
  assert.strictEqual(res.termGpa, 4);
});

test('gpaCalculator combines cumulative history and new courses', () => {
  const res = simulateNewCgpa({ pastCompletedCredits: 30, pastTotalPoints: 90, currentCourses: [{courseCode:'CS101', credits:3, grade:'AA'}] });
  assert.strictEqual(res.newCgpa, 102 / 33);
});

test('gpaCalculator only replaces courses actually retaken', () => {
  const res = simulateNewCgpa({ pastCompletedCredits: 6, pastTotalPoints: 18, pastCourses: [{courseCode:'MATH101', credits:3, grade:'BB'}], currentCourses: [{courseCode:'CS101', credits:3, grade:'AA'}] });
  assert.strictEqual(res.newCgpa, 30 / 9);
});

test('gpaCalculator new course adds weighted', () => {
  const res = simulateNewCgpa({ pastCompletedCredits: 0, pastTotalPoints: 0, currentCourses: [{courseCode:'CS101', credits:4, grade:'BA'}] });
  assert.strictEqual(res.termGpa, 3.5);
});

test('gpaCalculator zero-credit ignored', () => {
  assert.strictEqual(calculateGpa([{credits:0, grade:'AA'}]), 0);
});
