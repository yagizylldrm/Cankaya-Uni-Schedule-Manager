import { calculateGpa, simulateNewCgpa } from '../src/utils/gpaCalculator.js';

describe('gpaCalculator', () => {
  test('retake replaces old grade', () => {
    const res = simulateNewCgpa({ pastCompletedCredits: 6, pastTotalPoints: 18, pastCourses: [{courseCode:'MATH101', credits:3, grade:'BB'}], currentCourses: [{courseCode:'MATH101', credits:3, grade:'AA'}] });
    expect(res.newCgpa).toBeCloseTo(4.0, 5);
  });
  test('new course adds weighted', () => {
    const res = simulateNewCgpa({ pastCompletedCredits: 0, pastTotalPoints: 0, currentCourses: [{courseCode:'CS101', credits:4, grade:'BA'}] });
    expect(res.termGpa).toBeCloseTo(3.5, 5);
  });
  test('zero-credit ignored', () => {
    expect(calculateGpa([{credits:0, grade:'AA'}])).toBe(0);
  });
});
